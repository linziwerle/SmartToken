export type Mode = "off" | "quiet" | "default" | "dev";

export interface SmartTokenConfig {
  mode: Mode;
  tier: string;
  port: number;
}

const CONFIG_DIR = `${process.env.HOME}/.smart-token`;
const CONFIG_PATH = `${CONFIG_DIR}/config.json`;

const DEFAULTS: SmartTokenConfig = {
  mode: "quiet",
  tier: "B",
  port: 3141,
};

export function loadConfig(): SmartTokenConfig {
  try {
    // Synchronous read for hot-reload on each request
    const file = Bun.file(CONFIG_PATH);
    // Use a sync approach: read the file
    const text = require("fs").readFileSync(CONFIG_PATH, "utf-8");
    const parsed = JSON.parse(text) as Partial<SmartTokenConfig>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function saveConfig(updates: Partial<SmartTokenConfig>): Promise<SmartTokenConfig> {
  await Bun.$`mkdir -p ${CONFIG_DIR}`;
  const current = loadConfig();
  const updated = { ...current, ...updates };
  await Bun.write(CONFIG_PATH, JSON.stringify(updated, null, 2) + "\n");
  return updated;
}

export function getConfigPath(): string {
  return CONFIG_PATH;
}

export function getConfigDir(): string {
  return CONFIG_DIR;
}
