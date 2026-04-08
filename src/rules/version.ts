export const RULES_VERSION = "1.0.0";

export interface VersionedTier {
  tier: "A" | "B" | "C";
  version: string | null; // null = latest
}

/**
 * Parse tier specification like "B" or "B@1.0"
 */
export function parseTierSpec(spec: string): VersionedTier {
  const match = spec.match(/^([ABC])(?:@(.+))?$/i);
  if (!match) {
    return { tier: "B", version: null }; // default
  }
  return {
    tier: match[1]!.toUpperCase() as "A" | "B" | "C",
    version: match[2] ?? null,
  };
}

/**
 * Check if the requested version is compatible with current rules.
 * For now, only 1.0.0 exists so everything is compatible.
 */
export function isVersionCompatible(
  requested: string | null,
  current = RULES_VERSION
): boolean {
  if (!requested) return true; // latest always compatible
  // Semver major match
  const reqMajor = requested.split(".")[0];
  const curMajor = current.split(".")[0];
  return reqMajor === curMajor;
}
