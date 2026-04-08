import type { CompressionRule } from "../types/index.ts";

// Language-agnostic rules: emojis, punctuation, whitespace
export const coreRules: CompressionRule[] = [
  // ── Emojis (full unicode emoji ranges) ──
  {
    name: "strip-emojis",
    pattern:
      /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]+/gu,
    replacement: "",
    tier: "A",
  },

  // ── Typed emoticons ──
  {
    name: "strip-emoticons",
    pattern: /(?<!\w)[:;][-']?[)(DPp|/\\](?!\w)|<3|<\/3|\bxD\b/gi,
    replacement: "",
    tier: "A",
  },

  // ── Multiple punctuation ──
  {
    name: "collapse-question-marks",
    pattern: /\?{2,}/g,
    replacement: "?",
    tier: "A",
  },
  {
    name: "collapse-exclamation-marks",
    pattern: /!{2,}/g,
    replacement: "!",
    tier: "A",
  },

  // ── Ellipsis overuse ──
  {
    name: "collapse-ellipsis",
    pattern: /\.{3,}/g,
    replacement: "...",
    tier: "A",
  },

  // ── Excessive line breaks ──
  {
    name: "collapse-blank-lines",
    pattern: /\n{3,}/g,
    replacement: "\n\n",
    tier: "A",
  },

  // ── Trailing whitespace ──
  {
    name: "trim-trailing-spaces",
    pattern: /[ \t]+$/gm,
    replacement: "",
    tier: "A",
  },

  // ── Unnecessary markdown in casual messages ──
  {
    name: "strip-casual-bold",
    pattern: /\*\*([^*]+)\*\*/g,
    replacement: "$1",
    tier: "A",
  },
  {
    name: "strip-casual-italic",
    pattern: /(?<!\*)\*([^*]+)\*(?!\*)/g,
    replacement: "$1",
    tier: "A",
  },
  {
    name: "strip-casual-underline-emphasis",
    pattern: /__([^_]+)__/g,
    replacement: "$1",
    tier: "A",
  },

  // ── Encoding cleanup (malformed chars from copy-paste) ──
  {
    name: "fix-encoding-garbage",
    pattern: /\uFFFD+/g,
    replacement: "",
    tier: "A",
  },
  {
    name: "fix-smart-quotes-encoded",
    pattern: /â€[™œ\x9C\x9D]/g,
    replacement: "'",
    tier: "A",
  },
  {
    name: "fix-stray-A-hat",
    pattern: /Â(?=\s)/g,
    replacement: "",
    tier: "A",
  },
];
