import type { Layer, CompressionConfig } from "../types/index.ts";
import { compressMessage } from "./layer1-message.ts";

// ── Section classification ──
type SectionType = "static" | "semi-static" | "dynamic";

interface PromptSection {
  type: SectionType;
  content: string;
  label: string;
}

// Patterns that indicate static content (rarely changes)
const STATIC_PATTERNS = [
  /^you are\b/im,
  /^(?:role|persona|identity)[\s:]/im,
  /^(?:instructions|rules|guidelines|principles)[\s:]/im,
  /^(?:always|never|do not|don't)\b/im,
  /^(?:format|style|tone)[\s:]/im,
];

// Patterns that indicate semi-static content (changes per session)
const SEMI_STATIC_PATTERNS = [
  /^(?:tools?|skills?|capabilities)[\s:]/im,
  /^(?:memory|context|background)[\s:]/im,
  /^(?:available|enabled|active)[\s:]/im,
];

// Patterns that indicate dynamic content (changes per message)
const DYNAMIC_PATTERNS = [
  /^(?:current|today|now|recent)[\s:]/im,
  /^(?:user|message|request|query)[\s:]/im,
  /^(?:conversation|session|chat)[\s:]/im,
  /\b(?:timestamp|date|time)\b/i,
];

function classifySection(text: string): SectionType {
  for (const pattern of DYNAMIC_PATTERNS) {
    if (pattern.test(text)) return "dynamic";
  }
  for (const pattern of SEMI_STATIC_PATTERNS) {
    if (pattern.test(text)) return "semi-static";
  }
  for (const pattern of STATIC_PATTERNS) {
    if (pattern.test(text)) return "static";
  }
  // Default: static (most system prompt content is stable)
  return "static";
}

// ── Negative instruction deduplication ──
// "do NOT do X, do NOT do Y, never do Z, don't do W" → single consolidated rule
function deduplicateNegativeInstructions(text: string): string {
  // Collect all negative instructions
  const negativePatterns = [
    /\bdo\s+not\s+(.+?)(?:[.;,]|$)/gim,
    /\bdon'?t\s+(.+?)(?:[.;,]|$)/gim,
    /\bnever\s+(.+?)(?:[.;,]|$)/gim,
    /\bavoid\s+(.+?)(?:[.;,]|$)/gim,
  ];

  const negatives: { original: string; action: string }[] = [];

  for (const pattern of negativePatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      negatives.push({
        original: match[0].trim(),
        action: match[1]!.trim().toLowerCase(),
      });
    }
  }

  if (negatives.length <= 1) return text;

  // Group by similar action (word overlap)
  const groups: Map<string, typeof negatives> = new Map();
  for (const neg of negatives) {
    const words = neg.action.split(/\s+/).filter((w) => w.length > 2);
    let matched = false;

    for (const [key, group] of groups) {
      const keyWords = key.split(/\s+/);
      const overlap = words.filter((w) => keyWords.includes(w)).length;
      if (overlap > 0 && overlap / Math.min(words.length, keyWords.length) > 0.5) {
        group.push(neg);
        matched = true;
        break;
      }
    }

    if (!matched) {
      groups.set(neg.action, [neg]);
    }
  }

  // For groups of 2+, keep only the most specific version
  let result = text;
  for (const [, group] of groups) {
    if (group.length < 2) continue;

    // Keep the longest (most specific) instruction
    const longest = group.reduce((a, b) =>
      a.original.length >= b.original.length ? a : b
    );

    // Remove duplicates
    for (const neg of group) {
      if (neg !== longest) {
        result = result.replace(neg.original, "");
      }
    }
  }

  // Clean up leftover whitespace
  result = result.replace(/\n{3,}/g, "\n\n").trim();

  return result;
}

// ── Rule + example collapsing ──
// If a rule has examples and the rule alone is clear enough, drop examples
function collapseRuleExamples(text: string): string {
  // Pattern: instruction line followed by example block
  return text.replace(
    /^((?:[-*]\s+|>\s+|\d+\.\s+).{20,})\n((?:\s+(?:Example|e\.g\.|For (?:example|instance)).*\n?)+)/gim,
    (match, rule: string, examples: string) => {
      // Keep examples if they're short (adds < 50 chars)
      if (examples.trim().length < 50) return match;
      // Keep if rule references "see example" or "as shown"
      if (/\b(?:see|shown|below|above)\b/i.test(rule)) return match;
      // Otherwise, drop examples
      return rule + "\n";
    }
  );
}

