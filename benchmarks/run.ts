#!/usr/bin/env bun
/**
 * Smart Token Benchmark Suite
 *
 * Tests compression across 5 realistic use cases.
 * Run: bun benchmarks/run.ts
 */

import { compressRequestBody, cleanupSession } from "../src/proxy/compress-request.ts";
import { countTokens, computeStats } from "../src/engine/token-counter.ts";
import type { CompressionConfig } from "../src/types/index.ts";
import { readdirSync } from "fs";

// ── Colors ──
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const magenta = (s: string) => `\x1b[35m${s}\x1b[0m`;

function bar(pct: number, width = 25): string {
  if (pct <= 0) return red("─".repeat(width)) + " " + red("net negative");
  const filled = Math.round(Math.min(pct, 100) / 100 * width);
  const empty = width - filled;
  return green("█".repeat(filled)) + dim("░".repeat(empty));
}

function pctColor(pct: number): string {
  if (pct >= 20) return green(`${pct.toFixed(1)}%`);
  if (pct >= 10) return cyan(`${pct.toFixed(1)}%`);
  if (pct >= 5) return yellow(`${pct.toFixed(1)}%`);
  return red(`${pct.toFixed(1)}%`);
}

interface BenchmarkResult {
  name: string;
  description: string;
  messages: number;
  systemTokens: number;
  userTokens: number;
  assistantTokens: number;
  totalOriginal: number;
  totalCompressed: number;
  totalSaved: number;
  savingsPct: number;
  layersFired: string[];
  overheadMs: number;
  breakdown: {
    system: { original: number; compressed: number; saved: number };
    user: { original: number; compressed: number; saved: number };
  };
}

async function runBenchmark(fixturePath: string): Promise<BenchmarkResult> {
  const fixture = await Bun.file(fixturePath).json();

  // Count original tokens by role
  const systemTokens = countTokens(fixture.system);
  let userTokens = 0;
  let assistantTokens = 0;
  for (const msg of fixture.messages) {
    const count = countTokens(msg.content);
    if (msg.role === "user") userTokens += count;
    else assistantTokens += count;
  }

  // Compress system prompt separately to measure its contribution
  const configAll: CompressionConfig = {
    messages: true,
    codeBlocks: true,
    media: true,
    systemPrompt: true,
    history: true,
    tier: "B",
  };

  // Reset archive between benchmarks so they don't bleed into each other
  await cleanupSession();

  const start = performance.now();
  const result = compressRequestBody(
    JSON.parse(JSON.stringify(fixture)),
    configAll
  );
  const overheadMs = performance.now() - start;

  // Measure system prompt savings separately
  const compressed = result.body as typeof fixture;
  const compressedSystemTokens = countTokens(
    typeof compressed.system === "string" ? compressed.system : ""
  );
  let compressedUserTokens = 0;
  for (const msg of compressed.messages) {
    if (msg.role === "user") {
      compressedUserTokens += countTokens(
        typeof msg.content === "string" ? msg.content : ""
      );
    }
  }

  return {
    name: fixture.name,
    description: fixture.description,
    messages: fixture.messages.length,
    systemTokens,
    userTokens,
    assistantTokens,
    totalOriginal: result.stats.totalOriginalTokens,
    totalCompressed: result.stats.totalCompressedTokens,
    totalSaved: result.stats.totalSaved,
    savingsPct:
      result.stats.totalOriginalTokens > 0
        ? (result.stats.totalSaved / result.stats.totalOriginalTokens) * 100
        : 0,
    layersFired: result.stats.layersFired,
    overheadMs,
    breakdown: {
      system: {
        original: systemTokens,
        compressed: compressedSystemTokens,
        saved: systemTokens - compressedSystemTokens,
      },
      user: {
        original: userTokens,
        compressed: compressedUserTokens,
        saved: userTokens - compressedUserTokens,
      },
    },
  };
}

