import { z } from "zod";
import { appConfig } from "../config/index.js";
import { runQwenImageAnalysis } from "../providers/qwen.js";
import { prepareImage } from "../utils/file.js";
import { CommandError } from "../utils/cli.js";
import { registerTool } from "./registry.js";

const qwenSchema = z
  .object({
    image: z
      .string()
      .min(1)
      .describe(
        "Local file path, http(s) URL, or base64-encoded image to analyze."
      ),
    prompt: z
      .string()
      .min(1)
      .optional()
      .describe("Instruction for Qwen. Defaults to config value."),
    model: z
      .string()
      .min(1)
      .optional()
      .describe("Qwen model identifier."),
    cliPath: z
      .string()
      .min(1)
      .optional()
      .describe("Override the Qwen CLI executable path."),
    sandbox: z
      .boolean()
      .optional()
      .describe("Whether to run the CLI with the sandbox flag (-s)."),
    extraFlags: z
      .array(z.string().min(1))
      .optional()
      .describe("Additional CLI flags to append as-is."),
    timeoutMs: z
      .number()
      .int()
      .positive()
      .max(600_000)
      .optional()
      .describe("Maximum time (in milliseconds) to wait for CLI execution."),
  })
  .describe("Invoke Qwen CLI to analyze an image.");

type QwenArgs = z.infer<typeof qwenSchema>;

registerTool({
  name: "qwen_analyze_image",
  description:
    "Use Qwen CLI to describe or analyze an image with its multimodal capabilities.",
  schema: qwenSchema,
  async execute(args: QwenArgs) {
    const originalInput = args.image.trim();
    const prepared = await prepareImage(originalInput, appConfig);
    const prompt =
      args.prompt?.trim() ??
      appConfig.qwen.defaultPrompt ??
      "请描述这张图片的内容。";

    try {
      const result = await runQwenImageAnalysis({
        prompt,
        model: args.model,
        sandbox: args.sandbox,
        extraFlags: args.extraFlags,
        timeoutMs: args.timeoutMs ?? appConfig.commandTimeoutMs,
        originalInput,
        preparedImage: prepared,
        commandOverride: args.cliPath,
      });

      const cleaned = result.stdout || "(Qwen CLI returned no output)";
      const metaLines = [
        `model: ${result.model ?? "default"}`,
        `imageSource: ${prepared.source}`,
        `durationMs: ${result.durationMs}`,
      ];
      if (prepared.source === "local") {
        metaLines.push(`imagePath: ${prepared.path}`);
      }

      return {
        content: [
          {
            type: "text",
            text: [
              "### Qwen Output",
              cleaned,
              "",
              metaLines.join("\n"),
            ].join("\n"),
          },
        ],
        isError: false,
      } as const;
    } catch (error) {
      if (error instanceof CommandError) {
        const details = [
          error.message,
          error.result.stderr.trim() && `stderr:\n${error.result.stderr.trim()}`,
          error.result.stdout.trim() && `stdout:\n${error.result.stdout.trim()}`,
        ]
          .filter(Boolean)
          .join("\n\n");
        return {
          content: [
            {
              type: "text",
              text: `Qwen CLI failed:\n${details}`,
            },
          ],
          isError: true,
        };
      }
      throw error;
    } finally {
      await prepared.cleanup();
    }
  },
});
