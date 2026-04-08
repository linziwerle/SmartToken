import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import {
  compressHistory,
  BreathingArchive,
  extractTopics,
  isDecisionOrConstraint,
  summarizeAssistantResponse,
} from "../src/engine/layer5-history.ts";
import type { Message } from "../src/engine/layer5-history.ts";

const DEFAULT_CONFIG = {
  messages: true,
  codeBlocks: true,
  media: true,
  systemPrompt: true,
  history: true,
  tier: "B" as const,
};

function makeMessages(contents: [string, string][]): Message[] {
  return contents.map(([role, content], i) => ({
    role: role as "user" | "assistant",
    content,
    index: i,
  }));
}

describe("Sliding window", () => {
  test("keeps all messages when within window", () => {
    const messages = makeMessages([
      ["user", "fix this bug"],
      ["assistant", "here's the fix"],
      ["user", "thanks"],
    ]);
    const result = compressHistory(messages, DEFAULT_CONFIG, { windowSize: 10 });
    expect(result.length).toBe(3);
  });

  test("compresses messages outside window", () => {
    const messages = makeMessages([
      ["user", "Hey Claude, I was wondering if you could please help me with a really long question about databases and stuff"],
      ["assistant", "Sure! I'd be happy to help. Databases are systems for storing data. There are relational databases like PostgreSQL and MySQL, and NoSQL databases like MongoDB. Let me explain in detail..."],
      ["user", "got it"],
      ["assistant", "Great! Anything else?"],
      // --- window of 2 starts here ---
      ["user", "now fix the login bug"],
      ["assistant", "fixed"],
    ]);
    const result = compressHistory(messages, DEFAULT_CONFIG, { windowSize: 2 });
    // Recent 2 messages should be unchanged
    expect(result[result.length - 1]!.content).toBe("fixed");
    expect(result[result.length - 2]!.content).toBe("now fix the login bug");
    // Old messages should be compressed (shorter)
    const totalOldLength = result
      .slice(0, -2)
      .reduce((s, m) => s + m.content.length, 0);
    const originalOldLength = messages
      .slice(0, -2)
      .reduce((s, m) => s + m.content.length, 0);
    expect(totalOldLength).toBeLessThan(originalOldLength);
  });
});

describe("Decision/constraint preservation", () => {
  test("detects decisions", () => {
    expect(isDecisionOrConstraint("We're using PostgreSQL not MySQL")).toBe(true);
    expect(isDecisionOrConstraint("I chose React over Vue")).toBe(true);
    expect(isDecisionOrConstraint("must support Python 3.8")).toBe(true);
    expect(isDecisionOrConstraint("I prefer functional style")).toBe(true);
  });

  test("does not flag normal messages", () => {
    expect(isDecisionOrConstraint("fix this bug")).toBe(false);
    expect(isDecisionOrConstraint("what time is it")).toBe(false);
  });

  test("never compresses decisions even outside window", () => {
    const messages = makeMessages([
      ["user", "We decided using PostgreSQL not MySQL for this project"],
      ["assistant", "Noted"],
      ["user", "got it"],
      ["assistant", "ok"],
      ["user", "now something else"],
      ["assistant", "sure"],
    ]);
    const result = compressHistory(messages, DEFAULT_CONFIG, { windowSize: 2 });
    const decision = result.find((m) =>
      m.content.includes("PostgreSQL")
    );
    expect(decision).toBeTruthy();
    expect(decision!.content).toContain("PostgreSQL");
  });
});

describe("Acknowledgment handling", () => {
  test("keeps grounding signals", () => {
    const messages = makeMessages([
      ["user", "fix the bug"],
      ["assistant", "done"],
      ["user", "got it"],
      ["assistant", "anything else?"],
      ["user", "new task"],
      ["assistant", "on it"],
    ]);
    const result = compressHistory(messages, DEFAULT_CONFIG, { windowSize: 2 });
    const gotIt = result.find((m) => m.content === "got it");
    expect(gotIt).toBeTruthy();
  });
});

describe("Topic extraction", () => {
  test("extracts meaningful topics", () => {
    const topics = extractTopics("fix the login authentication bug in the user module");
    expect(topics).toContain("login");
    expect(topics).toContain("authentication");
    expect(topics).toContain("module");
  });

  test("extracts bigrams", () => {
    const topics = extractTopics("login authentication");
    expect(topics).toContain("login authentication");
  });
});

describe("Assistant response summarization", () => {
  test("keeps short responses unchanged", () => {
    const short = "The fix is to add a null check.";
    expect(summarizeAssistantResponse(short)).toBe(short);
  });

  test("summarizes long responses", () => {
    const long = Array(20)
      .fill("This is a long explanation about various things that don't matter.")
      .join("\n");
    const summary = summarizeAssistantResponse(long);
    expect(summary.length).toBeLessThan(long.length);
  });

  test("preserves bullet points and headers", () => {
    const response = [
      "# Solution",
      "Here is a detailed explanation of the problem and its root cause.",
      "The issue stems from several factors.",
      "- Fix the null check",
      "- Update the dependency",
      "That should resolve it completely and prevent future occurrences.",
    ].join("\n");
    const summary = summarizeAssistantResponse(response);
    expect(summary).toContain("# Solution");
    expect(summary).toContain("Fix the null check");
    expect(summary).toContain("Update the dependency");
  });
});

describe("Breathing archive", () => {
  const ARCHIVE_PATH = "/tmp/smart-token-test-archive.json";
  let archive: BreathingArchive;

  beforeEach(() => {
    archive = new BreathingArchive(ARCHIVE_PATH);
  });

  afterEach(async () => {
    await archive.cleanup();
  });

  test("stores and retrieves messages", () => {
    const msg: Message = { role: "user", content: "fix the login bug", index: 0 };
    archive.store(msg, "fixed login bug");
    expect(archive.size).toBe(1);
  });

  test("finds relevant archived messages", () => {
    archive.store(
      { role: "user", content: "fix the login authentication bug", index: 0 },
      "login fix"
    );
    archive.store(
      { role: "user", content: "update the dashboard styling", index: 1 },
      "dashboard update"
    );

    const relevant = archive.findRelevant("the login is broken again");
    expect(relevant.length).toBeGreaterThanOrEqual(1);
    expect(relevant[0]!.original.content).toContain("login");
  });

  test("persists and loads from disk", async () => {
    archive.store(
      { role: "user", content: "fix the database query", index: 0 },
      "db fix"
    );
    await archive.save();

    const newArchive = new BreathingArchive(ARCHIVE_PATH);
    await newArchive.load();
    expect(newArchive.size).toBe(1);

    await newArchive.cleanup();
  });

  test("cleanup deletes archive file", async () => {
    archive.store(
      { role: "user", content: "test", index: 0 },
      "test"
    );
    await archive.save();
    await archive.cleanup();
    expect(archive.size).toBe(0);

    const file = Bun.file(ARCHIVE_PATH);
    expect(await file.exists()).toBe(false);
  });
});
