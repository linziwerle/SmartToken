import type { CompressionConfig } from "../types/index.ts";

export interface RequestLog {
  timestamp: string;
  provider: string;
  originalTokens: number;
  compressedTokens: number;
  saved: number;
  savingsPercent: string;
  layersFired: string[];
  tier: string;
  overheadMs: number;
}

export interface SessionLog {
  started: string;
  requests: number;
  totalOriginalTokens: number;
  totalCompressedTokens: number;
  totalSaved: number;
  savingsPercent: string;
  entries: RequestLog[];
}

const CONFIG_DIR = `${process.env.HOME}/.smart-token`;
const SESSION_PATH = `${CONFIG_DIR}/session.json`;

async function ensureDir(): Promise<void> {
  const dir = Bun.file(CONFIG_DIR);
  try {
    await Bun.$`mkdir -p ${CONFIG_DIR}`;
  } catch {
    // already exists
  }
}

let sessionCache: SessionLog | null = null;

async function loadSession(): Promise<SessionLog> {
  if (sessionCache) return sessionCache;

  try {
    const file = Bun.file(SESSION_PATH);
    if (await file.exists()) {
      sessionCache = (await file.json()) as SessionLog;
      return sessionCache;
    }
  } catch {
    // corrupt or missing — start fresh
  }

  sessionCache = {
    started: new Date().toISOString(),
    requests: 0,
    totalOriginalTokens: 0,
    totalCompressedTokens: 0,
    totalSaved: 0,
    savingsPercent: "0.0%",
    entries: [],
  };
  return sessionCache;
}

export async function logRequest(entry: RequestLog): Promise<void> {
  await ensureDir();
  const session = await loadSession();

  session.requests++;
  session.totalOriginalTokens += entry.originalTokens;
  session.totalCompressedTokens += entry.compressedTokens;
  session.totalSaved += entry.saved;

  const pct =
    session.totalOriginalTokens > 0
      ? ((session.totalSaved / session.totalOriginalTokens) * 100).toFixed(1)
      : "0.0";
  session.savingsPercent = `${pct}%`;

  // Keep last 500 entries to prevent unbounded growth
  session.entries.push(entry);
  if (session.entries.length > 500) {
    session.entries = session.entries.slice(-500);
  }

  sessionCache = session;
  await Bun.write(SESSION_PATH, JSON.stringify(session, null, 2));
}

export async function getSession(): Promise<SessionLog> {
  return loadSession();
}

export async function clearSession(): Promise<void> {
  sessionCache = null;
  try {
    await Bun.write(
      SESSION_PATH,
      JSON.stringify({
        started: new Date().toISOString(),
        requests: 0,
        totalOriginalTokens: 0,
        totalCompressedTokens: 0,
        totalSaved: 0,
        savingsPercent: "0.0%",
        entries: [],
      })
    );
  } catch {
    // ignore
  }
}
