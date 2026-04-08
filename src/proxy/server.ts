#!/usr/bin/env bun
import type { CompressionConfig, Tier } from "../types/index.ts";
import { detectProvider, resolveTargetPath } from "./detect-provider.ts";
import { compressRequestBody } from "./compress-request.ts";
import { forwardRequest } from "./forward.ts";
import { logRequest } from "./logger.ts";
import { loadConfig, type SmartTokenConfig } from "./config.ts";

// ── Terminal-safe output ──
// Save cursor, move to new line, clear it, print, restore cursor.
// Prevents proxy output from overlapping the user's prompt line.
function safePrint(msg: string): void {
  process.stderr.write(`\x1b[s\n\x1b[2K${msg}\x1b[u`);
}

// ── Terminal colors (for dev mode output to stderr) ──
const color = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  strikeRed: (s: string) => `\x1b[9;31m${s}\x1b[0m`,
};

// ── Word-level diff for dev mode ──
function tokenize(text: string): string[] {
  return text.match(/\S+|\n/g) || [];
}

function lcs(a: string[], b: string[]): boolean[] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1]!.toLowerCase() === b[j - 1]!.toLowerCase()) {
        dp[i]![j] = dp[i - 1]![j - 1]! + 1;
      } else {
        dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
      }
    }
  }
  const kept = new Array(m).fill(false);
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1]!.toLowerCase() === b[j - 1]!.toLowerCase()) {
      kept[i - 1] = true;
      i--; j--;
    } else if (dp[i - 1]![j]! >= dp[i]![j - 1]!) {
      i--;
    } else {
      j--;
    }
  }
  return kept;
}

function buildDevOutput(original: string, compressed: string): string {
  const cleanCompressed = compressed.replace(/^\[.*?\]\s*/, "");
  const origWords = tokenize(original);
  const compWords = tokenize(cleanCompressed);
  const keptFlags = lcs(origWords, compWords);
  return origWords
    .map((word, i) => (keptFlags[i] ? word : color.strikeRed(word)))
    .join(" ");
}

// ── Request handler ──
async function handleRequest(req: Request, config: SmartTokenConfig): Promise<Response> {
  const url = new URL(req.url);

  // Health check
  if (url.pathname === "/health" || url.pathname === "/status") {
    return new Response(
      JSON.stringify({ status: "running", mode: config.mode, tier: config.tier, port: config.port }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  const startTime = performance.now();

  // Detect provider from path
  const { provider, targetBase } = detectProvider(url.pathname);
  const targetPath = resolveTargetPath(url.pathname);
  const targetUrl = `${targetBase}${targetPath}${url.search}`;

  // If mode is off, pure passthrough
  if (config.mode === "off") {
    return forwardRequest(targetUrl, req.method, req.headers, await req.text());
  }

  // Only compress POST requests with a body (API calls)
  if (req.method !== "POST") {
    return forwardRequest(targetUrl, req.method, req.headers, await req.text());
  }

  let bodyText: string;
  try {
    bodyText = await req.text();
  } catch {
    return forwardRequest(targetUrl, req.method, req.headers, "");
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(bodyText);
  } catch {
    // Not JSON — forward as-is
    return forwardRequest(targetUrl, req.method, req.headers, bodyText);
  }

  // Capture originals for dev mode before compression
  const originalMessages = config.mode === "dev"
    ? extractUserMessages(body)
    : [];

  // Compress
  const compressionConfig: CompressionConfig = {
    messages: true,
    codeBlocks: true,
    media: true,
    systemPrompt: true,
    history: true,
    tier: config.tier as Tier,
  };

  const result = compressRequestBody(body, compressionConfig);
  const compressedBody = JSON.stringify(result.body);
  const overheadMs = Math.round(performance.now() - startTime);

  // Log
  await logRequest({
    timestamp: new Date().toISOString(),
    provider,
    originalTokens: result.stats.totalOriginalTokens,
    compressedTokens: result.stats.totalCompressedTokens,
    saved: result.stats.totalSaved,
    savingsPercent: result.stats.savingsPercent,
    layersFired: result.stats.layersFired,
    tier: config.tier,
    overheadMs,
  });

  // Output based on mode — uses safePrint to avoid corrupting the terminal prompt
  if (config.mode === "default" && result.stats.totalSaved > 0) {
    safePrint(
      `${color.cyan("→")} saved ${result.stats.totalSaved} tokens (${result.stats.savingsPercent}) | tier ${config.tier} | ${overheadMs}ms`
    );
  } else if (config.mode === "dev" && result.stats.totalSaved > 0) {
    const compressedMessages = extractUserMessages(result.body);
    safePrint(color.dim("── smart-token dev ──"));
    for (let i = 0; i < originalMessages.length; i++) {
      if (originalMessages[i] && compressedMessages[i]) {
        safePrint(buildDevOutput(originalMessages[i]!, compressedMessages[i]!));
      }
    }
    safePrint(
      `${color.cyan("→")} saved ${result.stats.totalSaved} tokens (${result.stats.savingsPercent}) | tier ${config.tier} | ${overheadMs}ms`
    );
    safePrint(color.dim("────────────────────"));
  }

  // Forward compressed request
  return forwardRequest(targetUrl, req.method, req.headers, compressedBody);
}

// Extract user message text for dev mode diff
function extractUserMessages(body: Record<string, unknown>): string[] {
  const messages = body.messages as Array<Record<string, unknown>> | undefined;
  if (!messages) return [];
  return messages
    .filter((m) => m.role === "user")
    .map((m) => {
      if (typeof m.content === "string") return m.content;
      if (Array.isArray(m.content)) {
        return (m.content as Array<Record<string, unknown>>)
          .filter((b) => b.type === "text")
          .map((b) => b.text as string)
          .join("\n");
      }
      return "";
    });
}

// ── Start server ──
export function startServer(configOverride?: Partial<SmartTokenConfig>) {
  const config = { ...loadConfig(), ...configOverride };

  const server = Bun.serve({
    port: config.port,
    async fetch(req) {
      try {
        // Hot-reload config on each request
        const currentConfig = { ...loadConfig(), ...configOverride };
        return await handleRequest(req, currentConfig);
      } catch (error) {
        safePrint(`${color.cyan("[smart-token]")} Proxy error: ${error instanceof Error ? error.message : error}`);
        return new Response(
          JSON.stringify({ error: "SmartToken proxy error", detail: String(error) }),
          { status: 502, headers: { "Content-Type": "application/json" } }
        );
      }
    },
  });

  safePrint(`${color.green("smart-token")} proxy running on http://localhost:${server.port} | mode: ${config.mode} | tier: ${config.tier}`);

  return server;
}

// If run directly, start the server
if (import.meta.main) {
  startServer();
}