async function main() {
  console.log("");
  console.log(bold("  ⚡ Smart Token — Benchmark Suite"));
  console.log(dim("  Five real-world use cases. No cherry-picking.\n"));

  const fixturesDir = new URL("./fixtures", import.meta.url).pathname;
  const files = readdirSync(fixturesDir)
    .filter((f) => f.endsWith(".json"))
    .sort();

  const results: BenchmarkResult[] = [];

  for (const file of files) {
    const result = await runBenchmark(`${fixturesDir}/${file}`);
    results.push(result);
  }

  // ── Summary table ──
  console.log(
    dim("  ─────────────────────────────────────────────────────────────────────")
  );
  console.log(
    `  ${"Use Case".padEnd(28)} ${"Msgs".padEnd(6)} ${"Original".padEnd(10)} ${"Saved".padEnd(10)} ${"Rate".padEnd(10)} ${"Time"}`
  );
  console.log(
    dim("  ─────────────────────────────────────────────────────────────────────")
  );

  let grandOriginal = 0;
  let grandSaved = 0;

  for (const r of results) {
    grandOriginal += r.totalOriginal;
    grandSaved += r.totalSaved;
    console.log(
      `  ${r.name.padEnd(28)} ${String(r.messages).padEnd(6)} ${(r.totalOriginal + "").padEnd(10)} ${(r.totalSaved + "").padEnd(10)} ${pctColor(r.savingsPct).padEnd(19)} ${dim(r.overheadMs.toFixed(0) + "ms")}`
    );
  }

  const grandPct = (grandSaved / grandOriginal) * 100;
  console.log(
    dim("  ─────────────────────────────────────────────────────────────────────")
  );
  console.log(
    `  ${bold("Total".padEnd(28))} ${"".padEnd(6)} ${bold(grandOriginal + "").padEnd(10)} ${bold(green(grandSaved + "")).padEnd(19)} ${pctColor(grandPct)}`
  );
  console.log("");

  // ── Per-benchmark detail ──
  for (const r of results) {
    console.log(dim(`  ── ${r.name} ──`));
    console.log(dim(`  ${r.description}`));
    console.log("");
    console.log(`    ${bar(r.savingsPct)} ${pctColor(r.savingsPct)} saved`);
    console.log("");

    // Token breakdown
    console.log(
      `    System prompt:  ${r.breakdown.system.original} → ${r.breakdown.system.compressed} ${dim("(" + r.breakdown.system.saved + " saved)")}`
    );
    console.log(
      `    User messages:  ${r.breakdown.user.original} → ${r.breakdown.user.compressed} ${dim("(" + r.breakdown.user.saved + " saved)")}`
    );
    console.log(
      `    Asst messages:  ${r.assistantTokens} ${dim("(not compressed)")}`
    );
    console.log(`    Layers fired:   ${r.layersFired.join(", ") || dim("none")}`);
    console.log("");
  }

  // ── Honest ranges ──
  console.log(bold("  What to expect"));
  console.log(dim("  ─────────────────────────────────────────────────────────────────────\n"));

  const sorted = [...results].sort((a, b) => b.savingsPct - a.savingsPct);
  for (const r of sorted) {
    const emoji =
      r.savingsPct >= 20 ? "●" : r.savingsPct >= 10 ? "●" : r.savingsPct >= 5 ? "●" : "○";
    const color =
      r.savingsPct >= 20
        ? green
        : r.savingsPct >= 10
        ? cyan
        : r.savingsPct >= 5
        ? yellow
        : red;
    console.log(`  ${color(emoji)} ${r.name.padEnd(30)} ${pctColor(r.savingsPct)}`);
  }

  console.log("");

  // ── Cost projection ──
  const avgSavingsPct = grandPct;
  const reqPerDay = 100;
  const avgTokensPerReq = grandOriginal / results.length;
  const savedPerDay = (avgTokensPerReq * (avgSavingsPct / 100)) * reqPerDay;

  console.log(bold("  Cost savings (100 req/day, blended average)"));
  console.log(dim("  ─────────────────────────────────────────────────────────────────────\n"));

  const models = [
    ["Claude Sonnet 4.6", 3.0],
    ["Claude Opus 4.6", 5.0],
    ["GPT-4.1", 2.0],
    ["GPT-4o", 2.5],
  ] as const;

  console.log(
    `  ${"Model".padEnd(22)} ${"Per month".padEnd(14)} ${"Per year".padEnd(14)} ${"10-person team/yr"}`
  );
  console.log(dim("  " + "─".repeat(65)));

  for (const [model, rate] of models) {
    const monthly = (savedPerDay / 1_000_000) * rate * 22;
    const yearly = monthly * 12;
    const teamYearly = yearly * 10;
    console.log(
      `  ${model.padEnd(22)} ${green("$" + monthly.toFixed(2)).padEnd(22)} ${green("$" + yearly.toFixed(2)).padEnd(22)} ${green("$" + teamYearly.toFixed(0))}`
    );
  }

  console.log("");
  console.log(dim("  Note: Savings vary by use case. Agent workflows with pre-optimized"));
  console.log(dim("  system prompts save less. Chatbots and data-heavy apps save more."));
  console.log(dim("  These numbers use a blended average across all 5 benchmarks."));
  console.log("");
}

main();
