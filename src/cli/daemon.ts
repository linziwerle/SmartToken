#!/usr/bin/env bun
import { loadConfig, getConfigDir } from "../proxy/config.ts";
import { getSession, clearSession } from "../proxy/logger.ts";

const PID_PATH = `${getConfigDir()}/proxy.pid`;
const LOG_PATH = `${getConfigDir()}/proxy.log`;
const ERR_LOG_PATH = `${getConfigDir()}/proxy.err.log`;
const PLIST_NAME = "com.smart-token.proxy";
const PLIST_DIR = `${process.env.HOME}/Library/LaunchAgents`;
const PLIST_PATH = `${PLIST_DIR}/${PLIST_NAME}.plist`;

// ── start ──
export async function startCommand(args: string[]): Promise<void> {
  const daemon = args.includes("-d") || args.includes("--daemon");

  // Check if already running (regardless of foreground/daemon mode)
  const config = loadConfig();
  try {
    const res = await fetch(`http://localhost:${config.port}/health`);
    if (res.ok) {
      console.log(`  Already running on localhost:${config.port}. Use 'smart-token restart' to restart.`);
      return;
    }
  } catch {
    // Not running — proceed to start
  }

  if (daemon) {
    await startDaemon();
  } else {
    // Foreground — just import and run the server
    const { startServer } = await import("../proxy/server.ts");
    startServer();
  }
}

async function startDaemon(): Promise<void> {
  // Check if already running
  const pid = await getRunningPid();
  if (pid) {
    console.log(`  Already running (PID ${pid}). Use 'smart-token restart' to restart.`);
    return;
  }

  await Bun.$`mkdir -p ${getConfigDir()}`;

  // Find bun binary
  const bunPath = process.argv[0] ?? `${process.env.HOME}/.bun/bin/bun`;
  const serverPath = new URL("../proxy/server.ts", import.meta.url).pathname;

  const proc = Bun.spawn([bunPath, serverPath], {
    stdio: ["ignore", "ignore", "ignore"],
    env: { ...process.env },
  });

  // Give it a moment to start
  await Bun.sleep(500);

  // Verify it started
  try {
    const config = loadConfig();
    const res = await fetch(`http://localhost:${config.port}/health`);
    if (res.ok) {
      await Bun.write(PID_PATH, String(proc.pid));
      console.log(`  Started (PID ${proc.pid}) on localhost:${config.port}`);
    } else {
      console.error("  Failed to start — health check failed.");
    }
  } catch {
    console.error("  Failed to start — could not connect to proxy.");
  }
}

// ── stop ──
export async function stopCommand(): Promise<void> {
  const pid = await getRunningPid();
  if (!pid) {
    console.log("  Not running.");
    return;
  }

  try {
    process.kill(pid, "SIGTERM");
    // Clean up PID file
    try { await Bun.$`rm -f ${PID_PATH}`; } catch { /* ignore */ }
    console.log(`  Stopped (PID ${pid}).`);
  } catch {
    console.log(`  Process ${pid} not found. Cleaning up.`);
    try { await Bun.$`rm -f ${PID_PATH}`; } catch { /* ignore */ }
  }
}

// ── restart ──
export async function restartCommand(args: string[]): Promise<void> {
  await stopCommand();
  await Bun.sleep(300);
  await startCommand(["-d", ...args]);
}

// ── status ──
export async function statusCommand(): Promise<void> {
  const config = loadConfig();
  const pid = await getRunningPid();

  // Try to reach the server (regardless of PID file — launchd may manage the process)
  let reachable = false;
  try {
    const res = await fetch(`http://localhost:${config.port}/health`);
    reachable = res.ok;
  } catch {
    reachable = false;
  }

  const session = await getSession();

  console.log(`
  smart-token proxy
  ├─ Status:    ${reachable ? "\x1b[32mrunning\x1b[0m" : "\x1b[31mstopped\x1b[0m"}${pid ? ` (PID ${pid})` : ""}
  ├─ Port:      ${config.port}
  ├─ Mode:      ${config.mode}
  ├─ Tier:      ${config.tier}
  ├─ Requests:  ${session.requests}
  ├─ Saved:     ${session.totalSaved} tokens (${session.savingsPercent})
  └─ Since:     ${session.started ? new Date(session.started).toLocaleString() : "—"}
`);
}

