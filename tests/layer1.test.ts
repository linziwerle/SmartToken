import { test, expect, describe } from "bun:test";
import {
  compressMessage,
  detectToneIntent,
  buildToneIntentPrefix,
} from "../src/engine/layer1-message.ts";

// ═══════════════════════════════════════════════════════
//  Tier A tests
// ═══════════════════════════════════════════════════════
describe("Tier A — always safe", () => {
  test("strips emojis", () => {
    const { compressed } = compressMessage("Fix this bug 😊🙏", "A");
    expect(compressed).not.toContain("😊");
    expect(compressed).not.toContain("🙏");
    expect(compressed).toContain("Fix this bug");
  });

  test("strips typed emoticons", () => {
    const { compressed } = compressMessage("Thanks :) <3", "A");
    expect(compressed).not.toContain(":)");
    expect(compressed).not.toContain("<3");
  });

  test("strips reaction words", () => {
    const { compressed } = compressMessage("lol that's funny haha", "A");
    expect(compressed).not.toMatch(/\blol\b/i);
    expect(compressed).not.toMatch(/\bhaha\b/i);
  });

  test("strips greetings", () => {
    const { compressed } = compressMessage(
      "Hey Claude, can you fix this?",
      "A"
    );
    expect(compressed).not.toMatch(/hey claude/i);
    expect(compressed).toContain("fix this");
  });

  test("strips hello/hi variants", () => {
    expect(compressMessage("Hi there, help me", "A").compressed).not.toMatch(
      /hi there/i
    );
    expect(compressMessage("Hello, review this", "A").compressed).not.toMatch(
      /hello/i
    );
  });

  test("strips pleasantries", () => {
    const { compressed } = compressMessage(
      "I hope you're doing well. Can you help?",
      "A"
    );
    expect(compressed).not.toMatch(/hope you're doing well/i);
  });

  test("strips thanks in advance", () => {
    const { compressed } = compressMessage(
      "Fix this bug. Thanks in advance!",
      "A"
    );
    expect(compressed).not.toMatch(/thanks in advance/i);
  });

  test("converts verbose thanks to short thanks", () => {
    const { compressed } = compressMessage(
      "Thank you so much for your help",
      "A"
    );
    expect(compressed).toContain("thanks");
    expect(compressed).not.toContain("so much");
  });

  test("strips filler words", () => {
    const { compressed } = compressMessage(
      "I basically just want to actually fix this",
      "A"
    );
    expect(compressed).not.toMatch(/\bbasically\b/i);
    expect(compressed).not.toMatch(/\bactually\b/i);
    expect(compressed).not.toMatch(/\bjust\b/i);
  });

  test("strips apologies", () => {
    const { compressed } = compressMessage(
      "Sorry to bother you, but can you help?",
      "A"
    );
    expect(compressed).not.toMatch(/sorry to bother/i);
  });

  test("strips 'I know this is simple but'", () => {
    const { compressed } = compressMessage(
      "I know this is simple but how do I loop?",
      "A"
    );
    expect(compressed).not.toMatch(/i know this is simple but/i);
    expect(compressed).toMatch(/how do.*loop/i);
  });

  test("collapses multiple punctuation", () => {
    const { compressed } = compressMessage("Why is this broken???", "A");
    expect(compressed).not.toContain("???");
    expect(compressed).toContain("?");
  });

  test("strips encoding garbage", () => {
    const { compressed } = compressMessage("Fix this ��� error", "A");
    expect(compressed).not.toContain("���");
  });

  test("keeps 'so' as logical conjunction", () => {
    const { compressed } = compressMessage(
      "X failed, so Y crashed too",
      "A"
    );
    expect(compressed).toMatch(/so/i);
  });

  test("strips 'so' as sentence-start filler", () => {
    const { compressed } = compressMessage(
      "So, I was thinking about this",
      "A"
    );
    expect(compressed).not.toMatch(/^so[,]?\s/i);
  });
});

// ═══════════════════════════════════════════════════════
//  Tier B tests
// ═══════════════════════════════════════════════════════
describe("Tier B — usually safe", () => {
  test("strips 'I want to'", () => {
    const { compressed } = compressMessage("I want to refactor this", "B");
    expect(compressed).not.toMatch(/i want to/i);
    expect(compressed).toMatch(/refactor/i);
  });

  test("strips 'Can you'", () => {
    const { compressed } = compressMessage("Can you review this?", "B");
    expect(compressed).not.toMatch(/can you/i);
    expect(compressed).toMatch(/review/i);
  });

  test("strips 'I was wondering if'", () => {
    const { compressed } = compressMessage(
      "I was wondering if you could help",
      "B"
    );
    expect(compressed).not.toMatch(/i was wondering/i);
  });

  test("strips narrating actions", () => {
    const { compressed } = compressMessage(
      "I'm going to paste my code below\n```js\nconst x = 1;\n```",
      "B"
    );
    expect(compressed).not.toMatch(/going to paste/i);
    expect(compressed).toContain("const x = 1;");
  });

  test("strips permission asking", () => {
    const { compressed } = compressMessage(
      "Is it okay if I ask you to help?",
      "B"
    );
    expect(compressed).not.toMatch(/is it okay if i/i);
  });

  test("strips softening", () => {
    const { compressed } = compressMessage(
      "This might be a dumb question but how do I sort?",
      "B"
    );
    expect(compressed).not.toMatch(/dumb question/i);
    expect(compressed).toMatch(/sort/i);
  });

  test("strips validation seeking at end", () => {
    const { compressed } = compressMessage(
      "Use a map here. Does that make sense?",
      "B"
    );
    expect(compressed).not.toMatch(/does that make sense/i);
    expect(compressed).toMatch(/map/i);
  });
});

// ═══════════════════════════════════════════════════════
//  Tier C tests
// ═══════════════════════════════════════════════════════
describe("Tier C — aggressive", () => {
  test("strips articles", () => {
    const { compressed } = compressMessage("Refactor the function", "C");
    expect(compressed).not.toMatch(/\bthe\b/i);
    expect(compressed).toMatch(/refactor/i);
    expect(compressed).toMatch(/function/i);
  });

  test("strips linking verbs", () => {
    const { compressed } = compressMessage("The build is broken", "C");
    expect(compressed).toMatch(/build/i);
    expect(compressed).toMatch(/broken/i);
  });

  test("strips vague quantifiers", () => {
    const { compressed } = compressMessage("There are very many bugs", "C");
    expect(compressed).not.toMatch(/\bvery\b/i);
    expect(compressed).not.toMatch(/\bmany\b/i);
  });
});

// ═══════════════════════════════════════════════════════
//  Tone detection
// ═══════════════════════════════════════════════════════
describe("Tone detection", () => {
  test("detects polite tone", () => {
    const ti = detectToneIntent("Could you please help me?");
    expect(ti.tones).toContain("polite");
  });

  test("detects uncertain tone", () => {
    const ti = detectToneIntent("I'm not sure if this is right?");
    expect(ti.tones).toContain("uncertain");
  });

  test("detects frustrated tone", () => {
    const ti = detectToneIntent("Why is this STILL broken??");
    expect(ti.tones).toContain("frustrated");
  });

  test("detects exploring tone", () => {
    const ti = detectToneIntent("What if we tried a different approach?");
    expect(ti.tones).toContain("exploring");
  });

  test("detects urgent tone", () => {
    const ti = detectToneIntent("Production is down, need fix ASAP");
    expect(ti.tones).toContain("urgent");
  });
});

// ═══════════════════════════════════════════════════════
//  Intent detection
// ═══════════════════════════════════════════════════════
describe("Intent detection", () => {
  test("detects compare intent", () => {
    const ti = detectToneIntent("dict vs list, which is better?");
    expect(ti.intent).toBe("compare");
  });

  test("detects fix intent", () => {
    const ti = detectToneIntent("Fix this bug");
    expect(ti.intent).toBe("fix");
  });

  test("detects build intent", () => {
    const ti = detectToneIntent("Create a login page");
    expect(ti.intent).toBe("build");
  });

  test("detects review intent", () => {
    const ti = detectToneIntent("Review this code");
    expect(ti.intent).toBe("review");
  });

  test("detects confirm intent", () => {
    const ti = detectToneIntent("Is this correct?");
    expect(ti.intent).toBe("confirm");
  });
});

// ═══════════════════════════════════════════════════════
//  Tone/Intent prefix
// ═══════════════════════════════════════════════════════
describe("Tone/Intent prefix", () => {
  test("builds prefix for polite + compare", () => {
    const prefix = buildToneIntentPrefix({
      tones: ["polite", "uncertain"],
      intent: "compare",
    });
    expect(prefix).toBe("[polite, uncertain, compare] ");
  });

  test("no prefix for neutral + no intent", () => {
    const prefix = buildToneIntentPrefix({ tones: [], intent: null });
    expect(prefix).toBe("");
  });

  test("no prefix for neutral tone", () => {
    const prefix = buildToneIntentPrefix({ tones: ["neutral"], intent: null });
    expect(prefix).toBe("");
  });
});

// ═══════════════════════════════════════════════════════
//  Self-correction handling
// ═══════════════════════════════════════════════════════
describe("Self-correction", () => {
  test("simple contradiction keeps final answer", () => {
    const { compressed } = compressMessage(
      "Make it blue. Actually make it red.",
      "A"
    );
    expect(compressed).toMatch(/red/i);
  });

  test("exploration with reasons keeps both", () => {
    const { compressed } = compressMessage(
      "REST is simpler because fewer endpoints. Actually GraphQL is better because nested data.",
      "A"
    );
    expect(compressed).toMatch(/REST|GraphQL/i);
  });
});

// ═══════════════════════════════════════════════════════
//  Acknowledgment handling
// ═══════════════════════════════════════════════════════
describe("Acknowledgment handling", () => {
  test("verbose thanks becomes short thanks", () => {
    const { compressed } = compressMessage(
      "Thank you so much that was really helpful I really appreciate you walking me through that!",
      "A"
    );
    expect(compressed).toBe("thanks");
  });

  test("keeps grounding signals as-is", () => {
    expect(compressMessage("got it", "A").compressed).toBe("got it");
    expect(compressMessage("ok", "A").compressed).toBe("ok");
    expect(compressMessage("makes sense", "A").compressed).toBe("makes sense");
  });
});

// ═══════════════════════════════════════════════════════
//  DO NOT TRIM
// ═══════════════════════════════════════════════════════
describe("DO NOT TRIM rules", () => {
  test("keeps constraints", () => {
    const { compressed } = compressMessage(
      "must work with Python 3.8",
      "C"
    );
    expect(compressed).toMatch(/Python 3\.8/);
  });

  test("keeps code blocks untouched", () => {
    const code = "```js\nconst x = 'hello there'; // just a test\n```";
    const { compressed } = compressMessage(
      `Hey Claude! ${code}`,
      "A"
    );
    expect(compressed).toContain("const x = 'hello there'; // just a test");
  });

  test("keeps conditionals", () => {
    const { compressed } = compressMessage(
      "if X do Y, but if Z do W",
      "B"
    );
    expect(compressed).toMatch(/if.*X/i);
    expect(compressed).toMatch(/if.*Z/i);
  });
});

// ═══════════════════════════════════════════════════════
//  Thinking out loud
// ═══════════════════════════════════════════════════════
describe("Thinking out loud", () => {
  test("strips hmm/umm filler sounds", () => {
    const { compressed } = compressMessage("Hmm umm I need a database", "A");
    expect(compressed).not.toMatch(/\bhmm\b/i);
    expect(compressed).not.toMatch(/\bumm\b/i);
    expect(compressed).toMatch(/database/i);
  });

  test("strips 'let me think' preamble", () => {
    const { compressed } = compressMessage(
      "Let me think... I guess what I really want is a sorted list",
      "B"
    );
    expect(compressed).not.toMatch(/let me think/i);
    expect(compressed).toMatch(/sorted list/i);
  });

  test("strips 'what I am trying to do is' preamble", () => {
    const { compressed } = compressMessage(
      "So what I am trying to do is build a REST API",
      "B"
    );
    expect(compressed).not.toMatch(/what i.m trying to do/i);
    expect(compressed).toMatch(/build.*API/i);
  });

  test("cascades hmm + so + basically", () => {
    const { compressed } = compressMessage(
      "Hmm umm so basically I need a database",
      "A"
    );
    expect(compressed).not.toMatch(/\bhmm\b/i);
    expect(compressed).not.toMatch(/\bumm\b/i);
    expect(compressed).not.toMatch(/\bbasically\b/i);
    expect(compressed).toMatch(/database/i);
  });
});

// ═══════════════════════════════════════════════════════
//  Unnecessary markdown
// ═══════════════════════════════════════════════════════
describe("Unnecessary markdown", () => {
  test("strips bold in casual messages", () => {
    const { compressed } = compressMessage(
      "I need to **fix** this bug",
      "A"
    );
    expect(compressed).not.toContain("**");
    expect(compressed).toMatch(/fix/);
  });

  test("strips italic in casual messages", () => {
    const { compressed } = compressMessage(
      "This is a *critical* issue",
      "A"
    );
    expect(compressed).not.toContain("*critical*");
    expect(compressed).toMatch(/critical/);
  });

  test("strips underscore emphasis", () => {
    const { compressed } = compressMessage(
      "Check the __auth__ module",
      "A"
    );
    expect(compressed).not.toContain("__");
    expect(compressed).toMatch(/auth/);
  });
});

// ═══════════════════════════════════════════════════════
//  Redundancy patterns
// ═══════════════════════════════════════════════════════
describe("Redundancy patterns", () => {
  test("ask then re-ask keeps second part", () => {
    const { compressed } = compressMessage(
      "Can you help me? What I need is to fix the login page",
      "B"
    );
    expect(compressed).not.toMatch(/can you help/i);
    expect(compressed).toMatch(/fix.*login/i);
  });

  test("summarize then start strips preamble", () => {
    const { compressed } = compressMessage(
      "So what I am trying to do is build a login page with a form",
      "B"
    );
    expect(compressed).not.toMatch(/what i.m trying/i);
    expect(compressed).toMatch(/build.*login/i);
  });

  test("deduplicates sentences with high word overlap", () => {
    const { compressed } = compressMessage(
      "Fix the login bug. Fix the login issue now.",
      "B"
    );
    // Should keep one sentence, not both — strip the prefix to check body
    const body = compressed.replace(/^\[.*?\]\s*/, "");
    const sentenceCount = body.split(/[.!?]+/).filter(s => s.trim()).length;
    expect(sentenceCount).toBeLessThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════
//  Pronoun framing
// ═══════════════════════════════════════════════════════
describe("Pronoun framing", () => {
  test("simplifies 'I wrote X and want you to Y'", () => {
    const { compressed } = compressMessage(
      "I wrote this function and I want you to check it",
      "B"
    );
    expect(compressed).not.toMatch(/i wrote/i);
    expect(compressed).toMatch(/function/i);
    expect(compressed).toMatch(/check/i);
  });
});

// ═══════════════════════════════════════════════════════
//  Over-explanation of intent
// ═══════════════════════════════════════════════════════
describe("Over-explanation of intent", () => {
  test("compresses adjective chain after so that", () => {
    const { compressed } = compressMessage(
      "refactor this so that it is cleaner and more readable and easier to maintain",
      "B"
    );
    expect(compressed).not.toMatch(/and more readable and/i);
    expect(compressed).toMatch(/cleaner/i);
  });
});

// ═══════════════════════════════════════════════════════
//  Demonstratives (Tier C)
// ═══════════════════════════════════════════════════════
describe("Demonstratives — Tier C", () => {
  test("strips 'this' when not comparative", () => {
    const { compressed } = compressMessage("Fix this function", "C");
    expect(compressed).not.toMatch(/\bthis\b/i);
    expect(compressed).toMatch(/fix/i);
    expect(compressed).toMatch(/function/i);
  });

  test("keeps 'this' in comparisons", () => {
    const { compressed } = compressMessage(
      "this approach vs that approach",
      "C"
    );
    expect(compressed).toMatch(/this approach vs/i);
  });
});

// ═══════════════════════════════════════════════════════
//  Edge cases
// ═══════════════════════════════════════════════════════
describe("Edge cases", () => {
  test("empty string returns empty", () => {
    const { compressed } = compressMessage("", "A");
    expect(compressed).toBe("");
  });

  test("all filler doesn't compress to empty", () => {
    const { compressed } = compressMessage("well basically actually just", "A");
    expect(compressed.length).toBeGreaterThan(0);
  });

  test("single word passes through", () => {
    const { compressed } = compressMessage("refactor", "A");
    expect(compressed).toMatch(/refactor/);
  });

  test("code-only message preserves code", () => {
    const code = "```python\ndef hello():\n    print('hi')\n```";
    const { compressed } = compressMessage(code, "A");
    expect(compressed).toContain("def hello():");
    expect(compressed).toContain("print('hi')");
  });
});
