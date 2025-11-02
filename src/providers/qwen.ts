import { promises as fs } from "node:fs";
import { appConfig } from "../config/index.js";
import type { PreparedImage } from "../utils/file.js";
import { guessImageMimeType } from "../utils/file.js";
import { runCommand } from "../utils/cli.js";

export interface QwenImageOptions {
  prompt: string;
  model?: string | undefined;
  sandbox?: boolean | undefined;
  extraFlags?: string[] | undefined;
  timeoutMs: number;
  originalInput: string;
  preparedImage: PreparedImage;
  commandOverride?: string | undefined;
}

export interface QwenSuccessResult {
  stdout: string;
  durationMs: number;
  model?: string | undefined;
  promptUsed: string;
}

export async function runQwenImageAnalysis(
  options: QwenImageOptions
): Promise<QwenSuccessResult> {
  const buffer = await fs.readFile(options.preparedImage.path);
  const mimeType = guessImageMimeType(
    options.preparedImage.path,
    "image/jpeg"
  );
  const dataUrl = `data:${mimeType};base64,${buffer.toString("base64")}`;

  const imageReference = /^https?:\/\//i.test(options.originalInput)
    ? options.originalInput
    : dataUrl;

  const cliArgs: string[] = [];
  const model = options.model ?? appConfig.qwen.defaultModel;
  if (model) {
    cliArgs.push("-m", model);
  }

  if (options.sandbox) {
    cliArgs.push("-s");
  }

  if (appConfig.qwen.extraArgs?.length) {
    cliArgs.push(...appConfig.qwen.extraArgs);
  }

  if (options.extraFlags?.length) {
    cliArgs.push(...options.extraFlags);
  }

  const finalPrompt = `${options.prompt.trim()}\n\n${imageReference}`;
  cliArgs.push("-p", finalPrompt);

  const result = await runCommand(
    options.commandOverride ?? appConfig.qwen.command,
    cliArgs,
    {
      timeoutMs: options.timeoutMs,
    }
  );

  return {
    stdout: result.stdout.trim(),
    durationMs: result.durationMs,
    model,
    promptUsed: finalPrompt,
  };
}
