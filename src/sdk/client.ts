import type {
  ClientConfig,
  CompressionConfig,
  SessionStats,
} from "../types/index.ts";
import { compress } from "../engine/pipeline.ts";
import { computeStats, SessionTracker } from "../engine/token-counter.ts";
import { createAnthropicAdapter } from "./adapters/anthropic.ts";
import { createOpenAIAdapter } from "./adapters/openai.ts";
import { createGoogleAdapter } from "./adapters/google.ts";
import { createGenericAdapter } from "./adapters/generic.ts";
import { compressHistory, BreathingArchive } from "../engine/layer5-history.ts";
import type { Message } from "../engine/layer5-history.ts";
import { parseTierSpec, isVersionCompatible, RULES_VERSION } from "../rules/version.ts";

const DEFAULT_COMPRESSION: CompressionConfig = {
  messages: true,
  codeBlocks: true,
  media: true,
  systemPrompt: true,
  history: true,
  tier: "B",
};

export interface OptimizedClient {
  messages: {
    create(params: Record<string, unknown>): Promise<unknown>;
  };
  cleanup(): SessionStats;
}

export function createOptimizedClient(config: ClientConfig): OptimizedClient {
  // Parse tier spec (supports "B" or "B@1.0" format)
  const tierInput = config.compression?.tier ?? "B";
  const tierSpec = typeof tierInput === "string" && tierInput.includes("@")
    ? parseTierSpec(tierInput)
    : { tier: tierInput as "A" | "B" | "C", version: null };

  // Validate version compatibility
  if (tierSpec.version && !isVersionCompatible(tierSpec.version)) {
    console.warn(
      `smart-token: requested rules version ${tierSpec.version} ` +
      `is not compatible with installed version ${RULES_VERSION}. Using latest.`
    );
  }

  const compressionConfig: CompressionConfig = {
    ...DEFAULT_COMPRESSION,
    ...config.compression,
    tier: tierSpec.tier,
  };

  const tracker = new SessionTracker(
    config.logging?.enabled ? config.logging.output : undefined
  );

  // Select adapter
  const adapter = selectAdapter(config);

  // History tracking for Layer 5
  const archive = new BreathingArchive(
    config.logging?.enabled
      ? ".smart-token-history.json"
      : undefined
  );
  let messageIndex = 0;

  return {
    messages: {
      async create(params: Record<string, unknown>): Promise<unknown> {
        const messages = params.messages as
          | Array<{ role: string; content: string }>
          | undefined;

        if (messages && Array.isArray(messages)) {
          // Tag messages with indices for Layer 5
          const indexed: Message[] = messages.map((msg, i) => ({
            role: msg.role as "user" | "assistant",
            content: msg.content,
            index: messageIndex + i,
          }));
          messageIndex += messages.length;

          // Layer 5: compress history (sliding window + archive)
          let processedMessages = indexed;
          if (compressionConfig.history && indexed.length > 1) {
            const currentMsg = indexed[indexed.length - 1]?.content;
            processedMessages = compressHistory(
              indexed,
              compressionConfig,
              { windowSize: 10, archivePath: ".smart-token-history.json" },
              archive,
              currentMsg
            );
          }

          // Layers 1-4: compress each message
          const compressedMessages = processedMessages.map((msg) => {
            if (msg.role === "user" && typeof msg.content === "string") {
              const result = compress(msg.content, compressionConfig);
              const stats = computeStats(msg.content, result.compressed);
              tracker.record(stats, "pipeline");

              if (config.logging?.enabled) {
                tracker.logToFile(stats);
              }

              return { role: msg.role, content: result.compressed };
            }
            return { role: msg.role, content: msg.content };
          });

          return adapter.send({ ...params, messages: compressedMessages });
        }

        return adapter.send(params);
      },
    },

    async cleanup(): Promise<SessionStats> {
      await archive.cleanup();
      return tracker.summary();
    },
  };
}

interface Adapter {
  send(params: Record<string, unknown>): Promise<unknown>;
}

function selectAdapter(config: ClientConfig): Adapter {
  switch (config.provider) {
    case "anthropic":
      return createAnthropicAdapter(config.apiKey);
    case "openai":
      return createOpenAIAdapter(config.apiKey);
    case "google":
      return createGoogleAdapter(config.apiKey);
    case "generic":
      return createGenericAdapter(
        config.apiKey,
        (config as Record<string, unknown>).baseUrl as string | undefined
      );
    default:
      throw new Error(`Unknown provider: "${config.provider}"`);
  }
}