// ── logs ──
export async function logsCommand(args: string[]): Promise<void> {
  if (args.includes("--clear")) {
    await clearSession();
    console.log("  Session log cleared.");
    return;
  }

  const session = await getSession();
  if (session.entries.length === 0) {
    console.log("  No log entries yet.");
    return;
  }

  // Show last 20 entries
  const recent = session.entries.slice(-20);
  console.log(`\n  Last ${recent.length} requests:\n`);
  console.log(
    "  " +
      "Time".padEnd(12) +
      "Provider".padEnd(12) +
      "Original".padStart(10) +
      "Saved".padStart(10) +
      "Pct".padStart(8) +
      "Ms".padStart(6)
  );
  console.log("  " + "─".repeat(58));

  for (const entry of recent) {
    const time = new Date(entry.timestamp).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    console.log(
      "  " +
        time.padEnd(12) +
        entry.provider.padEnd(12) +
        String(entry.originalTokens).padStart(10) +
        String(entry.saved).padStart(10) +
        entry.savingsPercent.padStart(8) +
        String(entry.overheadMs).padStart(6)
    );
  }

  console.log("  " + "─".repeat(58));
  console.log(
    `  Total: ${session.requests} requests | ${session.totalSaved} tokens saved (${session.savingsPercent})\n`
  );
}

// ── install (launchd) ──
export async function installCommand(): Promise<void> {
  const bunPath = await Bun.$`which bun`.text().then((s) => s.trim()).catch(
    () => `${process.env.HOME}/.bun/bin/bun`
  );
  const serverPath = new URL("../proxy/server.ts", import.meta.url).pathname;

  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${PLIST_NAME}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${bunPath}</string>
    <string>${serverPath}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${LOG_PATH}</string>
  <key>StandardErrorPath</key>
  <string>${ERR_LOG_PATH}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>HOME</key>
    <string>${process.env.HOME}</string>
    <key>PATH</key>
    <string>${process.env.HOME}/.bun/bin:/usr/local/bin:/usr/bin:/bin</string>
  </dict>
</dict>
</plist>`;

  await Bun.$`mkdir -p ${PLIST_DIR}`;
  await Bun.write(PLIST_PATH, plist);

  // Load the agent
  try {
    await Bun.$`launchctl unload ${PLIST_PATH} 2>/dev/null`.quiet();
  } catch { /* not loaded yet, that's fine */ }
  await Bun.$`launchctl load ${PLIST_PATH}`;

  console.log(`  Installed and started.`);
  console.log(`  SmartToken will auto-start on login.\n`);
  console.log(`  Add to your ~/.zprofile:\n`);
  console.log(`    export ANTHROPIC_BASE_URL=http://localhost:3141`);
  console.log(`    export OPENAI_BASE_URL=http://localhost:3141/openai\n`);
}

// ── uninstall ──
export async function uninstallCommand(): Promise<void> {
  try {
    await Bun.$`launchctl unload ${PLIST_PATH} 2>/dev/null`.quiet();
  } catch { /* not loaded */ }
  try {
    await Bun.$`rm -f ${PLIST_PATH}`;
  } catch { /* not there */ }
  await stopCommand();
  console.log("  Uninstalled. SmartToken will no longer auto-start.");
}

// ── helpers ──
async function getRunningPid(): Promise<number | null> {
  try {
    const file = Bun.file(PID_PATH);
    if (await file.exists()) {
      const pid = parseInt(await file.text(), 10);
      if (!isNaN(pid)) {
        // Check if process is actually running
        try {
          process.kill(pid, 0);
          return pid;
        } catch {
          // Process is dead, clean up stale PID file
          await Bun.$`rm -f ${PID_PATH}`;
          return null;
        }
      }
    }
  } catch {
    // no PID file
  }
  return null;
}
