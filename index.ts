// Smart Token — public API
export { compress } from "./src/engine/pipeline.ts";
export { compressMessage, detectToneIntent } from "./src/engine/layer1-message.ts";
export { createOptimizedClient } from "./src/sdk/client.ts";
export { countTokens, computeStats, SessionTracker } from "./src/engine/token-counter.ts";
export { compressHistory, BreathingArchive } from "./src/engine/layer5-history.ts";
export { verifyCompression, detectRiskyContent } from "./src/engine/verify.ts";
export { RULES_VERSION, parseTierSpec } from "./src/rules/version.ts";
export type {
  Tier,
  Tone,
  Intent,
  ToneIntent,
  CompressionConfig,
  TokenStats,
  PipelineResult,
  ClientConfig,
  SessionStats,
  Provider,
} from "./src/types/index.ts";
export type { Message } from "./src/engine/layer5-history.ts";
