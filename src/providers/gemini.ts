import { appConfig } from "../config/index.js";
import type { PreparedImage } from "../utils/file.js";
import { runCommand, CommandError } from "../utils/cli.js";

export interface GeminiImageOptions {
  prompt: string;
  model?: string | undefined;
  sandbox?: boolean | undefined;
  outputFormat?: "text" | "json" | undefined;
  extraFlags?: string[] | undefined;
  timeoutMs: number;
  imageReference: string;
  preparedImage: PreparedImage;
  commandOverride?: string | undefined;
}

export interface GeminiSuccessResult {
  stdout: string;
  durationMs: number;
  model?: string | undefined;
}

export type GeminiFailure = CommandError;

export async function runGeminiImageAnalysis(
  options: GeminiImageOptions
): Promise<GeminiSuccessResult> {
  const cliArgs: string[] = [];

  const model = options.model ?? appConfig.gemini.defaultModel;
  if (model) {
    cliArgs.push("-m", model);
  }

  const outputFormat =
    options.outputFormat ?? appConfig.gemini.defaultOutputFormat;
  if (outputFormat && outputFormat !== "text") {
    cliArgs.push("-o", outputFormat);
  }

  if (options.sandbox) {
    cliArgs.push("-s");
  }

  if (appConfig.gemini.extraArgs?.length) {
    cliArgs.push(...appConfig.gemini.extraArgs);
  }

  if (options.extraFlags?.length) {
    cliArgs.push(...options.extraFlags);
  }

  const finalPrompt = `${options.prompt.trim()}\n\n${options.imageReference}`;
  cliArgs.push("-p", finalPrompt);

  const command = options.commandOverride ?? appConfig.gemini.command;

  const result = await runCommand(command, cliArgs, {
    timeoutMs: options.timeoutMs,
  });

  return {
    stdout: result.stdout.trim(),
    durationMs: result.durationMs,
    model,
  };
}
