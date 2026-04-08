// ── Tiers ──
export type Tier = "A" | "B" | "C";

// ── Tone & Intent ──
export type Tone =
  | "polite"
  | "uncertain"
  | "frustrated"
  | "exploring"
  | "urgent"
  | "neutral";

export type Intent =
  | "confirm"
  | "compare"
  | "explain"
  | "fix"
  | "build"
  | "review"
  | "explore";

export interface ToneIntent {
  tones: Tone[];
  intent: Intent | null;
}

// ── Compression ──
export interface CompressionConfig {
  messages: boolean;
  codeBlocks: boolean;
  media: boolean;
  systemPrompt: boolean;
  history: boolean;
  tier: Tier;
}

export interface TokenStats {
  originalTokens: number;
  compressedTokens: number;
  saved: number;
  savingsPercent: string;
  costSaved: string;
}

export interface LayerResult {
  text: string;
  layerName: string;
  skipped: boolean;
}

export interface PipelineResult {
  original: string;
  compressed: string;
  stats: TokenStats;
  layers: LayerResult[];
  toneIntent: ToneIntent;
}

// ── SDK ──
export type Provider =
  | "anthropic"
  | "openai"
  | "google"
  | "generic";

export interface ClientConfig {
  provider: Provider;
  apiKey: string;
  compression?: Partial<CompressionConfig>;
  logging?: {
    enabled: boolean;
    output?: string;
  };
}

export interface SessionStats {
  totalMessages: number;
  totalTokensSaved: number;
  totalOriginalTokens: number;
  savingsPercent: string;
  estimatedCostSaved: string;
  topSavingLayer: string;
}

// ── Rules ──
export interface CompressionRule {
  name: string;
  pattern: RegExp;
  replacement: string;
  tier: Tier;
}

export interface RuleSet {
  tier: Tier;
  rules: CompressionRule[];
}

// ── Layer interface ──
export interface Layer {
  name: string;
  process(text: string, config: CompressionConfig): string;
}
