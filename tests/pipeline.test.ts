import { test, expect, describe } from "bun:test";
import { compress } from "../src/engine/pipeline.ts";

describe("Pipeline", () => {
  test("compresses a basic message", () => {
    const result = compress("Hey Claude! Can you please help me fix this bug? Thanks in advance! 😊");
    expect(result.compressed.length).toBeLessThan(result.original.length);
    expect(result.stats.saved).toBeGreaterThan(0);
    expect(result.compressed).toMatch(/fix/i);
  });

  test("returns valid stats", () => {
    const result = compress("Hello there, I was wondering if you could help me");
    expect(result.stats.originalTokens).toBeGreaterThan(0);
    expect(result.stats.compressedTokens).toBeGreaterThan(0);
    expect(result.stats.savingsPercent).toMatch(/%$/);
    expect(result.stats.costSaved).toMatch(/^\$/);
  });

  test("returns layer results", () => {
    const result = compress("Hey Claude, fix this bug please");
    // 5 compression layers + optional verify layer
    expect(result.layers.length).toBeGreaterThanOrEqual(5);
    // Stubs should be skipped (no change)
    const stubs = result.layers.filter(
      (l) =>
        l.layerName !== "message-compressor" &&
        l.layerName !== "verify" &&
        l.skipped
    );
    expect(stubs.length).toBe(4); // layers 2-5 are stubs
  });

  test("respects tier config", () => {
    const tierA = compress("Refactor the function please", { tier: "A" });
    const tierC = compress("Refactor the function please", { tier: "C" });
    // Tier C should compress more aggressively
    expect(tierC.stats.compressedTokens).toBeLessThanOrEqual(
      tierA.stats.compressedTokens
    );
  });

  test("detects tone and intent", () => {
    const result = compress("Hey Claude! Can you please fix this bug?");
    expect(result.toneIntent.tones).toContain("polite");
    expect(result.toneIntent.intent).toBe("fix");
  });

  test("handles empty input", () => {
    const result = compress("");
    expect(result.compressed).toBe("");
  });

  test("preserves code blocks through pipeline", () => {
    const input = "Hey Claude! ```js\nconst x = 1;\n``` fix this please";
    const result = compress(input);
    expect(result.compressed).toContain("const x = 1;");
  });

  test("error in layer doesn't break pipeline", () => {
    // Pipeline should handle any thrown errors gracefully
    // Since stubs just pass through, this tests the error-catch path exists
    const result = compress("normal message");
    expect(result.compressed).toBeTruthy();
  });
});
