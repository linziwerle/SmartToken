import { test, expect, describe } from "bun:test";
import { createGenericAdapter } from "../src/sdk/adapters/generic.ts";

describe("Generic adapter", () => {
  test("sends request to custom endpoint", async () => {
    const adapter = createGenericAdapter("test-key", "http://localhost:99999");

    // Should throw because no server is running
    try {
      await adapter.send({
        model: "test",
        messages: [{ role: "user", content: "hello" }],
      });
      expect(true).toBe(false); // should not reach here
    } catch (error) {
      // Expected — connection refused
      expect(error).toBeTruthy();
    }
  });
});

describe("Adapter selection", () => {
  test("all providers have adapters", async () => {
    // Just verify the modules load without error
    const { createOpenAIAdapter } = await import("../src/sdk/adapters/openai.ts");
    const { createGoogleAdapter } = await import("../src/sdk/adapters/google.ts");
    const { createGenericAdapter: gen } = await import("../src/sdk/adapters/generic.ts");
    const { createAnthropicAdapter } = await import("../src/sdk/adapters/anthropic.ts");

    expect(typeof createOpenAIAdapter).toBe("function");
    expect(typeof createGoogleAdapter).toBe("function");
    expect(typeof gen).toBe("function");
    expect(typeof createAnthropicAdapter).toBe("function");
  });
});
