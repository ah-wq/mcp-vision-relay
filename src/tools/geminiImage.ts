import { z } from "zod";
import { appConfig } from "../config/index.js";
import { runGeminiImageAnalysis } from "../providers/gemini.js";
import { prepareImage } from "../utils/file.js";
import { createAttachmentReference } from "../utils/prompt.js";
import { CommandError } from "../utils/cli.js";
import { registerTool } from "./registry.js";

const geminiSchema = z
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
      .describe("Instruction for Gemini. Defaults to config value."),
    model: z
      .string()
      .min(1)
      .optional()
      .describe("Gemini model identifier (e.g., gemini-2.0-flash)."),
    cliPath: z
      .string()
      .min(1)
      .optional()
      .describe("Override the Gemini CLI executable path."),
    sandbox: z
      .boolean()
      .optional()
      .describe("Whether to run the CLI with the sandbox flag (-s)."),
    outputFormat: z
      .enum(["text", "json"])
      .optional()
      .describe("Request Gemini CLI to return the specified output format."),
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
  .describe("Invoke Gemini CLI to analyze an image.");

type GeminiArgs = z.infer<typeof geminiSchema>;

registerTool({
  name: "gemini_analyze_image",
  description:
    "Use Google Gemini CLI to describe or analyze an image using multimodal capabilities.",
  schema: geminiSchema,
  async execute(args: GeminiArgs) {
    const prepared = await prepareImage(args.image, appConfig);
    const prompt =
      args.prompt?.trim() ??
      appConfig.gemini.defaultPrompt ??
      "Describe this image.";
    const attachment = createAttachmentReference(prepared.path);
    try {
      const result = await runGeminiImageAnalysis({
        prompt,
        model: args.model,
        sandbox: args.sandbox,
        outputFormat: args.outputFormat,
        extraFlags: args.extraFlags,
        timeoutMs: args.timeoutMs ?? appConfig.commandTimeoutMs,
        imageReference: attachment,
        preparedImage: prepared,
        commandOverride: args.cliPath,
      });

      const cleaned = result.stdout || "(Gemini CLI returned no output)";
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
              "### Gemini Output",
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
              text: `Gemini CLI failed:\n${details}`,
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
