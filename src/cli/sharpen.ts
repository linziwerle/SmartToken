#!/usr/bin/env bun
import { compressSystemPrompt } from "../engine/layer4-system.ts";
import { computeStats } from "../engine/token-counter.ts";
import type { Tier } from "../types/index.ts";
import type { CompressionConfig } from "../types/index.ts";
import type { TokenStats } from "../types/index.ts";

// ── Display modes ──
type DisplayMode = "default" | "quiet" | "dev";

// ── Terminal colors ──
const color = {
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  strikeRed: (s: string) => `\x1b[9;31m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
};

// Sharpen uses Layer 1 + Layer 4 only (not the full pipeline)
// Layer 1 is applied inside Layer 4's compressSystemPrompt()
interface SharpenResult {
  original: string;
  compressed: string;
  stats: TokenStats;
  cacheBreakpoints: number[];
}

function sharpenText(content: string, tier: Tier): SharpenResult {
  const config: CompressionConfig = {
    messages: true,
    codeBlocks: false,
    media: false,
    systemPrompt: true,
    history: false,
    tier,
  };
  const { text, cacheBreakpoints } = compressSystemPrompt(content, config);
  const stats = computeStats(content, text);
  return { original: content, compressed: text, stats, cacheBreakpoints };
}

// ── Word-level diff using longest common subsequence ──
function tokenize(text: string): string[] {
  return text.match(/\S+|\n/g) || [];
}

function lcs(a: string[], b: string[]): boolean[][] {
  const m = a.length;
  const n = b.length;
  // dp[i][j] = length of LCS of a[0..i-1] and b[0..j-1]
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0)
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1]!.toLowerCase() === b[j - 1]!.toLowerCase()) {
        dp[i]![j] = dp[i - 1]![j - 1]! + 1;
      } else {
        dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
      }
    }
  }
  // Backtrack to find which words in `a` are kept vs removed
  const kept: boolean[][] = []; // kept[0] = original flags, kept[1] = compressed flags
  const keptA = new Array(m).fill(false);
  const keptB = new Array(n).fill(false);
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1]!.toLowerCase() === b[j - 1]!.toLowerCase()) {
      keptA[i - 1] = true;
      keptB[j - 1] = true;
      i--; j--;
    } else if (dp[i - 1]![j]! >= dp[i]![j - 1]!) {
      i--;
    } else {
      j--;
    }
  }
  return [keptA, keptB];
}

function buildDevOutput(original: string, compressed: string): string {
  // Strip the tone/intent prefix tag from compressed for cleaner diff
  const cleanCompressed = compressed.replace(/^\[.*?\]\s*/, "");

  const origWords = tokenize(original);
  const compWords = tokenize(cleanCompressed);
  const [keptFlags] = lcs(origWords, compWords);

  const parts: string[] = [];
  for (let i = 0; i < origWords.length; i++) {
    if (keptFlags[i]) {
      parts.push(origWords[i]!);
    } else {
      parts.push(color.strikeRed(origWords[i]!));
    }
  }
  return parts.join(" ");
}

function printStats(name: string, result: SharpenResult) {
  const { stats, cacheBreakpoints } = result;
  console.log(`\n  ${name}`);
  console.log(`  ├─ Original:   ${stats.originalTokens} tokens`);
  console.log(`  ├─ Compressed: ${stats.compressedTokens} tokens`);
  console.log(`  ├─ Saved:      ${stats.saved} tokens (${stats.savingsPercent})`);
  console.log(`  ├─ Cost saved: ${stats.costSaved}`);
  if (cacheBreakpoints.length > 0) {
    console.log(`  └─ Cache:      ${cacheBreakpoints.length} breakpoint(s) for prompt caching`);
  } else {
    console.log(`  └─ Cache:      no breakpoints (content too short or flat)`);
  }
}

function printCompressed(result: SharpenResult) {
  console.log("\n── Compressed output ──────────────────────");
  console.log(result.compressed);
  console.log("───────────────────────────────────────────");
}

function printDev(result: SharpenResult) {
  const devOutput = buildDevOutput(result.original, result.compressed);
  console.log(`\n── Dev mode ${color.dim("(strikethrough = trimmed)")} ──`);
  console.log(devOutput);
  console.log("───────────────────────────────────────────");

  // Extract tone/intent tag if present
  const tagMatch = result.compressed.match(/^\[(.+?)\]\s*/);
  if (tagMatch) {
    console.log(`  ${color.cyan("tone/intent")}: [${tagMatch[1]}]`);
  }
}

async function sharpenFile(filePath: string, tier: Tier, mode: DisplayMode) {
  const file = Bun.file(filePath);
  if (!(await file.exists())) {
    console.error(`  File not found: ${filePath}`);
    return null;
  }

  const content = await file.text();
  const result = sharpenText(content, tier);

  if (mode === "quiet") {
    printStats(filePath, result);
  } else if (mode === "dev") {
    printStats(filePath, result);
    printDev(result);
  } else {
    printStats(filePath, result);
    printCompressed(result);
  }

  return result;
}

async function sharpenFolder(folderPath: string, tier: Tier) {
  const glob = new Bun.Glob("**/*.{txt,md}");
  const files: string[] = [];

  for await (const path of glob.scan({ cwd: folderPath })) {
    files.push(path);
  }

  if (files.length === 0) {
    console.log("  No .txt or .md files found.");
    return;
  }

  console.log(`\n  Sharpening ${files.length} files...\n`);
  console.log(
    "  " +
      "File".padEnd(40) +
      "Original".padStart(10) +
      "Compressed".padStart(12) +
      "Saved".padStart(10)
  );
  console.log("  " + "─".repeat(72));

  let totalOriginal = 0;
  let totalCompressed = 0;

  for (const relPath of files) {
    const fullPath = `${folderPath}/${relPath}`;
    const file = Bun.file(fullPath);
    const content = await file.text();
    const result = sharpenText(content, tier);

    totalOriginal += result.stats.originalTokens;
    totalCompressed += result.stats.compressedTokens;

    const saved = result.stats.saved;
    const pct = result.stats.savingsPercent;
    console.log(
      "  " +
        relPath.padEnd(40) +
        String(result.stats.originalTokens).padStart(10) +
        String(result.stats.compressedTokens).padStart(12) +
        `${saved} (${pct})`.padStart(10)
    );
  }

  const totalSaved = totalOriginal - totalCompressed;
  const totalPct =
    totalOriginal > 0
      ? ((totalSaved / totalOriginal) * 100).toFixed(1)
      : "0.0";
  console.log("  " + "─".repeat(72));
  console.log(
    "  " +
      "TOTAL".padEnd(40) +
      String(totalOriginal).padStart(10) +
      String(totalCompressed).padStart(12) +
      `${totalSaved} (${totalPct}%)`.padStart(10)
  );
}

async function watchFile(filePath: string, tier: Tier, mode: DisplayMode) {
  console.log(`  Watching ${filePath} for changes... (Ctrl+C to stop)`);
  const watcher = Bun.file(filePath);
  let lastContent = await watcher.text();
  let result = sharpenText(lastContent, tier);
  printOutput(filePath, result, mode);

  // Poll for changes (Bun doesn't have built-in fs.watch yet in all versions)
  const interval = setInterval(async () => {
    try {
      const current = await Bun.file(filePath).text();
      if (current !== lastContent) {
        lastContent = current;
        result = sharpenText(current, tier);
        console.clear();
        console.log("  smart-token sharpen --watch");
        printOutput(filePath, result, mode);
      }
    } catch {
      // file might be mid-write, skip
    }
  }, 500);

  // Cleanup on exit
  process.on("SIGINT", () => {
    clearInterval(interval);
    process.exit(0);
  });
}

// ── Unified output helper ──
function printOutput(name: string, result: SharpenResult, mode: DisplayMode) {
  if (mode === "quiet") {
    printStats(name, result);
  } else if (mode === "dev") {
    printStats(name, result);
    printDev(result);
  } else {
    printStats(name, result);
    printCompressed(result);
  }
}

// ── CLI entry ──
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(`
  smart-token sharpen — compress prompts, save tokens

  Usage:
    smart-token sharpen <file>           Sharpen a single file
    smart-token sharpen <folder>         Sharpen all .txt/.md files in folder
    smart-token sharpen <file> --watch   Watch and re-sharpen on changes

  Options:
    --tier <A|B|C>    Compression tier (default: B)
                      A = safe only, B = moderate, C = aggressive
    --dev             Show what was trimmed (strikethrough on removed words)
    -q, --quiet       Stats only, no output
    --watch           Watch file for changes
    -h, --help        Show this help
`);
    return;
  }

  // Parse args
  const target = args[0]!;
  const watch = args.includes("--watch");
  let tier: Tier = "B";
  const tierIdx = args.indexOf("--tier");
  if (tierIdx !== -1 && args[tierIdx + 1]) {
    const t = args[tierIdx + 1]!.toUpperCase();
    if (t === "A" || t === "B" || t === "C") tier = t;
  }

  // Parse display mode
  let mode: DisplayMode = "default";
  if (args.includes("--dev")) mode = "dev";
  else if (args.includes("--quiet") || args.includes("-q")) mode = "quiet";

  // First arg after "sharpen" is the path
  // Check: is sharpen in the command? Strip it.
  const targetPath = target === "sharpen" ? args[1] : target;
  if (!targetPath) {
    console.error("  Please provide a file or folder path.");
    process.exit(1);
  }

  // Determine if file or directory
  const file = Bun.file(targetPath);
  const isFile = await file.exists();

  if (isFile) {
    if (watch) {
      await watchFile(targetPath, tier, mode);
    } else {
      await sharpenFile(targetPath, tier, mode);
    }
  } else {
    // Try as directory
    try {
      const glob = new Bun.Glob("*");
      let hasEntries = false;
      for await (const _ of glob.scan({ cwd: targetPath })) {
        hasEntries = true;
        break;
      }
      if (hasEntries) {
        await sharpenFolder(targetPath, tier);
      } else {
        console.error(`  Not found: ${targetPath}`);
        process.exit(1);
      }
    } catch {
      console.error(`  Not found: ${targetPath}`);
      process.exit(1);
    }
  }
}

main();
