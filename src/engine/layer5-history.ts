import type { Layer, CompressionConfig } from "../types/index.ts";
import { compressMessage } from "./layer1-message.ts";

// ── Types ──
export interface Message {
  role: "user" | "assistant";
  content: string;
  index: number;
}

interface ArchivedMessage {
  original: Message;
  summary: string;
  topics: string[];
  timestamp: number;
}

interface HistoryConfig {
  windowSize: number; // messages kept in full (default 10)
  archivePath?: string; // path for breathing archive
}

// ── Topic extraction ──
// Extract key topics/subjects from a message for matching
function extractTopics(text: string): string[] {
  // Strip code blocks before analyzing
  const cleaned = text.replace(/```[\s\S]*?```/g, "").toLowerCase();

  // Extract significant noun phrases and technical terms
  const words = cleaned
    .replace(/[^a-z0-9\s_.-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3);

  // Group into bigrams for better topic matching
  const topics: string[] = [...words];
  for (let i = 0; i < words.length - 1; i++) {
    topics.push(`${words[i]} ${words[i + 1]}`);
  }

  return [...new Set(topics)];
}

// ── Decision/constraint detection ──
// These must survive compression — never drop
const DECISION_PATTERNS = [
  /\b(?:using|chose|decided|going\s+with|picked|selected)\s+(\w+)\s+(?:not|instead\s+of|over|rather\s+than)\s+/i,
  /\b(?:we're|we\s+are|i'm|i\s+am)\s+(?:using|going\s+with)\s+/i,
  /\bmust\s+(?:use|support|have|include|be)\b/i,
  /\b(?:constraint|requirement|must|shall|required)\b/i,
  /\bi\s+prefer\s+/i,
  /\b(?:don't|do\s+not|never|always)\s+(?:use|do|make|change)\b/i,
];

function isDecisionOrConstraint(text: string): boolean {
  return DECISION_PATTERNS.some((p) => p.test(text));
}

// ── Acknowledgment detection ──
const GROUNDING_RE =
  /^(?:got\s+it|ok(?:ay)?|makes\s+sense|thanks|understood|sounds\s+good|perfect|great|nice|cool)\.?$/i;

const VERBOSE_THANKS_RE =
  /\bthank\s+you\s+(?:so\s+much|very\s+much).*$/i;

function compressAcknowledgment(text: string): string {
  const trimmed = text.trim();
  if (GROUNDING_RE.test(trimmed)) return trimmed; // keep grounding signals
  if (VERBOSE_THANKS_RE.test(trimmed)) return "thanks";
  return text;
}

// ── Failed attempt detection ──
// "try X" → "didn't work" → "try Y" → "worked" pattern
interface AttemptSequence {
  attempts: { suggestion: string; failed: boolean; index: number }[];
  workingSolution: string | null;
}

function detectFailedAttempts(messages: Message[]): AttemptSequence | null {
  const attempts: AttemptSequence["attempts"] = [];
  let workingSolution: string | null = null;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]!;
    const content = msg.content.toLowerCase();

    // Assistant suggestion
    if (
      msg.role === "assistant" &&
      /\b(?:try|use|change|replace|update|set|add)\b/i.test(msg.content)
    ) {
      attempts.push({
        suggestion: msg.content,
        failed: false,
        index: msg.index,
      });
    }

    // User reports failure
    if (
      msg.role === "user" &&
      /\b(?:didn't work|not working|still broken|same error|nope|no luck|doesn't work)\b/i.test(
        content
      )
    ) {
      if (attempts.length > 0) {
        attempts[attempts.length - 1]!.failed = true;
      }
    }

    // User reports success
    if (
      msg.role === "user" &&
      /\b(?:worked|works|fixed|that did it|perfect|solved)\b/i.test(content)
    ) {
      if (attempts.length > 0) {
        workingSolution = attempts[attempts.length - 1]!.suggestion;
      }
    }
  }

  if (attempts.length < 2) return null;
  return { attempts, workingSolution };
}

// ── Code version tracking ──
// If code block appears in msg 3 and updated version in msg 15, drop msg 3's version
function findSupersededCode(messages: Message[]): Set<number> {
  const codeBlocksByContent = new Map<
    string,
    { index: number; code: string }[]
  >();

  for (const msg of messages) {
    const codeBlocks = msg.content.match(/```\w*\n([\s\S]*?)```/g) ?? [];
    for (const block of codeBlocks) {
      // Extract function/class name as key
      const nameMatch = block.match(
        /(?:function|def|func|fn|class|const|let|var)\s+(\w+)/
      );
      if (nameMatch) {
        const name = nameMatch[1]!;
        if (!codeBlocksByContent.has(name)) {
          codeBlocksByContent.set(name, []);
        }
        codeBlocksByContent.get(name)!.push({
          index: msg.index,
          code: block,
        });
      }
    }
  }

  // Mark older versions as superseded
  const superseded = new Set<number>();
  for (const [, versions] of codeBlocksByContent) {
    if (versions.length > 1) {
      // Keep only the latest version
      const sorted = versions.sort((a, b) => a.index - b.index);
      for (let i = 0; i < sorted.length - 1; i++) {
        superseded.add(sorted[i]!.index);
      }
    }
  }

  return superseded;
}

