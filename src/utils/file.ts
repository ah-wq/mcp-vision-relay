import { createWriteStream } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { pipeline } from "node:stream/promises";
import type { AppConfig } from "../config/index.js";

export type PreparedImageSource = "local" | "downloaded" | "base64";

export interface PreparedImage {
  path: string;
  cleanup: () => Promise<void>;
  source: PreparedImageSource;
  sizeBytes: number;
}

const DATA_URL_PATTERN = /^data:(?<mime>[\w/+.-]+);base64,(?<data>.+)$/i;

const MIME_EXTENSION_MAP: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/bmp": ".bmp",
  "image/tiff": ".tiff",
  "image/heic": ".heic",
};

function looksLikeUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

async function ensureTempDirectory(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

export function determineExtension(
  pathOrMime: string,
  fallback = ".bin"
): string {
  const byMime = MIME_EXTENSION_MAP[pathOrMime.toLowerCase()];
  if (byMime) {
    return byMime;
  }

  const ext = path.extname(pathOrMime);
  if (ext) {
    return ext.toLowerCase();
  }

  return fallback;
}

const EXTENSION_MIME_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(MIME_EXTENSION_MAP).map(([mime, ext]) => [ext, mime])
);

export function guessImageMimeType(
  filePath: string,
  fallback: string = "application/octet-stream"
): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext && EXTENSION_MIME_MAP[ext]) {
    return EXTENSION_MIME_MAP[ext];
  }
  return fallback;
}

async function validateImage(
  filePath: string,
  sizeLimit: number,
  allowedExtensions: string[]
): Promise<number> {
  const stats = await fs.stat(filePath);
  if (!stats.isFile()) {
    throw new Error(`Provided path is not a file: ${filePath}`);
  }

  if (stats.size === 0) {
    throw new Error(`Image file appears to be empty: ${filePath}`);
  }

  if (stats.size > sizeLimit) {
    throw new Error(
      `Image size ${stats.size} exceeds limit of ${sizeLimit} bytes`
    );
  }

  const extension = path.extname(filePath).toLowerCase();
  if (extension && !allowedExtensions.includes(extension)) {
    throw new Error(
      `Unsupported image extension "${extension}". Allowed: ${allowedExtensions.join(
        ", "
      )}`
    );
  }

  return stats.size;
}

async function writeBufferToFile(
  buffer: Buffer,
  destination: string
): Promise<void> {
  await fs.writeFile(destination, buffer, { mode: 0o600 });
}

export async function prepareImage(
  input: string,
  config: AppConfig
): Promise<PreparedImage> {
  const trimmed = input.trim();
  await ensureTempDirectory(config.tempDir);

  if (await fileExists(trimmed)) {
    const absolutePath = path.resolve(trimmed);
    const sizeBytes = await validateImage(
      absolutePath,
      config.maxImageBytes,
      config.allowedImageExtensions
    );
    return {
      path: absolutePath,
      cleanup: async () => {},
      source: "local",
      sizeBytes,
    };
  }

  const dataUrlMatch = trimmed.match(DATA_URL_PATTERN);
  if (dataUrlMatch?.groups) {
    const { mime, data } = dataUrlMatch.groups as { mime: string; data: string };
    const buffer = Buffer.from(data, "base64");
    if (!buffer.length) {
      throw new Error("Provided data URL does not contain any data.");
    }

    const extension = determineExtension(mime, ".png");
    const tempPath = path.join(
      config.tempDir,
      `mcp-vision-relay-${randomUUID()}${extension}`
    );
    await writeBufferToFile(buffer, tempPath);
    const sizeBytes = await validateImage(
      tempPath,
      config.maxImageBytes,
      config.allowedImageExtensions
    );
    return {
      path: tempPath,
      cleanup: async () => cleanupFile(tempPath),
      source: "base64",
      sizeBytes,
    };
  }

  if (looksLikeUrl(trimmed)) {
    const url = new URL(trimmed);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to download image. HTTP ${response.status} ${response.statusText}`
      );
    }

    const contentType = response.headers.get("content-type") ?? "";
    const extension = determineExtension(
      path.extname(url.pathname) || contentType,
      ".png"
    );
    const tempPath = path.join(
      config.tempDir,
      `mcp-vision-relay-${randomUUID()}${extension}`
    );

    const stream = createWriteStream(tempPath, { mode: 0o600 });
    try {
      if (!response.body) {
        throw new Error("Download response did not include a readable body.");
      }
      await pipeline(response.body, stream);
    } catch (error) {
      await cleanupFile(tempPath);
      throw error;
    }

    const sizeBytes = await validateImage(
      tempPath,
      config.maxImageBytes,
      config.allowedImageExtensions
    );
    return {
      path: tempPath,
      cleanup: async () => cleanupFile(tempPath),
      source: "downloaded",
      sizeBytes,
    };
  }

  // Raw base64 without data URL prefix
  if (/^[a-z0-9+/=\s]+$/i.test(trimmed)) {
    try {
      const buffer = Buffer.from(trimmed.replace(/\s+/g, ""), "base64");
      if (!buffer.length) {
        throw new Error("Base64 data did not decode to any bytes.");
      }

      const tempPath = path.join(
        config.tempDir,
        `mcp-vision-relay-${randomUUID()}.png`
      );
      await writeBufferToFile(buffer, tempPath);
      const sizeBytes = await validateImage(
        tempPath,
        config.maxImageBytes,
        config.allowedImageExtensions
      );
      return {
        path: tempPath,
        cleanup: async () => cleanupFile(tempPath),
        source: "base64",
        sizeBytes,
      };
    } catch (error) {
      throw new Error(
        `Failed to decode base64 image data: ${(error as Error).message}`
      );
    }
  }

  throw new Error(
    "Unsupported image input. Provide a local file path, http(s) URL, or base64 string."
  );
}

async function fileExists(candidate: string): Promise<boolean> {
  try {
    await fs.access(candidate);
    return true;
  } catch {
    return false;
  }
}

async function cleanupFile(filePath: string): Promise<void> {
  await fs
    .unlink(filePath)
    .catch(() => {
      /* ignore */
    });
}
