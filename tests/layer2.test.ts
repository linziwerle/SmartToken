import { test, expect, describe } from "bun:test";
import {
  detectLanguage,
  stripComments,
  compressLogs,
  compressTestOutput,
  compressBuildOutput,
  stripTerminalNoise,
  isIDEGeneratedContent,
  processCodeBlocks,
} from "../src/engine/layer2-code.ts";

describe("Language detection", () => {
  test("detects from fence label", () => {
    expect(detectLanguage("python", "")).toBe("python");
    expect(detectLanguage("js", "")).toBe("javascript");
    expect(detectLanguage("ts", "")).toBe("typescript");
    expect(detectLanguage("go", "")).toBe("go");
    expect(detectLanguage("swift", "")).toBe("swift");
    expect(detectLanguage("bash", "")).toBe("shell");
  });

  test("detects Python from syntax", () => {
    const code = "def hello():\n    print('hi')";
    expect(detectLanguage("", code)).toBe("python");
  });

  test("detects shell from prompt", () => {
    const code = "$ ls -la\n$ cd /tmp";
    expect(detectLanguage("", code)).toBe("shell");
  });

  test("returns unknown for ambiguous code", () => {
    expect(detectLanguage("", "x = 1")).toBe("unknown");
  });
});

describe("Comment stripping", () => {
  test("strips single-line comments (JS/TS)", () => {
    const code = "const x = 1;\n// This is a comment\nconst y = 2;";
    const result = stripComments(code, "javascript", "B");
    expect(result).not.toContain("This is a comment");
    expect(result).toContain("const x = 1;");
    expect(result).toContain("const y = 2;");
  });

  test("strips Python comments", () => {
    const code = "x = 1\n# This is a comment\ny = 2";
    const result = stripComments(code, "python", "B");
    expect(result).not.toContain("This is a comment");
    expect(result).toContain("x = 1");
  });

  test("strips commented-out code", () => {
    const code = "const x = 1;\n// const oldWay = doThing();\nconst y = 2;";
    const result = stripComments(code, "javascript", "B");
    expect(result).not.toContain("oldWay");
  });

  test("strips copyright headers", () => {
    const code = "/* Copyright 2024 Acme Corp. All rights reserved. */\nconst x = 1;";
    const result = stripComments(code, "javascript", "B");
    expect(result).not.toContain("Copyright");
    expect(result).toContain("const x = 1;");
  });

  test("keeps and trims IMPORTANT comments", () => {
    const code = "const x = 1;\n// IMPORTANT: do not change this value\nconst y = 2;";
    const result = stripComments(code, "javascript", "B");
    expect(result).toContain("change this value");
  });

  test("strips TODO comments", () => {
    const code = "const x = 1;\n// TODO: fix this later\nconst y = 2;";
    const result = stripComments(code, "javascript", "B");
    expect(result).not.toContain("TODO");
  });

  test("preserves shebang lines", () => {
    const code = "#!/usr/bin/env python\nx = 1\n# regular comment";
    const result = stripComments(code, "python", "B");
    expect(result).toContain("#!/usr/bin/env python");
  });
});

describe("Whitespace normalization", () => {
  test("collapses excessive blank lines", () => {
    const config = { messages: true, codeBlocks: true, media: true, systemPrompt: true, history: true, tier: "B" as const };
    const input = "text\n```js\nconst x = 1;\n\n\n\nconst y = 2;\n```\nmore text";
    const result = processCodeBlocks(input, config);
    expect(result).not.toContain("\n\n\n");
  });
});

describe("Log compression", () => {
  test("strips timestamps", () => {
    const log = "2024-01-15T10:30:00Z Error occurred\n2024-01-15T10:30:01Z Another error";
    const result = compressLogs(log);
    expect(result).not.toContain("2024-01-15");
    expect(result).toContain("Error occurred");
  });

  test("strips thread IDs", () => {
    const log = "[thread-42] Processing request\n[thread-42] Done";
    const result = compressLogs(log);
    expect(result).not.toContain("thread-42");
  });

  test("collapses repeated lines", () => {
    const log = "Error: connection refused\n".repeat(10);
    const result = compressLogs(log);
    expect(result).toContain("repeated 10 times");
    expect(result.split("\n").length).toBeLessThan(10);
  });

  test("shortens file paths", () => {
    const log = "Error at /Users/bamboo/Work/project/src/main/App.java";
    const result = compressLogs(log);
    expect(result).toContain("...App.java");
    expect(result).not.toContain("/Users/bamboo/Work");
  });
});

describe("Test output compression", () => {
  test("strips passing tests, keeps failures", () => {
    const output = [
      "✓ test one passes",
      "✓ test two passes",
      "✓ test three passes",
      "✗ test four fails",
      "  Expected: 1",
      "  Received: 2",
      "3 pass, 1 fail",
    ].join("\n");
    const result = compressTestOutput(output);
    expect(result).not.toContain("test one passes");
    expect(result).toContain("test four fails");
    expect(result).toContain("Expected: 1");
  });
});

describe("Build output compression", () => {
  test("strips progress lines, keeps errors", () => {
    const output = [
      "[1/10] Compiling module parser",
      "[2/10] Compiling module lexer",
      "[3/10] Compiling module codegen",
      "error: undefined variable 'foo'",
    ].join("\n");
    const result = compressBuildOutput(output);
    expect(result).not.toContain("[1/10]");
    expect(result).toContain("error: undefined variable");
  });
});

describe("Terminal noise", () => {
  test("strips ANSI color codes", () => {
    const text = "\x1b[32mSuccess\x1b[0m\n\x1b[31mError\x1b[0m";
    const result = stripTerminalNoise(text);
    expect(result).not.toContain("\x1b[");
    expect(result).toContain("Success");
  });

  test("strips shell prompts", () => {
    const text = "bamboo@rainforest ~ % ls\nfile1.txt\nbamboo@rainforest ~ % cd /tmp";
    const result = stripTerminalNoise(text);
    expect(result).not.toContain("bamboo@rainforest");
  });
});

describe("IDE-generated content", () => {
  test("detects pbxproj content", () => {
    const content = "PBXBuildFile section\nPBXFileReference foo\nPBXGroup bar";
    expect(isIDEGeneratedContent(content)).toBe(true);
  });

  test("does not flag regular code", () => {
    const content = "const x = 1;\nfunction hello() {}\nreturn true;";
    expect(isIDEGeneratedContent(content)).toBe(false);
  });
});

describe("Full pipeline integration", () => {
  test("processes code block in message context", () => {
    const config = { messages: true, codeBlocks: true, media: true, systemPrompt: true, history: true, tier: "B" as const };
    const input = `fix this code\n\`\`\`js\n// This function handles login\nfunction login() {\n  // TODO: add validation\n  return true;\n}\n\`\`\``;
    const result = processCodeBlocks(input, config);
    expect(result).toContain("function login()");
    expect(result).not.toContain("This function handles login");
    expect(result).not.toContain("TODO");
  });
});
