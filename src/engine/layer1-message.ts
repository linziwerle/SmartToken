import type {
  CompressionConfig,
  Layer,
  Tier,
  Tone,
  Intent,
  ToneIntent,
  CompressionRule,
} from "../types/index.ts";
import { coreRules } from "../rules/core.ts";
import { allEnglishRules } from "../rules/en.ts";
import { allChineseRules, isChinese, isBilingual } from "../rules/zh.ts";

// ── Code block protection ──
const CODE_BLOCK_RE = /```[\s\S]*?```/g;

interface CodeBlockPlaceholder {
  placeholder: string;
  content: string;
}

function extractCodeBlocks(text: string): {
  stripped: string;
  blocks: CodeBlockPlaceholder[];
} {
  const blocks: CodeBlockPlaceholder[] = [];
  let i = 0;
  const stripped = text.replace(CODE_BLOCK_RE, (match) => {
    const placeholder = `__CODE_BLOCK_${i}__`;
    blocks.push({ placeholder, content: match });
    i++;
    return placeholder;
  });
  return { stripped, blocks };
}

function restoreCodeBlocks(
  text: string,
  blocks: CodeBlockPlaceholder[]
): string {
  let result = text;
  for (const { placeholder, content } of blocks) {
    result = result.replace(placeholder, content);
  }
  return result;
}

