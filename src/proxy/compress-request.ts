import { compress } from "../engine/pipeline.ts";
import { compressSystemPrompt } from "../engine/layer4-system.ts";
import { compressHistory, BreathingArchive, type Message } from "../engine/layer5-history.ts";
import { computeStats } from "../engine/token-counter.ts";
import type { CompressionConfig, TokenStats } from "../types/index.ts";

// Per-session breathing archive — old messages live here, not deleted
let sessionArchive: BreathingArchive | null = null;

function getArchive(): BreathingArchive {
  if (!sessionArchive) {
    sessionArchive = new BreathingArchive(".smart-token-history.json");
  }
  return sessionArchive;
}

// Called when proxy stops — clean up archive file (privacy)
export async function cleanupSession(): Promise<void> {
  if (sessionArchive) {
    await sessionArchive.cleanup();
    sessionArchive = null;
  }
}

export interface CompressionResult {
  body: Record<string, unknown>;
  stats: {
    totalOriginalTokens: number;
    totalCompressedTokens: number;
    totalSaved: number;
    savingsPercent: string;
    layersFired: string[];
  };
}

export function compressRequestBody(
  body: Record<string, unknown>,
  config: CompressionConfig
): CompressionResult {
  let totalOriginal = 0;
  let totalCompressed = 0;
  let totalSaved_history = 0;
  const layersFired: string[] = [];

  // Compress system prompt (string or array of blocks)
  if (body.system && config.systemPrompt) {
    if (typeof body.system === "string") {
      const { text } = compressSystemPrompt(body.system, config);
      const stats = computeStats(body.system, text);
      totalOriginal += stats.originalTokens;
      totalCompressed += stats.compressedTokens;
      if (stats.saved > 0) layersFired.push("system-prompt");
      body = { ...body, system: text };
    } else if (Array.isArray(body.system)) {
      // Anthropic block format: [{ type: "text", text: "..." }, ...]
      const compressedSystem = (body.system as Array<Record<string, unknown>>).map((block) => {
        if (block.type === "text" && typeof block.text === "string") {
          const { text } = compressSystemPrompt(block.text, config);
          const stats = computeStats(block.text, text);
          totalOriginal += stats.originalTokens;
          totalCompressed += stats.compressedTokens;
          if (stats.saved > 0 && !layersFired.includes("system-prompt")) {
            layersFired.push("system-prompt");
          }
          return { ...block, text };
        }
        return block;
      });
      body = { ...body, system: compressedSystem };
    }
  }

  // Compress messages
  let messages = body.messages as Array<Record<string, unknown>> | undefined;

  // Layer 5: History compression (operates on the full message array)
  if (messages && Array.isArray(messages) && config.history && messages.length > 10) {
    const indexed: Message[] = messages.map((msg, i) => ({
      role: (msg.role as "user" | "assistant") ?? "user",
      content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
      index: i,
    }));

    // Extract the last user message for topic-based archive retrieval
    const lastUserMsg = [...indexed].reverse().find(m => m.role === "user");
    const currentMessage = lastUserMsg?.content;

    // Get the breathing archive — old messages are stored here, not deleted
    const archive = getArchive();

    // Count original tokens for all messages
    const originalTotal = indexed.reduce((sum, m) => sum + computeStats(m.content, "").originalTokens, 0);

    const compressed = compressHistory(
      indexed,
      config,
      { windowSize: 10 },
      archive,
      currentMessage
    );

    // Count compressed tokens
    const compressedTotal = compressed.reduce((sum, m) => sum + computeStats(m.content, "").originalTokens, 0);

    const historySaved = originalTotal - compressedTotal;
    if (historySaved > 0) {
      totalSaved_history = historySaved;
      layersFired.push("history-compressor");

      // Rebuild messages array from compressed history.
      // compressHistory returns Message[] which may be shorter (dropped messages)
      // or have modified content. Each Message has role + content — use directly.
      messages = compressed.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      body = { ...body, messages };
    }
  }

  if (messages && Array.isArray(messages)) {
    const compressedMessages = messages.map((msg) => {
      // Only compress user messages
      if (msg.role !== "user") return msg;

      // Handle string content
      if (typeof msg.content === "string") {
        const result = compress(msg.content, config);
        totalOriginal += result.stats.originalTokens;
        totalCompressed += result.stats.compressedTokens;
        if (result.stats.saved > 0) {
          for (const layer of result.layers) {
            if (!layer.skipped && !layersFired.includes(layer.layerName)) {
              layersFired.push(layer.layerName);
            }
          }
        }
        return { ...msg, content: result.compressed };
      }

      // Handle array content (Anthropic multi-block: [{ type: "text", text: "..." }, ...])
      if (Array.isArray(msg.content)) {
        const compressedContent = (msg.content as Array<Record<string, unknown>>).map(
          (block) => {
            if (block.type === "text" && typeof block.text === "string") {
              const result = compress(block.text as string, config);
              totalOriginal += result.stats.originalTokens;
              totalCompressed += result.stats.compressedTokens;
              if (result.stats.saved > 0) {
                for (const layer of result.layers) {
                  if (!layer.skipped && !layersFired.includes(layer.layerName)) {
                    layersFired.push(layer.layerName);
                  }
                }
              }
              return { ...block, text: result.compressed };
            }
            return block; // images, tool_use, etc. — pass through
          }
        );
        return { ...msg, content: compressedContent };
      }

      return msg;
    });

    body = { ...body, messages: compressedMessages };
  }

  // Add history savings (layer 5 operates before per-message compression)
  const perMessageSaved = totalOriginal - totalCompressed;
  const totalSaved = perMessageSaved + totalSaved_history;
  const adjustedOriginal = totalOriginal + totalSaved_history;
  const pct = adjustedOriginal > 0 ? ((totalSaved / adjustedOriginal) * 100).toFixed(1) : "0.0";

  return {
    body,
    stats: {
      totalOriginalTokens: adjustedOriginal,
      totalCompressedTokens: adjustedOriginal - totalSaved,
      totalSaved,
      savingsPercent: `${pct}%`,
      layersFired,
    },
  };
}
