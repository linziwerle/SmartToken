#!/usr/bin/env bun

interface LogEntry {
  timestamp: string;
  layer?: string;
  originalTokens: number;
  compressedTokens: number;
  saved: number;
  savingsPercent: string;
  costSaved: string;
}

async function main() {
  const args = process.argv.slice(2);
  const logPath = args[0] || "./token-savings.json";

  const file = Bun.file(logPath);
  if (!(await file.exists())) {
    console.log(`\n  No data found at ${logPath}`);
    console.log("  Enable logging in your client config to start tracking.\n");
    return;
  }

  let entries: LogEntry[];
  try {
    entries = (await file.json()) as LogEntry[];
  } catch {
    console.error(`  Error reading ${logPath}`);
    return;
  }

  if (entries.length === 0) {
    console.log("\n  No compression data recorded yet.\n");
    return;
  }

  // Aggregate stats
  const totalOriginal = entries.reduce((s, e) => s + e.originalTokens, 0);
  const totalCompressed = entries.reduce((s, e) => s + e.compressedTokens, 0);
  const totalSaved = totalOriginal - totalCompressed;
  const avgSavings = totalOriginal > 0
    ? ((totalSaved / totalOriginal) * 100).toFixed(1)
    : "0.0";

  // Cost calculation
  const costPerToken = 0.003 / 1000; // $0.003 per 1K tokens default
  const totalCostSaved = (totalSaved * costPerToken).toFixed(4);

  // Time range
  const firstDate = entries[0]?.timestamp
    ? new Date(entries[0].timestamp).toLocaleDateString()
    : "unknown";
  const lastDate = entries[entries.length - 1]?.timestamp
    ? new Date(entries[entries.length - 1]!.timestamp).toLocaleDateString()
    : "unknown";

  // Daily breakdown
  const byDay = new Map<string, { saved: number; count: number; original: number }>();
  for (const entry of entries) {
    const day = entry.timestamp
      ? new Date(entry.timestamp).toLocaleDateString()
      : "unknown";
    const existing = byDay.get(day) ?? { saved: 0, count: 0, original: 0 };
    existing.saved += entry.saved;
    existing.count++;
    existing.original += entry.originalTokens;
    byDay.set(day, existing);
  }

  // Print dashboard
  console.log("\n  smart-token stats");
  console.log("  " + "═".repeat(50));

  console.log(`\n  Period: ${firstDate} — ${lastDate}`);
  console.log(`  Messages compressed: ${entries.length}`);
  console.log();
  console.log(`  Total tokens:        ${totalOriginal.toLocaleString()}`);
  console.log(`  After compression:   ${totalCompressed.toLocaleString()}`);
  console.log(`  Tokens saved:        ${totalSaved.toLocaleString()} (${avgSavings}%)`);
  console.log(`  Estimated cost saved: $${totalCostSaved}`);

  // Layer breakdown
  const byLayer = new Map<string, { saved: number; count: number }>();
  for (const entry of entries) {
    const layer = entry.layer ?? "pipeline";
    const existing = byLayer.get(layer) ?? { saved: 0, count: 0 };
    existing.saved += entry.saved;
    existing.count++;
    byLayer.set(layer, existing);
  }

  if (byLayer.size > 1) {
    console.log("\n  Savings by layer:");
    console.log(
      "  " +
        "Layer".padEnd(25) +
        "Messages".padStart(10) +
        "Tokens saved".padStart(14)
    );
    console.log("  " + "─".repeat(49));

    const sorted = [...byLayer.entries()].sort((a, b) => b[1].saved - a[1].saved);
    for (const [layer, data] of sorted) {
      const pct = totalSaved > 0
        ? ((data.saved / totalSaved) * 100).toFixed(0) + "%"
        : "0%";
      console.log(
        "  " +
          layer.padEnd(25) +
          String(data.count).padStart(10) +
          `${data.saved} (${pct})`.padStart(14)
      );
    }
  }

  if (byDay.size > 1) {
    console.log("\n  Daily breakdown:");
    console.log(
      "  " +
        "Date".padEnd(15) +
        "Messages".padStart(10) +
        "Saved".padStart(10) +
        "Rate".padStart(8)
    );
    console.log("  " + "─".repeat(43));

    for (const [day, data] of byDay) {
      const rate =
        data.original > 0
          ? ((data.saved / data.original) * 100).toFixed(0) + "%"
          : "0%";
      console.log(
        "  " +
          day.padEnd(15) +
          String(data.count).padStart(10) +
          String(data.saved).padStart(10) +
          rate.padStart(8)
      );
    }
  }

  console.log("\n  " + "═".repeat(50));
  console.log();
}

main();