// ── Tone detection ──
const tonePatterns: { tone: Tone; patterns: RegExp[] }[] = [
  {
    tone: "polite",
    patterns: [
      /\bplease\b/i,
      /\bthank(?:s| you)\b/i,
      /\bhope\b/i,
      /\bwould you\b/i,
      /\bcould you\b/i,
      /\bif you don't mind\b/i,
      /\bi appreciate\b/i,
    ],
  },
  {
    tone: "uncertain",
    patterns: [
      /\bi(?:'m| am) not sure\b/i,
      /\bmaybe\b/i,
      /\bperhaps\b/i,
      /\bi (?:think|guess|suppose)\b/i,
      /\bnot really sure\b/i,
      /\bi don't know\b/i,
      /\?\s*$/m,
    ],
  },
  {
    tone: "frustrated",
    patterns: [
      /\bstill\b.*\b(?:broken|failing|not working)\b/i,
      /\bwhy (?:is|does|won't|can't|isn't)\b/i,
      /[?!]{2,}/,
      /\bugh\b/i,
      /\bkeeps?\b.*\b(?:failing|breaking|crashing)\b/i,
    ],
  },
  {
    tone: "exploring",
    patterns: [
      /\bwhat if\b/i,
      /\bwhat about\b/i,
      /\balternative\b/i,
      /\bdifferent approach\b/i,
      /\bwondering\b/i,
      /\bconsider\b/i,
      /\bvs\.?\b/i,
      /\bor\b.*\binstead\b/i,
    ],
  },
  {
    tone: "urgent",
    patterns: [
      /\basap\b/i,
      /\burgent\b/i,
      /\bproduction\s+(?:is\s+)?down\b/i,
      /\bcritical\b/i,
      /\bblocking\b/i,
      /\bneed\s+(?:this\s+)?(?:fix|fixed|done)\s+(?:now|immediately|asap)\b/i,
    ],
  },
];

function detectTone(text: string): Tone[] {
  const detected: Tone[] = [];
  for (const { tone, patterns } of tonePatterns) {
    if (patterns.some((p) => p.test(text))) {
      detected.push(tone);
    }
  }
  return detected;
}

// ── Intent detection ──
const intentPatterns: { intent: Intent; patterns: RegExp[] }[] = [
  {
    intent: "confirm",
    patterns: [
      /\bis\s+(?:this|that)\s+(?:right|correct|okay|ok)\b/i,
      /\bdoes\s+(?:this|that)\s+(?:work|look)\b/i,
      /\bam\s+i\s+(?:right|correct|doing\s+(?:this|it)\s+right)\b/i,
      /\bvalidate\b/i,
    ],
  },
  {
    intent: "compare",
    patterns: [
      /\bvs\.?\b/i,
      /\bversus\b/i,
      /\bcompare\b/i,
      /\bdifference\s+between\b/i,
      /\bwhich\s+(?:is|one|should)\b/i,
      /\bor\b/i,
      /\bbetter\b/i,
    ],
  },
  {
    intent: "explain",
    patterns: [
      /\bexplain\b/i,
      /\bhow\s+does\b/i,
      /\bwhat\s+(?:is|are|does)\b/i,
      /\bwhy\s+(?:does|is|do)\b/i,
      /\bunderstand\b/i,
      /\bwhat's\b/i,
    ],
  },
  {
    intent: "fix",
    patterns: [
      /\bfix\b/i,
      /\bbug\b/i,
      /\berror\b/i,
      /\bbroken\b/i,
      /\bnot\s+working\b/i,
      /\bfailing\b/i,
      /\bcrash\b/i,
      /\bdebug\b/i,
    ],
  },
  {
    intent: "build",
    patterns: [
      /\bbuild\b/i,
      /\bcreate\b/i,
      /\bimplement\b/i,
      /\badd\b/i,
      /\bwrite\b/i,
      /\bset\s*up\b/i,
      /\bmake\b/i,
    ],
  },
  {
    intent: "review",
    patterns: [
      /\breview\b/i,
      /\bcheck\b/i,
      /\blook\s+(?:at|over)\b/i,
      /\bfeedback\b/i,
      /\bcritique\b/i,
      /\baudit\b/i,
    ],
  },
  {
    intent: "explore",
    patterns: [
      /\bexplore\b/i,
      /\bwhat\s+if\b/i,
      /\bconsider\b/i,
      /\bbrainstorm\b/i,
      /\bideas?\b/i,
      /\bpossibilit/i,
    ],
  },
];

function detectIntent(text: string): Intent | null {
  let best: { intent: Intent; score: number } | null = null;
  for (const { intent, patterns } of intentPatterns) {
    const score = patterns.filter((p) => p.test(text)).length;
    if (score > 0 && (!best || score > best.score)) {
      best = { intent, score };
    }
  }
  return best?.intent ?? null;
}

export function detectToneIntent(text: string): ToneIntent {
  return {
    tones: detectTone(text),
    intent: detectIntent(text),
  };
}

// ── Self-correction handling ──
// "X. Actually Y." → keep Y, tag uncertain
// "X because A. But Y because B." → keep both (exploring)
function handleSelfCorrection(text: string): string {
  // Simple contradiction: "X. Actually/No/Wait, Y"
  const simpleFlip =
    /^(.+?)[.!]\s*(?:actually|no|wait|never\s*mind)[,.]?\s+(.+)$/is;
  const match = text.match(simpleFlip);
  if (match) {
    const before = match[1]!.trim();
    const after = match[2]!.trim();
    // Check if there's reasoning on both sides (exploration, not flip)
    const hasReasonBefore = /\bbecause\b|\bsince\b|\bbut\b/i.test(before);
    const hasReasonAfter = /\bbecause\b|\bsince\b|\bbut\b/i.test(after);
    if (hasReasonBefore && hasReasonAfter) {
      return text; // exploration — keep both
    }
    return after; // simple flip — keep final
  }
  return text;
}

// ── Acknowledgment handling ──
function handleAcknowledgment(text: string): string {
  // Verbose thanks → short thanks
  const verboseThanks =
    /^(?:thank\s+you\s+so\s+much[,!.]*\s*(?:that\s+was\s+(?:really\s+)?helpful[,!.]*\s*)?(?:i\s+really\s+appreciate\s+(?:it|you|your\s+help|you\s+walking\s+me\s+through\s+that)[,!.]*\s*)?)+$/i;
  if (verboseThanks.test(text.trim())) {
    return "thanks";
  }
  // Short grounding signals — keep as-is
  const grounding = /^(?:got\s+it|ok(?:ay)?|makes\s+sense|thanks|understood)\.?$/i;
  if (grounding.test(text.trim())) {
    return text.trim();
  }
  return text;
}

// ── Redundancy handling ──
// Detect repeated statements and keep the more specific one
function handleRedundancy(text: string): string {
  // Split into sentences
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (sentences.length < 2) return text;

  // Extract significant words (skip stopwords) for overlap detection
  const stopwords = new Set([
    "i", "me", "my", "you", "your", "we", "our", "the", "a", "an",
    "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did",
    "to", "of", "in", "for", "on", "with", "at", "by", "from",
    "it", "its", "this", "that", "these", "those",
    "and", "but", "or", "so", "if", "then",
    "can", "could", "would", "should", "will",
    "not", "no", "don't", "doesn't", "isn't", "aren't",
  ]);

  function getSignificantWords(s: string): Set<string> {
    return new Set(
      s.toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .split(/\s+/)
        .filter((w) => w.length > 2 && !stopwords.has(w))
    );
  }

  // Compare consecutive sentence pairs for high overlap
  const kept: string[] = [];
  let skip = false;

  for (let i = 0; i < sentences.length; i++) {
    if (skip) {
      skip = false;
      continue;
    }

    const current = sentences[i]!;
    const next = sentences[i + 1];

    if (next) {
      const wordsA = getSignificantWords(current);
      const wordsB = getSignificantWords(next);

      if (wordsA.size > 0 && wordsB.size > 0) {
        // Count overlapping significant words
        let overlap = 0;
        for (const w of wordsA) {
          if (wordsB.has(w)) overlap++;
        }

        const overlapRatio = overlap / Math.min(wordsA.size, wordsB.size);

        // If >=50% overlap, keep the longer (more specific) sentence
        if (overlapRatio >= 0.5) {
          kept.push(current.length >= next.length ? current : next);
          skip = true; // skip next since we already handled it
          continue;
        }
      }
    }

    kept.push(current);
  }

  return kept.join(" ");
}

// "Can you help me? What I need is..." → second part only
function handleAskThenReask(text: string): string {
  const pattern =
    /^(?:can\s+you\s+help\s+me|i\s+need\s+(?:some\s+)?help|help\s+me\s+(?:with\s+)?(?:something|this))[.?!]*\s+(?:what\s+i\s+(?:need|want)\s+(?:is\s+(?:to\s+)?|to\s+))?/i;
  return text.replace(pattern, "");
}

// "So what I'm trying to do is build X. X needs Y, Z, and W." → "Build X with Y, Z, W."
function handleSummarizeThenStart(text: string): string {
  const pattern =
    /^(?:so\s+)?what\s+i(?:'m|\s+am)\s+trying\s+to\s+do\s+is\s+/i;
  return text.replace(pattern, "");
}

// ── Apply rules (skip code blocks) ──
function applyRules(text: string, rules: CompressionRule[]): string {
  let result = text;
  for (const rule of rules) {
    result = result.replace(rule.pattern, rule.replacement);
  }
  return result;
}

// ── Build tone/intent prefix ──
export function buildToneIntentPrefix(ti: ToneIntent): string {
  const tones = ti.tones.filter((t) => t !== "neutral");
  if (tones.length === 0 && !ti.intent) return "";
  const parts: string[] = [];
  if (tones.length > 0) parts.push(...tones);
  if (ti.intent) parts.push(ti.intent);
  return `[${parts.join(", ")}] `;
}

// ── Main compress function ──
export function compressMessage(
  text: string,
  tier: Tier = "B"
): { compressed: string; toneIntent: ToneIntent } {
  if (!text || text.trim().length === 0) {
    return { compressed: text, toneIntent: { tones: [], intent: null } };
  }

  // Detect tone/intent on original text
  const toneIntent = detectToneIntent(text);

  // Extract code blocks to protect them
  const { stripped, blocks } = extractCodeBlocks(text);

  // Check if it's purely an acknowledgment
  const ackResult = handleAcknowledgment(stripped);
  if (ackResult !== stripped) {
    return { compressed: ackResult, toneIntent };
  }

  // Handle self-correction
  let processed = handleSelfCorrection(stripped);

  // Handle redundancy patterns (Tier B+)
  if (tier === "B" || tier === "C") {
    processed = handleAskThenReask(processed);
    processed = handleSummarizeThenStart(processed);
    processed = handleRedundancy(processed);
  }

  // Apply core rules (language-agnostic)
  const applicableCoreRules = coreRules.filter((r) => {
    if (tier === "A") return r.tier === "A";
    if (tier === "B") return r.tier === "A" || r.tier === "B";
    return true;
  });
  processed = applyRules(processed, applicableCoreRules);

  // Apply language-specific rules by tier
  const englishRules = allEnglishRules[tier];
  processed = applyRules(processed, englishRules);

  // Apply Chinese rules if Chinese text detected
  if (isChinese(processed) || isBilingual(processed)) {
    const zhRules = allChineseRules[tier];
    processed = applyRules(processed, zhRules);
  }

  // Clean up artifacts from stripping (BEFORE restoring code blocks
  // so we don't destroy indentation inside code)
  processed = processed
    .replace(/  +/g, " ") // collapse multiple spaces
    .replace(/^ +/gm, "") // trim leading spaces per line
    .replace(/\n{3,}/g, "\n\n") // collapse blank lines
    .replace(/^[!.,;]+\s*/gm, "") // strip orphaned punctuation at line start
    .replace(/^(?:but|and|or)\s+/gim, "") // strip orphaned conjunctions at start
    .replace(/\s+([!.,;])/g, "$1") // close space before punctuation
    .replace(/\s+for\s+me\s*([?.!]?)$/gim, "$1") // strip trailing "for me"
    .trim();

  // Restore code blocks (after cleanup so indentation is preserved)
  processed = restoreCodeBlocks(processed, blocks);

  // Don't compress to empty — if everything was filler, keep a grounding signal
  if (processed.length === 0) {
    // Check if original was a thank-you or acknowledgment
    if (/\bthank/i.test(text)) {
      return { compressed: "thanks", toneIntent };
    }
    // Otherwise fall back to original (edge case safety)
    return { compressed: text.trim(), toneIntent };
  }

  // Add tone/intent prefix if meaningful
  const prefix = buildToneIntentPrefix(toneIntent);
  const compressed = prefix + processed;

  return { compressed, toneIntent };
}

// ── Layer interface ──
export const layer1: Layer = {
  name: "message-compressor",
  process(text: string, config: CompressionConfig): string {
    const { compressed } = compressMessage(text, config.tier);
    return compressed;
  },
};
