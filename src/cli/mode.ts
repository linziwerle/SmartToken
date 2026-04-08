#!/usr/bin/env bun
import { loadConfig, saveConfig, type Mode } from "../proxy/config.ts";

const VALID_MODES: Mode[] = ["off", "quiet", "default", "dev"];

const MODE_DESCRIPTIONS: Record<Mode, string> = {
  off: "passthrough — no compression, no logging",
  quiet: "compress silently, log stats to file",
  default: "compress + show one-line stats per request",
  dev: "compress + show what was trimmed (strikethrough)",
};

export async function modeCommand(args: string[]): Promise<void> {
  const target = args[0];

  if (!target) {
    // Show current mode
    const config = loadConfig();
    console.log(`\n  Current mode: ${config.mode}`);
    console.log(`  ${MODE_DESCRIPTIONS[config.mode]}\n`);
    console.log("  Available modes:");
    for (const mode of VALID_MODES) {
      const marker = mode === config.mode ? " ← " : "   ";
      console.log(`  ${marker}${mode.padEnd(10)} ${MODE_DESCRIPTIONS[mode]}`);
    }
    console.log();
    return;
  }

  if (!VALID_MODES.includes(target as Mode)) {
    console.error(`  Invalid mode: "${target}". Use: ${VALID_MODES.join(", ")}`);
    process.exit(1);
  }

  const updated = await saveConfig({ mode: target as Mode });
  console.log(`  Mode switched to: ${updated.mode} — ${MODE_DESCRIPTIONS[updated.mode]}`);
  console.log("  Takes effect on next request (no restart needed).");
}
