import { compress } from "../engine/pipeline.ts";
import { compressSystemPrompt } from "../engine/layer4-system.ts";
import { computeStats } from "../engine/token-counter.ts";
import type { CompressionConfig, TokenStats } from "../types/index.ts";

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
  const messages = body.messages as Array<Record<string, unknown>> | undefined;
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

  const totalSaved = totalOriginal - totalCompressed;
  const pct = totalOriginal > 0 ? ((totalSaved / totalOriginal) * 100).toFixed(1) : "0.0";

  return {
    body,
    stats: {
      totalOriginalTokens: totalOriginal,
      totalCompressedTokens: totalCompressed,
      totalSaved,
      savingsPercent: `${pct}%`,
      layersFired,
    },
  };
}
