import type {
  CompressionConfig,
  PipelineResult,
  LayerResult,
  Layer,
} from "../types/index.ts";
import { layer5 } from "./layer5-history.ts";
import { layer4 } from "./layer4-system.ts";
import { layer3 } from "./layer3-media.ts";
import { layer2 } from "./layer2-code.ts";
import { layer1, compressMessage } from "./layer1-message.ts";
import { computeStats } from "./token-counter.ts";
import { verifyCompression } from "./verify.ts";

const DEFAULT_CONFIG: CompressionConfig = {
  messages: true,
  codeBlocks: true,
  media: true,
  systemPrompt: true,
  history: true,
  tier: "B",
};

// Layers run in order: 5→4→3→2→1 (biggest savings first)
const layers: Layer[] = [layer5, layer4, layer3, layer2, layer1];

export function compress(
  text: string,
  config?: Partial<CompressionConfig>
): PipelineResult {
  const cfg: CompressionConfig = { ...DEFAULT_CONFIG, ...config };
  const original = text;
  let current = text;
  const layerResults: LayerResult[] = [];

  for (const layer of layers) {
    try {
      const before = current;
      current = layer.process(current, cfg);
      layerResults.push({
        text: current,
        layerName: layer.name,
        skipped: false,
      });

      // If layer didn't change anything, mark it
      if (current === before) {
        layerResults[layerResults.length - 1]!.skipped = true;
      }
    } catch (error) {
      // If any layer throws, skip it and pass through original
      // Log for debugging — silent to the user, but trackable
      if (process.env.SMART_TOKEN_DEBUG) {
        console.error(
          `[smart-token] Layer "${layer.name}" failed:`,
          error instanceof Error ? error.message : error
        );
      }
      layerResults.push({
        text: current,
        layerName: layer.name,
        skipped: true,
      });
    }
  }

  // Verification pass — catch context loss before it reaches the model
  const verification = verifyCompression(original, current, cfg.tier);
  if (verification.restored) {
    current = verification.compressed;
    layerResults.push({
      text: current,
      layerName: "verify",
      skipped: false,
    });
  }

  // Get tone/intent from the original message (before compression)
  const { toneIntent } = compressMessage(original, cfg.tier);
  const stats = computeStats(original, current);

  return {
    original,
    compressed: current,
    stats,
    layers: layerResults,
    toneIntent,
  };
}