// ── AI response summarization ──
// Compress verbose assistant responses to key points
function summarizeAssistantResponse(text: string): string {
  // If short enough, keep as-is
  if (text.length < 200) return text;

  const lines = text.split("\n");
  const keyLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Keep: headers, bullet points, code, key statements
    if (/^#{1,3}\s/.test(trimmed)) {
      keyLines.push(trimmed);
    } else if (/^[-*]\s/.test(trimmed)) {
      keyLines.push(trimmed);
    } else if (/^```/.test(trimmed)) {
      keyLines.push(trimmed);
    } else if (/\b(?:solution|fix|answer|result|key|important|note)\b/i.test(trimmed)) {
      keyLines.push(trimmed);
    } else if (/^\d+\.\s/.test(trimmed)) {
      keyLines.push(trimmed);
    }
  }

  // Keep code blocks intact
  const codeBlocks = text.match(/```[\s\S]*?```/g) ?? [];

  if (keyLines.length === 0 && codeBlocks.length === 0) {
    // Fallback: first and last sentence
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 10);
    if (sentences.length > 2) {
      return `${sentences[0]!.trim()}. [...] ${sentences[sentences.length - 1]!.trim()}.`;
    }
    return text;
  }

  let summary = keyLines.join("\n");
  for (const block of codeBlocks) {
    if (!summary.includes(block)) {
      summary += "\n" + block;
    }
  }

  const omitted = lines.length - keyLines.length;
  if (omitted > 5) {
    summary += `\n[${omitted} lines summarized]`;
  }

  return summary;
}

// ── Repeated context detection ──
// User explains same thing in msg 1, 5, 12 → keep most complete
function deduplicateRepeatedContext(messages: Message[]): Map<number, string> {
  const replacements = new Map<number, string>();
  const userMessages = messages.filter((m) => m.role === "user");

  for (let i = 0; i < userMessages.length; i++) {
    for (let j = i + 1; j < userMessages.length; j++) {
      const a = userMessages[i]!;
      const b = userMessages[j]!;

      const topicsA = new Set(extractTopics(a.content));
      const topicsB = new Set(extractTopics(b.content));

      let overlap = 0;
      for (const t of topicsA) {
        if (topicsB.has(t)) overlap++;
      }

      const overlapRatio =
        overlap / Math.min(topicsA.size, topicsB.size);

      // >60% topic overlap = repeated context
      if (overlapRatio > 0.6 && topicsA.size > 3) {
        // Keep the longer (more complete) version, mark shorter for replacement
        if (a.content.length >= b.content.length) {
          replacements.set(b.index, `[repeated context — see message ${a.index + 1}]`);
        } else {
          replacements.set(a.index, `[repeated context — see message ${b.index + 1}]`);
        }
      }
    }
  }

  return replacements;
}

// ── Breathing archive ──
export class BreathingArchive {
  private archive: Map<number, ArchivedMessage> = new Map();
  private archivePath: string | null;

  constructor(archivePath?: string) {
    this.archivePath = archivePath ?? null;
  }

  // Archive a message (move to cold storage)
  store(message: Message, summary: string): void {
    this.archive.set(message.index, {
      original: message,
      summary,
      topics: extractTopics(message.content),
      timestamp: Date.now(),
    });
  }

  // Check if current message references an archived topic
  findRelevant(currentMessage: string): ArchivedMessage[] {
    const currentTopics = new Set(extractTopics(currentMessage));
    const relevant: ArchivedMessage[] = [];

    for (const [, archived] of this.archive) {
      let matches = 0;
      for (const topic of archived.topics) {
        if (currentTopics.has(topic)) matches++;
      }
      // If >30% of archived topics match current message, it's relevant
      if (matches > 0 && matches / archived.topics.length > 0.3) {
        relevant.push(archived);
      }
    }

    return relevant;
  }

  // Restore specific archived messages (warm up from cold storage)
  restore(indices: number[]): Message[] {
    return indices
      .map((i) => this.archive.get(i)?.original)
      .filter((m): m is Message => m !== undefined);
  }

  // Persist to disk
  async save(): Promise<void> {
    if (!this.archivePath) return;
    try {
      const data = Object.fromEntries(this.archive);
      await Bun.write(this.archivePath, JSON.stringify(data, null, 2));
    } catch {
      // Silent — never block on archiving
    }
  }

  // Load from disk
  async load(): Promise<void> {
    if (!this.archivePath) return;
    try {
      const file = Bun.file(this.archivePath);
      if (await file.exists()) {
        const data = (await file.json()) as Record<string, ArchivedMessage>;
        for (const [key, value] of Object.entries(data)) {
          this.archive.set(Number(key), value);
        }
      }
    } catch {
      // Silent — start fresh if archive is corrupt
    }
  }

  // Session cleanup — delete archive file (privacy)
  async cleanup(): Promise<void> {
    if (!this.archivePath) return;
    try {
      const { unlinkSync } = await import("fs");
      unlinkSync(this.archivePath);
    } catch {
      // File might not exist
    }
    this.archive.clear();
  }

  get size(): number {
    return this.archive.size;
  }
}

// ── Main history compressor ──
export function compressHistory(
  messages: Message[],
  config: CompressionConfig,
  historyConfig: HistoryConfig = { windowSize: 10 },
  archive?: BreathingArchive,
  currentMessage?: string
): Message[] {
  if (messages.length <= historyConfig.windowSize) {
    return messages; // all within window, no compression needed
  }

  const windowStart = messages.length - historyConfig.windowSize;
  const recentMessages = messages.slice(windowStart);
  const oldMessages = messages.slice(0, windowStart);

  // Check breathing archive for relevant context
  let restoredMessages: Message[] = [];
  if (archive && currentMessage) {
    const relevant = archive.findRelevant(currentMessage);
    restoredMessages = relevant.map((a) => a.original);
  }

  // Find superseded code versions
  const supersededCode = findSupersededCode(messages);

  // Find repeated context
  const repeatedContext = deduplicateRepeatedContext(oldMessages);

  // Detect failed attempts
  const attemptSequence = detectFailedAttempts(messages);

  // Compress old messages
  const compressed: Message[] = [];

  for (const msg of oldMessages) {
    // Skip messages with superseded code (newer version exists)
    if (supersededCode.has(msg.index)) {
      // Archive before dropping
      archive?.store(msg, `[code superseded in later message]`);
      continue;
    }

    // Skip failed attempts if we have a working solution
    if (attemptSequence?.workingSolution) {
      const isFailedAttempt = attemptSequence.attempts.some(
        (a) => a.failed && a.index === msg.index
      );
      if (isFailedAttempt) {
        archive?.store(msg, `[failed attempt — solution found later]`);
        continue;
      }
    }

    // Replace repeated context
    if (repeatedContext.has(msg.index)) {
      const replacement = repeatedContext.get(msg.index)!;
      archive?.store(msg, replacement);
      compressed.push({ ...msg, content: replacement });
      continue;
    }

    // Decisions/constraints — never compress
    if (isDecisionOrConstraint(msg.content)) {
      compressed.push(msg);
      continue;
    }

    // Acknowledgments — compress verbose ones
    if (msg.role === "user") {
      const ack = compressAcknowledgment(msg.content);
      if (ack !== msg.content) {
        archive?.store(msg, ack);
        compressed.push({ ...msg, content: ack });
        continue;
      }
    }

    // Assistant verbose responses — summarize
    if (msg.role === "assistant" && msg.content.length > 200) {
      const summary = summarizeAssistantResponse(msg.content);
      if (summary.length < msg.content.length * 0.7) {
        archive?.store(msg, summary);
        compressed.push({ ...msg, content: summary });
        continue;
      }
    }

    // Apply Layer 1 message compression to remaining old messages
    const { compressed: l1Compressed } = compressMessage(
      msg.content,
      config.tier
    );
    if (l1Compressed.length < msg.content.length) {
      archive?.store(msg, l1Compressed);
      compressed.push({ ...msg, content: l1Compressed });
    } else {
      compressed.push(msg);
    }
  }

  // Combine: compressed old + restored from archive + recent in full
  return [...compressed, ...restoredMessages, ...recentMessages];
}

// ── Layer interface ──
// Note: Layer 5 operates on message arrays, not single strings.
// The pipeline calls it differently than other layers.
// For single-string pipeline compatibility, it passes through.
export const layer5: Layer = {
  name: "history-compressor",
  process(text: string, _config: CompressionConfig): string {
    // Layer 5 works on message arrays, not single strings.
    // The SDK client calls compressHistory() directly.
    // Pipeline pass-through for single messages.
    return text;
  },
};

export { extractTopics, isDecisionOrConstraint, summarizeAssistantResponse };
