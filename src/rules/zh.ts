import type { CompressionRule } from "../types/index.ts";

// Chinese compression rules
// Same tiers as English: A (safe), B (moderate), C (aggressive)

export const chineseRules: CompressionRule[] = [
  // ═══════ Tier A — always safe ═══════

  // Sentence-final particles (add tone but no information)
  {
    name: "strip-particle-a",
    pattern: /啊[。！]?/g,
    replacement: "",
    tier: "A",
  },
  {
    name: "strip-particle-ne",
    pattern: /呢[。？]?/g,
    replacement: "",
    tier: "A",
  },
  {
    name: "strip-particle-ba",
    pattern: /吧[。！]?/g,
    replacement: "",
    tier: "A",
  },
  {
    name: "strip-particle-ma",
    pattern: /嘛[。！]?/g,
    replacement: "",
    tier: "A",
  },
  {
    name: "strip-particle-la",
    pattern: /啦[。！]?/g,
    replacement: "",
    tier: "A",
  },
  {
    name: "strip-particle-lo",
    pattern: /咯[。！]?/g,
    replacement: "",
    tier: "A",
  },

  // Filler words
  {
    name: "strip-filler-ranhou",
    pattern: /然后[，,]?\s*/g,
    replacement: "",
    tier: "A",
  },
  {
    name: "strip-filler-jiushishuo",
    pattern: /就是说[，,]?\s*/g,
    replacement: "",
    tier: "A",
  },
  {
    name: "strip-filler-nage",
    pattern: /那个[，,]?\s*/g,
    replacement: "",
    tier: "A",
  },
  {
    name: "strip-filler-zhege",
    pattern: /这个[，,]?\s*/g,
    replacement: "",
    tier: "A",
  },
  {
    name: "strip-filler-jiu",
    pattern: /(?<=[\u4e00-\u9fff])就(?=[\u4e00-\u9fff])/g,
    replacement: "",
    tier: "A",
  },
  {
    name: "strip-filler-haoxiang",
    pattern: /好像[，,]?\s*/g,
    replacement: "",
    tier: "A",
  },
  {
    name: "strip-filler-daoshi",
    pattern: /倒是[，,]?\s*/g,
    replacement: "",
    tier: "A",
  },

  // Reaction words
  {
    name: "strip-reaction-haha-zh",
    pattern: /[哈呵嘿]{2,}/g,
    replacement: "",
    tier: "A",
  },

  // ═══════ Tier B — usually safe ═══════

  // Politeness prefixes
  {
    name: "strip-qingwen",
    pattern: /请问[，,]?\s*/g,
    replacement: "",
    tier: "B",
  },
  {
    name: "strip-mafan-ni",
    pattern: /麻烦你[，,]?\s*/g,
    replacement: "",
    tier: "B",
  },
  {
    name: "strip-buhao-yisi",
    pattern: /不好意思[，,]?\s*/g,
    replacement: "",
    tier: "B",
  },
  {
    name: "strip-qing-bang",
    pattern: /请帮我\s*/g,
    replacement: "",
    tier: "B",
  },
  {
    name: "strip-neng-bu-neng",
    pattern: /能不能\s*/g,
    replacement: "",
    tier: "B",
  },
  {
    name: "strip-ke-yi-ma",
    pattern: /可以吗[？?]?\s*/g,
    replacement: "",
    tier: "B",
  },

  // Hedging
  {
    name: "strip-wo-xiang",
    pattern: /我想(?:要|请你|问一下)\s*/g,
    replacement: "",
    tier: "B",
  },
  {
    name: "strip-wo-juede",
    pattern: /我觉得\s*/g,
    replacement: "",
    tier: "B",
  },

  // Verbose thanks
  {
    name: "strip-feichang-ganxie",
    pattern: /非常感谢[你您]?[！!。.]*\s*/g,
    replacement: "谢谢 ",
    tier: "B",
  },
  {
    name: "strip-tai-ganxie",
    pattern: /太感谢[你您]?了[！!。.]*\s*/g,
    replacement: "谢谢 ",
    tier: "B",
  },

  // ═══════ Tier C — aggressive ═══════

  // Demonstratives when obvious
  {
    name: "strip-zhe-ge-na-ge",
    pattern: /[这那]个(?=[\u4e00-\u9fff])/g,
    replacement: "",
    tier: "C",
  },

  // Redundant measure words in casual speech
  {
    name: "strip-yixia",
    pattern: /一下/g,
    replacement: "",
    tier: "C",
  },
];

// ── Language detection ──
export function isChinese(text: string): boolean {
  const chineseChars = text.match(/[\u4e00-\u9fff]/g)?.length ?? 0;
  return chineseChars > text.length * 0.1; // >10% Chinese characters
}

export function isEnglish(text: string): boolean {
  const englishChars = text.match(/[a-zA-Z]/g)?.length ?? 0;
  return englishChars > text.length * 0.3; // >30% English characters
}

export function isBilingual(text: string): boolean {
  return isChinese(text) && isEnglish(text);
}

// Get applicable Chinese rules by tier
export const allChineseRules = {
  A: chineseRules.filter((r) => r.tier === "A"),
  B: chineseRules.filter((r) => r.tier === "A" || r.tier === "B"),
  C: chineseRules,
};
