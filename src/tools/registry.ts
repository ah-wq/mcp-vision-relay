import type { Tool, CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { z, ZodTypeAny } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

export interface RegisteredTool<TSchema extends ZodTypeAny = ZodTypeAny> {
  name: string;
  description: string;
  schema: TSchema;
  execute: (args: z.infer<TSchema>) => Promise<CallToolResult>;
}

const tools: RegisteredTool<ZodTypeAny>[] = [];

export function registerTool<TSchema extends ZodTypeAny>(
  tool: RegisteredTool<TSchema>
): void {
  tools.push(tool as unknown as RegisteredTool<ZodTypeAny>);
}

export function listTools(): Tool[] {
  return tools.map((tool) => {
    const jsonSchema = zodToJsonSchema(tool.schema, tool.name) as any;
    const schemaObject = jsonSchema.definitions?.[tool.name] ?? jsonSchema;

    return {
      name: tool.name,
      description: tool.description,
      inputSchema: {
        type: "object",
        properties: schemaObject.properties ?? {},
        required: schemaObject.required ?? [],
      },
    };
  });
}

export async function runTool(
  name: string,
  rawArgs: unknown
): Promise<CallToolResult> {
  const tool = tools.find((entry) => entry.name === name);
  if (!tool) {
    throw new Error(`Unknown tool: ${name}`);
  }

  const parsedArgs = tool.schema.parse(rawArgs);
  return tool.execute(parsedArgs);
}
