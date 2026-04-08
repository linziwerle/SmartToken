import { test, expect, describe } from "bun:test";
import { verifyCompression, detectRiskyContent } from "../src/engine/verify.ts";
import { compressMessage } from "../src/engine/layer1-message.ts";

describe("Verification pass", () => {
  test("passes clean compression through unchanged", () => {
    const original = "Hey Claude, please fix this bug";
    const { compressed } = compressMessage(original, "B");
    const result = verifyCompression(original, compressed, "B");
    expect(result.restored).toBe(false);
    expect(result.warnings.length).toBe(0);
  });

  test("detects mangled inline code", () => {
    // Simulate: original had `just()` but compression stripped "just"
    const original = "the `just` function is broken";
    const mangled = "[fix] function is broken"; // inline code lost
    const result = verifyCompression(original, mangled, "B");
    expect(result.restored).toBe(true);
    expect(result.compressed).toContain("`just`");
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  test("detects unusual words that lost context", () => {
    // "redering" is a typo — unusual word that needs surrounding context
    const original = "I need to fix the redering issue in the login page";
    // Simulate aggressive compression that dropped "redering"
    const mangled = "[fix] issue login page";
    const result = verifyCompression(original, mangled, "B");
    expect(result.restored).toBe(true);
    expect(result.restoredWords).toContain("redering");
  });

  test("falls back to original on high content loss", () => {
    const original = "refactor the authentication middleware to use JWT tokens";
    // Simulate catastrophic compression
    const mangled = "[build] use";
    const result = verifyCompression(original, mangled, "B");
    expect(result.restored).toBe(true);
    expect(result.compressed).toBe(original);
  });

  test("does not flag common programming words as unusual", () => {
    const original = "fix the function and update the component state";
    const compressed = "[fix] fix function update component state";
    const result = verifyCompression(original, compressed, "B");
    expect(result.restored).toBe(false);
  });

  test("handles typos near stripped context", () => {
    // "cach" could be "cache" or "cash" — unusual word needs context
    const original = "I want you to please fix the cach system in the backend";
    const { compressed } = compressMessage(original, "B");
    const result = verifyCompression(original, compressed, "B");
    // "cach" should be flagged as unusual
    if (!compressed.includes("cach")) {
      expect(result.restored).toBe(true);
      expect(result.restoredWords).toContain("cach");
    }
  });

  test("preserves domain-specific terms", () => {
    const original = "the JWT token is expiring in the oauth2 middleware";
    const compressed = "[fix] JWT token expiring oauth2 middleware";
    const result = verifyCompression(original, compressed, "B");
    // jwt and oauth2 should survive — they're in the compressed text
    expect(result.compressed).toContain("JWT");
    expect(result.compressed).toContain("oauth2");
  });
});

describe("Risky content detection", () => {
  test("flags inline code with filler-like words", () => {
    const risks = detectRiskyContent("the `just` function is broken");
    expect(risks.some((r) => r.includes("`just`"))).toBe(true);
  });

  test("flags inline code with 'like' keyword", () => {
    const risks = detectRiskyContent("call the `like_button` handler");
    expect(risks.some((r) => r.includes("like"))).toBe(true);
  });

  test("flags unusual words", () => {
    const risks = detectRiskyContent("fix the redering issue");
    expect(risks.some((r) => r.includes("redering"))).toBe(true);
  });

  test("does not flag common words", () => {
    const risks = detectRiskyContent("fix the function");
    // "function" and "fix" are common — no risks
    expect(risks.length).toBe(0);
  });

  test("does not flag words inside code blocks", () => {
    const risks = detectRiskyContent(
      "check this ```js\nconst just = true;\n```"
    );
    // "just" inside code block should not be flagged
    expect(risks.some((r) => r.includes("`just`"))).toBe(false);
  });
});
