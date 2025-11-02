import os from "node:os";
import path from "node:path";

export interface ProviderConfig {
  command: string;
  defaultModel?: string;
  defaultPrompt?: string;
  defaultOutputFormat?: "text" | "json";
  extraArgs: string[];
}

export interface AppConfig {
  gemini: ProviderConfig;
  qwen: ProviderConfig;
  tempDir: string;
  commandTimeoutMs: number;
  maxImageBytes: number;
  allowedImageExtensions: string[];
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const asNumber = Number.parseInt(value, 10);
  return Number.isNaN(asNumber) ? fallback : asNumber;
}

function parseList(value: string | undefined): string[] | undefined {
  if (!value) {
    return undefined;
  }
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

const DEFAULT_IMAGE_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".bmp",
  ".tiff",
  ".heic",
];

function buildProviderConfig(
  prefix: "GEMINI" | "QWEN",
  defaults: ProviderConfig
): ProviderConfig {
  const extraArgs = parseList(process.env[`${prefix}_CLI_EXTRA_ARGS`]);

  const config: ProviderConfig = {
    command: process.env[`${prefix}_CLI_COMMAND`] ?? defaults.command,
    extraArgs: extraArgs ?? defaults.extraArgs,
  };

  const defaultModel =
    process.env[`${prefix}_DEFAULT_MODEL`] ?? defaults.defaultModel;
  if (defaultModel) {
    config.defaultModel = defaultModel;
  }

  const defaultPrompt =
    process.env[`${prefix}_DEFAULT_PROMPT`] ?? defaults.defaultPrompt;
  if (defaultPrompt) {
    config.defaultPrompt = defaultPrompt;
  }

  const outputFormat =
    (process.env[`${prefix}_OUTPUT_FORMAT`] as "text" | "json" | undefined) ??
    defaults.defaultOutputFormat;
  if (outputFormat) {
    config.defaultOutputFormat = outputFormat;
  }

  return config;
}

export const appConfig: AppConfig = {
  gemini: buildProviderConfig("GEMINI", {
    command: "gemini",
    defaultPrompt: "Please describe this image in detail.",
    defaultOutputFormat: "text",
    extraArgs: [],
  }),
  qwen: buildProviderConfig("QWEN", {
    command: "qwen",
    defaultPrompt: "请详细描述这张图片的内容。",
    defaultOutputFormat: "text",
    extraArgs: [],
  }),
  tempDir:
    process.env.MCP_IMAGE_TEMP_DIR ??
    path.join(os.tmpdir(), "mcp-vision-relay-cache"),
  commandTimeoutMs: parseNumber(process.env.MCP_COMMAND_TIMEOUT_MS, 120_000),
  maxImageBytes: parseNumber(process.env.MCP_MAX_IMAGE_BYTES, 25 * 1024 * 1024),
  allowedImageExtensions:
    parseList(process.env.MCP_ALLOWED_IMAGE_EXTENSIONS)?.map((ext) =>
      ext.startsWith(".") ? ext.toLowerCase() : `.${ext.toLowerCase()}`
    ) ?? DEFAULT_IMAGE_EXTENSIONS,
};
