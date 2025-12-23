/**
 * MCP Server for Council
 *
 * Exposes council tools as MCP endpoints for automation.
 * Implements the Model Context Protocol for tool integration.
 */

import { createServer as createHttpServer, type Server, type IncomingMessage, type ServerResponse } from "node:http";
import { loadThreadState, createThread, getThreadPaths, listThreads } from "./thread.js";
import { createMessage, writeInboxMessage } from "./message.js";
import { generatePrompts, generatePromptForRepo } from "./prompts.js";
import { workspaceExists } from "./workspace.js";

export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface McpToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface McpResponse {
  content: Array<{
    type: "text";
    text: string;
  }>;
  isError?: boolean;
}

/**
 * Define available MCP tools
 */
export const mcpTools: McpTool[] = [
  {
    name: "council_thread_create",
    description: "Create a new conversation thread for multi-repo debugging",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Title describing the issue or topic",
        },
        repos: {
          type: "array",
          items: { type: "string" },
          description: "List of repo names to include",
        },
      },
      required: ["title", "repos"],
    },
  },
  {
    name: "council_thread_status",
    description: "Get the current status of a thread",
    inputSchema: {
      type: "object",
      properties: {
        thread_id: {
          type: "string",
          description: "The thread ID",
        },
      },
      required: ["thread_id"],
    },
  },
  {
    name: "council_ask",
    description: "Send a message from one repo to another",
    inputSchema: {
      type: "object",
      properties: {
        thread_id: {
          type: "string",
          description: "The thread ID",
        },
        from: {
          type: "string",
          description: "Source repo name",
        },
        to: {
          type: "string",
          description: "Target repo name (or ALL)",
        },
        type: {
          type: "string",
          enum: ["question", "answer", "hypothesis", "patch_proposal", "resolution"],
          description: "Message type",
        },
        summary: {
          type: "string",
          description: "Brief summary of the message",
        },
      },
      required: ["thread_id", "from", "to", "type", "summary"],
    },
  },
  {
    name: "council_prompts",
    description: "Generate prompts for pending repos in a thread",
    inputSchema: {
      type: "object",
      properties: {
        thread_id: {
          type: "string",
          description: "The thread ID",
        },
        repo: {
          type: "string",
          description: "Specific repo (optional, omit for all pending)",
        },
      },
      required: ["thread_id"],
    },
  },
  {
    name: "council_list_threads",
    description: "List all threads in the workspace",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

/**
 * Execute an MCP tool call
 */
export async function executeTool(
  basePath: string,
  tool: McpToolCall
): Promise<McpResponse> {
  try {
    // Validate workspace exists
    if (!(await workspaceExists(basePath))) {
      return {
        content: [{ type: "text", text: "No council workspace found. Run 'council init' first." }],
        isError: true,
      };
    }

    switch (tool.name) {
      case "council_thread_create": {
        const { title, repos } = tool.arguments as { title: string; repos: string[] };
        const result = await createThread(basePath, { title, repos });
        const state = await loadThreadState(basePath, result.threadId);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              thread_id: state.id,
              title: state.title,
              repos: state.repos,
              status: state.status,
            }, null, 2),
          }],
        };
      }

      case "council_thread_status": {
        const { thread_id } = tool.arguments as { thread_id: string };
        const state = await loadThreadState(basePath, thread_id);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              id: state.id,
              title: state.title,
              status: state.status,
              turn: state.turn,
              pending_for: state.pending_for,
              suspects: state.suspects,
              repos: state.repos,
            }, null, 2),
          }],
        };
      }

      case "council_ask": {
        const { thread_id, from, to, type, summary } = tool.arguments as {
          thread_id: string;
          from: string;
          to: string;
          type: string;
          summary: string;
        };
        const message = createMessage({
          threadId: thread_id,
          from,
          to,
          type: type as "question" | "answer" | "hypothesis" | "patch_proposal" | "resolution",
          summary,
        });
        await writeInboxMessage(basePath, thread_id, message);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              message_id: message.message_id,
              from: message.from,
              to: message.to,
              type: message.type,
              summary: message.summary,
            }, null, 2),
          }],
        };
      }

      case "council_prompts": {
        const { thread_id, repo } = tool.arguments as { thread_id: string; repo?: string };

        if (repo) {
          const prompt = await generatePromptForRepo(basePath, thread_id, repo);
          if (!prompt) {
            return {
              content: [{ type: "text", text: `Repo "${repo}" is not pending in this thread.` }],
              isError: true,
            };
          }
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                repo: prompt.repo,
                prompt: prompt.prompt,
                messageCount: prompt.inboxMessages.length,
              }, null, 2),
            }],
          };
        }

        const prompts = await generatePrompts(basePath, thread_id);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(
              prompts.map((p) => ({
                repo: p.repo,
                promptLength: p.prompt.length,
                messageCount: p.inboxMessages.length,
              })),
              null,
              2
            ),
          }],
        };
      }

      case "council_list_threads": {
        try {
          const threads = await listThreads(basePath);
          return {
            content: [{
              type: "text",
              text: JSON.stringify(
                threads.map((t) => ({
                  id: t.id,
                  title: t.title,
                  status: t.status,
                  turn: t.turn,
                })),
                null,
                2
              ),
            }],
          };
        } catch {
          return {
            content: [{ type: "text", text: "[]" }],
          };
        }
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${tool.name}` }],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [{ type: "text", text: `Error: ${(error as Error).message}` }],
      isError: true,
    };
  }
}

/**
 * MCP Protocol Handler
 */
export class McpServer {
  private basePath: string;
  private server: Server | null = null;

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  /**
   * Handle incoming MCP requests
   */
  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    // Enable CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method !== "POST") {
      res.writeHead(405, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Method not allowed" }));
      return;
    }

    // Read body
    let body = "";
    for await (const chunk of req) {
      body += chunk;
    }

    try {
      const request = JSON.parse(body);

      // Handle different MCP endpoints
      if (req.url === "/tools/list") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ tools: mcpTools }));
        return;
      }

      if (req.url === "/tools/call") {
        const result = await executeTool(this.basePath, request);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
        return;
      }

      // MCP initialize
      if (req.url === "/initialize" || request.method === "initialize") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: {},
          },
          serverInfo: {
            name: "council-mcp",
            version: "0.1.0",
          },
        }));
        return;
      }

      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
    } catch (error) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: (error as Error).message }));
    }
  }

  /**
   * Start the MCP server
   */
  start(port: number = 3456): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = createHttpServer((req, res) => {
        this.handleRequest(req, res).catch((err) => {
          console.error("MCP request error:", err);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Internal server error" }));
        });
      });

      this.server.on("error", reject);

      this.server.listen(port, () => {
        console.log(`MCP server listening on port ${port}`);
        resolve();
      });
    });
  }

  /**
   * Stop the MCP server
   */
  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

/**
 * Create and start an MCP server
 */
export function createMcpServer(basePath: string): McpServer {
  return new McpServer(basePath);
}
