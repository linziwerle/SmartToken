import type { TokenStats, SessionStats } from "../types/index.ts";

// Simple token estimation using cl100k_base-like heuristics
// ~4 chars per token on average for English text
// More accurate: split on whitespace + punctuation boundaries
function countTokens(text: string): number {
  if (!text || text.length === 0) return 0;

  // Split on whitespace and common token boundaries
  // This approximates cl100k_base without a heavy dependency
  const tokens = text.match(
    /[\w]+|[^\s\w]+|\s+/g
  );
  if (!tokens) return 0;

  // Rough estimate: each match is ~1 token, but long words count as more
  let count = 0;
  for (const token of tokens) {
    if (token.trim().length === 0) {
      // Whitespace: roughly 1 token per newline or significant space
      count += (token.match(/\n/g)?.length ?? 0) || (token.length > 1 ? 1 : 0);
    } else {
      // Words: ~1 token per 4 chars, minimum 1
      count += Math.max(1, Math.ceil(token.length / 4));
    }
  }
  return Math.max(1, count);
}

// Cost per 1K input tokens (rough estimates in USD)
const COST_PER_1K_INPUT: Record<string, number> = {
  "claude-3-opus": 0.015,
  "claude-3-sonnet": 0.003,
  "claude-3-haiku": 0.00025,
  "gpt-4": 0.03,
  "gpt-4-turbo": 0.01,
  "gpt-3.5-turbo": 0.0005,
  default: 0.003, // conservative estimate
};

function estimateCostSaved(
  tokensSaved: number,
  model = "default"
): string {
  const rate = COST_PER_1K_INPUT[model] ?? COST_PER_1K_INPUT["default"]!;
  const cost = (tokensSaved / 1000) * rate;
  return `$${cost.toFixed(4)}`;
}

export function computeStats(
  original: string,
  compressed: string,
  model?: string
): TokenStats {
  const originalTokens = countTokens(original);
  const compressedTokens = countTokens(compressed);
  const saved = originalTokens - compressedTokens;
  const pct =
    originalTokens > 0
      ? ((saved / originalTokens) * 100).toFixed(1)
      : "0.0";

  return {
    originalTokens,
    compressedTokens,
    saved,
    savingsPercent: `${pct}%`,
    costSaved: estimateCostSaved(saved, model),
  };
}

// ── Session tracker ──
interface LayerSavings {
  [layerName: string]: number;
}

export class SessionTracker {
  private totalOriginal = 0;
  private totalCompressed = 0;
  private messageCount = 0;
  private layerSavings: LayerSavings = {};
  private logPath: string | null = null;

  constructor(logPath?: string) {
    if (logPath) this.logPath = logPath;
  }

  record(stats: TokenStats, layerName = "pipeline"): void {
    this.totalOriginal += stats.originalTokens;
    this.totalCompressed += stats.compressedTokens;
    this.messageCount++;
    this.layerSavings[layerName] =
      (this.layerSavings[layerName] ?? 0) + stats.saved;
  }

  async logToFile(stats: TokenStats, layerName = "pipeline"): Promise<void> {
    if (!this.logPath) return;
    const entry = {
      timestamp: new Date().toISOString(),
      layer: layerName,
      ...stats,
    };
    try {
      const file = Bun.file(this.logPath);
      let existing: unknown[] = [];
      if (await file.exists()) {
        existing = (await file.json()) as unknown[];
      }
      existing.push(entry);
      await Bun.write(this.logPath, JSON.stringify(existing, null, 2));
    } catch {
      // Silent fallback — never block on logging
    }
  }

  summary(): SessionStats {
    const saved = this.totalOriginal - this.totalCompressed;
    const pct =
      this.totalOriginal > 0
        ? ((saved / this.totalOriginal) * 100).toFixed(1)
        : "0.0";

    // Find top saving layer
    let topLayer = "none";
    let topSaved = 0;
    for (const [name, amount] of Object.entries(this.layerSavings)) {
      if (amount > topSaved) {
        topLayer = name;
        topSaved = amount;
      }
    }

    return {
      totalMessages: this.messageCount,
      totalTokensSaved: saved,
      totalOriginalTokens: this.totalOriginal,
      savingsPercent: `${pct}%`,
      estimatedCostSaved: estimateCostSaved(saved),
      topSavingLayer: topLayer,
    };
  }
}

export { countTokens };