// ── Section relevance filtering ──
// Given current message context, strip irrelevant sections
function filterRelevantSections(
  text: string,
  relevantContexts?: string[]
): string {
  if (!relevantContexts || relevantContexts.length === 0) return text;

  const contextWords = new Set(
    relevantContexts.flatMap((c) =>
      c
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 3)
    )
  );

  // Split into sections (by headers or blank line groups)
  const sections = text.split(/\n(?=#{1,3}\s|(?:[-*]\s){3,}|={3,}|-{3,})/);

  const filtered = sections.filter((section) => {
    // Always keep short sections (likely core rules)
    if (section.length < 100) return true;

    // Keep sections that mention relevant context
    const sectionLower = section.toLowerCase();
    for (const word of contextWords) {
      if (sectionLower.includes(word)) return true;
    }

    // Keep sections that look like core rules (not tool/skill descriptions)
    if (/^(?:you are|always|never|important|critical|rule)/im.test(section)) return true;

    return false;
  });

  return filtered.join("\n");
}

// ── Cache structure optimization ──
export interface CacheBreakpoint {
  position: number; // character offset in text
  type: "ephemeral"; // Anthropic cache_control type
  section: "static" | "semi-static";
}

interface CacheStructuredPrompt {
  text: string;
  cacheBreakpoints: CacheBreakpoint[];
}

function structureForCache(sections: PromptSection[]): CacheStructuredPrompt {
  // Reorder: static → semi-static → dynamic
  const ordered = [
    ...sections.filter((s) => s.type === "static"),
    ...sections.filter((s) => s.type === "semi-static"),
    ...sections.filter((s) => s.type === "dynamic"),
  ];

  const parts: string[] = [];
  const breakpoints: CacheBreakpoint[] = [];
  let currentPos = 0;

  // Static block
  const staticParts = ordered.filter((s) => s.type === "static");
  if (staticParts.length > 0) {
    const staticText = staticParts.map((s) => s.content).join("\n\n");
    parts.push(staticText);
    currentPos += staticText.length;
    breakpoints.push({
      position: currentPos,
      type: "ephemeral",
      section: "static",
    });
  }

  // Semi-static block
  const semiStaticParts = ordered.filter((s) => s.type === "semi-static");
  if (semiStaticParts.length > 0) {
    const semiText = semiStaticParts.map((s) => s.content).join("\n\n");
    parts.push(semiText);
    currentPos += semiText.length + 2; // +2 for \n\n join
    breakpoints.push({
      position: currentPos,
      type: "ephemeral",
      section: "semi-static",
    });
  }

  // Dynamic block
  const dynamicParts = ordered.filter((s) => s.type === "dynamic");
  if (dynamicParts.length > 0) {
    const dynamicText = dynamicParts.map((s) => s.content).join("\n\n");
    parts.push(dynamicText);
  }

  return {
    text: parts.join("\n\n"),
    cacheBreakpoints: breakpoints,
  };
}

// ── Section deduplication ──
function deduplicateSections(sections: PromptSection[]): PromptSection[] {
  const seen = new Set<string>();
  return sections.filter((section) => {
    // Normalize for comparison
    const norm = section.content
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();

    // Check for high overlap with already-seen content
    for (const existing of seen) {
      if (computeOverlap(norm, existing) > 0.7) return false;
    }

    seen.add(norm);
    return true;
  });
}

function computeOverlap(a: string, b: string): number {
  const wordsA = new Set(a.split(" "));
  const wordsB = new Set(b.split(" "));
  let overlap = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) overlap++;
  }
  return overlap / Math.max(wordsA.size, wordsB.size);
}

// ── Parse system prompt into sections ──
function parseSections(text: string): PromptSection[] {
  // Split by markdown headers or double newlines
  const rawSections = text.split(/\n(?=#{1,3}\s)/);

  return rawSections.map((content) => {
    const headerMatch = content.match(/^(#{1,3})\s+(.+)/);
    const label = headerMatch?.[2] ?? "section";
    return {
      type: classifySection(content),
      content: content.trim(),
      label,
    };
  });
}

// ── Main system prompt compressor ──
export function compressSystemPrompt(
  text: string,
  config: CompressionConfig,
  options?: {
    relevantContexts?: string[];
    enableCacheStructuring?: boolean;
  }
): { text: string; cacheBreakpoints: CacheBreakpoint[] } {
  let result = text;

  // 1. Apply Layer 1 language trimming
  const { compressed } = compressMessage(result, config.tier);
  result = compressed;

  // 2. Deduplicate negative instructions
  result = deduplicateNegativeInstructions(result);

  // 3. Collapse rules with examples
  result = collapseRuleExamples(result);

  // 4. Filter irrelevant sections
  if (options?.relevantContexts) {
    result = filterRelevantSections(result, options.relevantContexts);
  }

  // 5. Parse, deduplicate, and restructure for caching
  let cacheBreakpoints: CacheBreakpoint[] = [];

  if (options?.enableCacheStructuring !== false) {
    const sections = parseSections(result);
    const deduped = deduplicateSections(sections);
    const structured = structureForCache(deduped);
    result = structured.text;
    cacheBreakpoints = structured.cacheBreakpoints;
  }

  return { text: result, cacheBreakpoints };
}

// ── Layer interface ──
export const layer4: Layer = {
  name: "system-prompt-compressor",
  process(text: string, config: CompressionConfig): string {
    if (!config.systemPrompt) return text;

    // Layer 4 only processes system prompt content
    // In the pipeline, it detects if the text looks like a system prompt
    // (contains instruction-like patterns) and compresses it
    // For the SDK wrapper, system prompts are passed directly
    const isSystemPrompt =
      /^you are\b/im.test(text) ||
      /^(?:instructions|rules|guidelines)[\s:]/im.test(text) ||
      /\b(?:do not|don't|never|always|must)\b/i.test(text) &&
        text.split("\n").length > 10;

    if (!isSystemPrompt) return text;

    const { text: compressed } = compressSystemPrompt(text, config);
    return compressed;
  },
};

// Export for testing
export {
  classifySection,
  deduplicateNegativeInstructions,
  collapseRuleExamples,
  filterRelevantSections,
  structureForCache,
  parseSections,
};
