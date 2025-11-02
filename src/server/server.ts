import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type {
  CallToolRequest,
  CallToolResult,
  ListToolsRequest,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { appConfig } from "../config/index.js";
import { listTools, runTool } from "../tools/index.js";

const server = new Server(
  {
    name: "mcp-vision-relay",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(
  ListToolsRequestSchema,
  async (_request: ListToolsRequest): Promise<{ tools: Tool[] }> => {
    return { tools: listTools() as Tool[] };
  }
);

server.setRequestHandler(
  CallToolRequestSchema,
  async (request: CallToolRequest): Promise<CallToolResult> => {
    const toolName = request.params.name;
    const args = request.params.arguments ?? {};

    try {
      return await runTool(toolName, args);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : JSON.stringify(error);
      return {
        content: [
          {
            type: "text",
            text: `Failed to execute tool "${toolName}": ${message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

export async function startServer(): Promise<void> {
  console.error(
    `[mcp-vision-relay] Starting server (tempDir=${appConfig.tempDir})`
  );
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[mcp-vision-relay] Listening on stdio");
}

export async function run(): Promise<void> {
  try {
    await startServer();
  } catch (error) {
    console.error("[mcp-vision-relay] Fatal error", error);
    process.exit(1);
  }
}
