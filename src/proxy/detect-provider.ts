import type { Provider } from "../types/index.ts";

interface ProviderInfo {
  provider: Provider;
  targetBase: string;
}

const PROVIDER_MAP: { pattern: RegExp; provider: Provider; target: string }[] = [
  { pattern: /^\/v1\/messages/, provider: "anthropic", target: "https://api.anthropic.com" },
  { pattern: /^\/openai\//, provider: "openai", target: "https://api.openai.com" },
  { pattern: /^\/v1\/chat\/completions/, provider: "openai", target: "https://api.openai.com" },
  { pattern: /^\/google\//, provider: "google", target: "https://generativelanguage.googleapis.com" },
  { pattern: /^\/v1beta\//, provider: "google", target: "https://generativelanguage.googleapis.com" },
];

export function detectProvider(pathname: string): ProviderInfo {
  for (const { pattern, provider, target } of PROVIDER_MAP) {
    if (pattern.test(pathname)) {
      return { provider, targetBase: target };
    }
  }

  // Default: treat as OpenAI-compatible
  return {
    provider: "generic",
    targetBase: process.env.SMART_TOKEN_TARGET ?? "https://api.openai.com",
  };
}

// Strip proxy-specific path prefixes so the real API gets the right path
export function resolveTargetPath(pathname: string): string {
  // /openai/v1/chat/completions → /v1/chat/completions
  if (pathname.startsWith("/openai/")) {
    return pathname.slice("/openai".length);
  }
  // /google/v1beta/... → /v1beta/...
  if (pathname.startsWith("/google/")) {
    return pathname.slice("/google".length);
  }
  return pathname;
}
