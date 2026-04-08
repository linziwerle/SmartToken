import type { CompressionRule } from "../types/index.ts";

// ═══════════════════════════════════════════════════════
//  Tier A — always safe
// ═══════════════════════════════════════════════════════
export const tierARules: CompressionRule[] = [
  // ── Reaction words ──
  {
    name: "strip-reaction-words",
    pattern: /\b(?:lol|lmao|lmfao|haha+|hehe+|rofl|omg)\b[.!]*/gi,
    replacement: "",
    tier: "A",
  },

  // ── Greetings ──
  {
    name: "strip-greetings",
    pattern:
      /^(?:hey\s+(?:claude|there|chatgpt|gpt|gemini|ai)|hi\s+there|hello(?:\s+there)?|hey|hi)[,!.\s]*(?=\S|$)/gim,
    replacement: "",
    tier: "A",
  },

  // ── Pleasantries ──
  {
    name: "strip-pleasantries-hope",
    pattern:
      /\b(?:i\s+hope\s+you(?:'re|\s+are)\s+doing\s+well|hope\s+(?:this|that)\s+(?:finds\s+you\s+well|helps|makes\s+sense))[.,!]*\s*/gi,
    replacement: "",
    tier: "A",
  },
  {
    name: "strip-thanks-advance",
    pattern: /\b(?:thanks?\s+(?:in\s+advance|so\s+much|a\s+lot|a\s+bunch))[.!]*\s*/gi,
    replacement: "",
    tier: "A",
  },
  {
    name: "strip-verbose-thanks",
    pattern:
      /\bthank\s+you\s+(?:so\s+much|very\s+much|for\s+(?:your\s+)?(?:help|time|assistance|patience))[.,!]*\s*/gi,
    replacement: "thanks. ",
    tier: "A",
  },

  // ── Thinking filler sounds (before other filler so cascading works) ──
  {
    name: "strip-thinking-hmm",
    pattern: /\b(?:hmm+|hm+|umm*|uh+)[,.]?\s*/gi,
    replacement: "",
    tier: "A",
  },

  // ── Filler words ──
  {
    name: "strip-filler-basically",
    pattern: /\bbasically[,]?\s*/gi,
    replacement: "",
    tier: "A",
  },
  {
    name: "strip-filler-actually",
    pattern: /\bactually[,]?\s*/gi,
    replacement: "",
    tier: "A",
  },
  {
    name: "strip-filler-just",
    pattern: /\bjust\s+(?=\w)/gi,
    replacement: "",
    tier: "A",
  },
  {
    name: "strip-filler-like",
    pattern: /(?<=\s)like[,]?\s+(?=\w)/gi,
    replacement: "",
    tier: "A",
  },
  {
    name: "strip-filler-you-know",
    pattern: /\byou\s+know[,]?\s*/gi,
    replacement: "",
    tier: "A",
  },
  {
    name: "strip-filler-well",
    pattern: /^well[,]?\s+/gim,
    replacement: "",
    tier: "A",
  },
  {
    name: "strip-filler-so-start",
    pattern: /^so[,]?\s+(?!that\b|therefore\b)/gim,
    replacement: "",
    tier: "A",
  },
  {
    name: "strip-filler-i-mean",
    pattern: /\bi\s+mean[,]?\s*/gi,
    replacement: "",
    tier: "A",
  },
  {
    name: "strip-filler-kind-of",
    pattern: /\b(?:kind|sort)\s+of\s+/gi,
    replacement: "",
    tier: "A",
  },

  // ── Apologies ──
  {
    name: "strip-apology-bother",
    pattern: /\bsorry\s+to\s+(?:bother|bug|trouble)\s+you[.,]*\s*/gi,
    replacement: "",
    tier: "A",
  },
  {
    name: "strip-apology-simple",
    pattern:
      /\bi\s+know\s+(?:this\s+is\s+(?:simple|basic|easy|obvious|dumb|stupid)|this\s+(?:might|may)\s+be\s+(?:simple|basic|obvious))\s+but[,]?\s*/gi,
    replacement: "",
    tier: "A",
  },
  {
    name: "strip-apology-obvious",
    pattern: /\bsorry\s+if\s+(?:this\s+is|that's)\s+obvious[.,]*\s*/gi,
    replacement: "",
    tier: "A",
  },

  // ── Trailing thanks ──
  {
    name: "strip-trailing-thanks",
    pattern: /\n*\s*thanks?[.!]*\s*$/gi,
    replacement: "",
    tier: "A",
  },

  // ── Dashes as filler ──
  {
    name: "strip-filler-dashes",
    pattern: /(?:^|\s)(?:like|so|well|um|uh)\s*[—–-]\s*/gim,
    replacement: " ",
    tier: "A",
  },

  // ── Ellipsis stalling ──
  {
    name: "strip-trailing-ellipsis",
    pattern: /\.\.\.\s*$/gm,
    replacement: "",
    tier: "A",
  },
];

// ═══════════════════════════════════════════════════════
//  Tier B — usually safe
// ═══════════════════════════════════════════════════════
export const tierBRules: CompressionRule[] = [
  // ── Pronoun stripping ──
  {
    name: "strip-i-want-to",
    pattern: /\bi\s+(?:want|need|would\s+like)\s+(?:to|you\s+to)\s+/gi,
    replacement: "",
    tier: "B",
  },
  {
    name: "strip-can-you",
    pattern: /\bcan\s+you\s+(?:please\s+)?/gi,
    replacement: "",
    tier: "B",
  },
  {
    name: "strip-could-you",
    pattern: /\bcould\s+you\s+(?:please\s+)?(?:maybe\s+)?/gi,
    replacement: "",
    tier: "B",
  },
  {
    name: "strip-you-could",
    pattern: /\byou\s+could\s+(?:please\s+)?(?:maybe\s+)?/gi,
    replacement: "",
    tier: "B",
  },
  {
    name: "strip-i-was-wondering",
    pattern: /\bi\s+was\s+wondering[,]?\s+(?:if\s+)?/gi,
    replacement: "",
    tier: "B",
  },
  {
    name: "strip-would-it-be-possible",
    pattern: /\bwould\s+it\s+be\s+possible\s+(?:to|for\s+you\s+to)\s+/gi,
    replacement: "",
    tier: "B",
  },

  // ── Standalone please ──
  {
    name: "strip-please",
    pattern: /\bplease\s+/gi,
    replacement: "",
    tier: "B",
  },

  // ── Help me / assist me ──
  {
    name: "strip-help-me",
    pattern: /\b(?:help|assist)\s+me\s+(?:to\s+)?/gi,
    replacement: "",
    tier: "B",
  },

  // ── Thinking out loud (Tier B — keep only the actual request) ──
  {
    name: "strip-thinking-let-me-think",
    pattern: /\b(?:let\s+me\s+think|let\s+me\s+see)[.,]*\s*/gi,
    replacement: "",
    tier: "B",
  },
  {
    name: "strip-thinking-i-guess",
    pattern: /\bi\s+guess\s+(?:what\s+)?(?:i\s+)?(?:really\s+)?(?:want|need|mean)\s+(?:is|to)\s+/gi,
    replacement: "",
    tier: "B",
  },
  {
    name: "strip-thinking-so-what-im",
    pattern: /\b(?:so\s+)?what\s+i(?:'m|\s+am)\s+(?:really\s+)?(?:trying\s+to\s+(?:do|say|get\s+at)|looking\s+for)\s+is\s+/gi,
    replacement: "",
    tier: "B",
  },

  // ── Pronoun framing ──
  {
    name: "strip-i-verbed-this-and",
    pattern: /\bi\s+(?:wrote|created|made|built|have|got)\s+(?:this|a|the)\s+(\w+)\s+and\s+/gi,
    replacement: "$1 — ",
    tier: "B",
  },
  {
    name: "strip-i-have-this",
    pattern: /\bi\s+have\s+(?:this|a)\s+(?=\w+\s+(?:that|which|and))/gi,
    replacement: "",
    tier: "B",
  },

  // ── Over-explanation of intent (catch enumerated synonyms) ──
  {
    name: "strip-over-explain-adjective-chain",
    pattern: /\bso\s+(?:that\s+)?it(?:'s|\s+is)\s+(\w+)\s+and\s+(?:more\s+)?(\w+)(?:\s+and\s+(?:(?:more|easier)\s+(?:to\s+)?)?\w+)+/gi,
    replacement: "— $1, $2",
    tier: "B",
  },
  {
    name: "strip-over-explain-to-make-it",
    pattern: /\b(?:to|and)\s+make\s+(?:it|this|the\s+code)\s+(?:more\s+)?(\w+)(?:\s+and\s+(?:more\s+)?\w+)+/gi,
    replacement: "— $1",
    tier: "B",
  },

  // ── Narrating actions ──
  {
    name: "strip-narrating-paste",
    pattern:
      /\b(?:i'm\s+going\s+to|i'll|let\s+me)\s+(?:paste|share|show|post|send)\s+(?:my\s+)?(?:code|error|output|log|file)s?\s+(?:below|here|now)[.:,]*\s*/gi,
    replacement: "",
    tier: "B",
  },
  {
    name: "strip-narrating-here-is",
    pattern: /\bhere(?:'s|\s+is)\s+(?:my|the)\s+(?:code|error|output|log|file|screenshot)[.:,]*\s*/gi,
    replacement: "",
    tier: "B",
  },

  // ── Permission asking ──
  {
    name: "strip-permission",
    pattern:
      /\b(?:is\s+it\s+okay?\s+if\s+i|do\s+you\s+mind\s+if\s+i|if\s+it's\s+not\s+too\s+much\s+trouble)[,]?\s*/gi,
    replacement: "",
    tier: "B",
  },

  // ── Softening ──
  {
    name: "strip-softening-dumb-question",
    pattern:
      /\b(?:this\s+(?:might|may)\s+be\s+a\s+(?:dumb|stupid|silly|basic|noob)\s+question\s+but)[,]?\s*/gi,
    replacement: "",
    tier: "B",
  },
  {
    name: "strip-softening-not-sure",
    pattern: /\bi'm\s+not\s+(?:sure|certain)\s+(?:if|but|whether)[,]?\s*/gi,
    replacement: "",
    tier: "B",
  },

  // ── Validation seeking ──
  {
    name: "strip-validation-end",
    pattern:
      /[.,]?\s*(?:does\s+that\s+make\s+sense|(?:do\s+you\s+)?know\s+what\s+i\s+mean|right|yeah)\s*\?\s*$/gim,
    replacement: "",
    tier: "B",
  },

  // ── Hedging ──
  {
    name: "strip-do-you-think",
    pattern: /\bdo\s+you\s+think\s+(?:maybe\s+)?(?:I\s+should\s+)?/gi,
    replacement: "",
    tier: "B",
  },
  {
    name: "strip-I-should",
    pattern: /\bmaybe\s+I\s+should\s+/gi,
    replacement: "",
    tier: "B",
  },

  // ── Excessive context-setting preamble ──
  {
    name: "strip-been-working-on",
    pattern:
      /\b(?:i've\s+been|i\s+have\s+been|we've\s+been|we\s+have\s+been)\s+(?:working\s+on|struggling\s+with|trying\s+to\s+(?:figure\s+out|fix|solve|work\s+on))\s+(?:this|it)\s+(?:for\s+(?:a\s+while|hours|days|weeks|a\s+long\s+time))[.,]?\s*(?:and\s+)?/gi,
    replacement: "",
    tier: "B",
  },

  // ── Unnecessary markdown in casual messages ──
  {
    name: "strip-colons-before-code",
    pattern: /:\s*(?=\n```)/g,
    replacement: "\n",
    tier: "B",
  },
];

// ═══════════════════════════════════════════════════════
//  Tier C — aggressive
// ═══════════════════════════════════════════════════════
export const tierCRules: CompressionRule[] = [
  // ── Articles ──
  {
    name: "strip-articles",
    pattern: /\b(?:a|an|the)\s+(?=\w)/gi,
    replacement: "",
    tier: "C",
  },

  // ── Linking verbs in simple statements ──
  {
    name: "strip-is-are",
    pattern: /\b(?:is|are|was|were)\s+/gi,
    replacement: "",
    tier: "C",
  },

  // ── Vague quantifiers ──
  {
    name: "strip-vague-quantifiers",
    pattern: /\b(?:very|really|many|some|quite|pretty\s+much|rather)\s+/gi,
    replacement: "",
    tier: "C",
  },

  // ── Demonstratives (only when not comparative) ──
  {
    name: "strip-demonstrative-this",
    pattern: /\bthis\s+(?!(?:vs|versus|or|compared\s+to|approach|way)\b)/gi,
    replacement: "",
    tier: "C",
  },

  // ── Droppable prepositions ──
  {
    name: "strip-preposition-that",
    pattern: /\bthat\s+(?=\w)/gi,
    replacement: "",
    tier: "C",
  },
  {
    name: "strip-preposition-for-in-article",
    pattern: /\b(?:for|in)\s+(?:the|a|an)\s+/gi,
    replacement: "",
    tier: "C",
  },
  {
    name: "strip-preposition-of-the",
    pattern: /\bof\s+(?:the|a|an)\s+/gi,
    replacement: "",
    tier: "C",
  },
  {
    name: "strip-preposition-for-standalone",
    pattern: /\bfor\s+(?=\w+(?:\s|$|[.,;?!]))/gi,
    replacement: "",
    tier: "C",
  },
];

export const allEnglishRules = {
  A: tierARules,
  B: [...tierARules, ...tierBRules],
  C: [...tierARules, ...tierBRules, ...tierCRules],
};
