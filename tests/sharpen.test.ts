import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import { unlinkSync, mkdirSync, rmdirSync } from "fs";

const TEST_DIR = "/tmp/smart-token-test";
const TEST_FILE = `${TEST_DIR}/test-prompt.txt`;
const TEST_FILE2 = `${TEST_DIR}/test-prompt2.md`;

describe("Sharpen CLI", () => {
  beforeAll(async () => {
    mkdirSync(TEST_DIR, { recursive: true });
    await Bun.write(
      TEST_FILE,
      "Hey Claude! I was wondering if you could please help me fix this bug? I know this is simple but I'm not sure what's wrong. Thanks in advance! 😊"
    );
    await Bun.write(
      TEST_FILE2,
      "Hello there, can you please review this code for me? I've been working on it for a while and I'm not sure if it's correct. Does that make sense?"
    );
  });

  afterAll(() => {
    try {
      unlinkSync(TEST_FILE);
      unlinkSync(TEST_FILE2);
      rmdirSync(TEST_DIR);
    } catch {
      // cleanup best-effort
    }
  });

  test("sharpens a single file", async () => {
    const proc = Bun.spawn(
      ["bun", "run", "src/cli/sharpen.ts", TEST_FILE],
      {
        cwd: "/Users/bamboo/Fun/SmartToken",
        stdout: "pipe",
        stderr: "pipe",
      }
    );
    const output = await new Response(proc.stdout).text();
    await proc.exited;
    expect(proc.exitCode).toBe(0);
    expect(output).toContain("Original:");
    expect(output).toContain("Compressed:");
    expect(output).toContain("Saved:");
    expect(output).toContain("tokens");
  });

  test("sharpens a folder", async () => {
    const proc = Bun.spawn(
      ["bun", "run", "src/cli/sharpen.ts", TEST_DIR],
      {
        cwd: "/Users/bamboo/Fun/SmartToken",
        stdout: "pipe",
        stderr: "pipe",
      }
    );
    const output = await new Response(proc.stdout).text();
    await proc.exited;
    expect(proc.exitCode).toBe(0);
    expect(output).toContain("Sharpening");
    expect(output).toContain("TOTAL");
  });

  test("shows help with no args", async () => {
    const proc = Bun.spawn(
      ["bun", "run", "src/cli/sharpen.ts"],
      {
        cwd: "/Users/bamboo/Fun/SmartToken",
        stdout: "pipe",
        stderr: "pipe",
      }
    );
    const output = await new Response(proc.stdout).text();
    await proc.exited;
    expect(output).toContain("Usage:");
    expect(output).toContain("sharpen");
  });

  test("supports --tier flag", async () => {
    const proc = Bun.spawn(
      ["bun", "run", "src/cli/sharpen.ts", TEST_FILE, "--tier", "C"],
      {
        cwd: "/Users/bamboo/Fun/SmartToken",
        stdout: "pipe",
        stderr: "pipe",
      }
    );
    const output = await new Response(proc.stdout).text();
    await proc.exited;
    expect(proc.exitCode).toBe(0);
    expect(output).toContain("Saved:");
  });
});
