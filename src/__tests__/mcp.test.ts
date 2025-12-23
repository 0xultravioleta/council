import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("../lib/thread.js", () => ({
  loadThreadState: vi.fn().mockResolvedValue({
    id: "th_test",
    title: "Test Thread",
    repos: ["repo-a", "repo-b"],
    pending_for: ["repo-a"],
    status: "active",
    turn: 1,
    suspects: [],
  }),
  createThread: vi.fn().mockResolvedValue({
    threadId: "th_new",
    paths: {},
  }),
  getThreadPaths: vi.fn().mockReturnValue({
    root: "/test/.council/threads/th_test",
    inbox: "/test/.council/threads/th_test/inbox",
    outbox: "/test/.council/threads/th_test/outbox",
    prompts: "/test/.council/threads/th_test/prompts",
  }),
  listThreads: vi.fn().mockResolvedValue([
    { id: "th_001", title: "Thread 1", status: "active", turn: 2, repos: ["a"], created_at: "2025-01-01" },
    { id: "th_002", title: "Thread 2", status: "resolved", turn: 5, repos: ["b"], created_at: "2025-01-02" },
  ]),
}));

vi.mock("../lib/message.js", () => ({
  createMessage: vi.fn().mockReturnValue({
    message_id: "msg_test",
    thread_id: "th_test",
    from: "repo-a",
    to: "repo-b",
    type: "question",
    summary: "Test message",
    timestamp: "2025-01-01T00:00:00Z",
  }),
  writeInboxMessage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/prompts.js", () => ({
  generatePrompts: vi.fn().mockResolvedValue([
    {
      repo: "repo-a",
      prompt: "Test prompt for repo-a",
      inboxMessages: [{ from: "repo-b", summary: "Question" }],
    },
  ]),
  generatePromptForRepo: vi.fn().mockResolvedValue({
    repo: "repo-a",
    prompt: "Test prompt for repo-a",
    inboxMessages: [{ from: "repo-b", summary: "Question" }],
  }),
}));

vi.mock("../lib/workspace.js", () => ({
  workspaceExists: vi.fn().mockResolvedValue(true),
}));

describe("MCP Tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("mcpTools", () => {
    it("should export tool definitions", async () => {
      const { mcpTools } = await import("../lib/mcp.js");

      expect(mcpTools).toBeDefined();
      expect(Array.isArray(mcpTools)).toBe(true);
      expect(mcpTools.length).toBeGreaterThan(0);

      // Check tool structure
      for (const tool of mcpTools) {
        expect(tool.name).toBeDefined();
        expect(tool.description).toBeDefined();
        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema.type).toBe("object");
      }
    });

    it("should have council_thread_create tool", async () => {
      const { mcpTools } = await import("../lib/mcp.js");

      const createTool = mcpTools.find((t) => t.name === "council_thread_create");
      expect(createTool).toBeDefined();
      expect(createTool?.inputSchema.required).toContain("title");
      expect(createTool?.inputSchema.required).toContain("repos");
    });

    it("should have council_ask tool", async () => {
      const { mcpTools } = await import("../lib/mcp.js");

      const askTool = mcpTools.find((t) => t.name === "council_ask");
      expect(askTool).toBeDefined();
      expect(askTool?.inputSchema.required).toContain("thread_id");
      expect(askTool?.inputSchema.required).toContain("from");
      expect(askTool?.inputSchema.required).toContain("to");
    });
  });

  describe("executeTool", () => {
    it("should return error for invalid workspace", async () => {
      const { executeTool } = await import("../lib/mcp.js");
      const { workspaceExists } = await import("../lib/workspace.js");
      vi.mocked(workspaceExists).mockResolvedValueOnce(false);

      const result = await executeTool("/invalid", {
        name: "council_list_threads",
        arguments: {},
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("No council workspace");
    });

    it("should list threads", async () => {
      const { executeTool } = await import("../lib/mcp.js");

      const result = await executeTool("/test", {
        name: "council_list_threads",
        arguments: {},
      });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(2);
    });

    it("should get thread status", async () => {
      const { executeTool } = await import("../lib/mcp.js");

      const result = await executeTool("/test", {
        name: "council_thread_status",
        arguments: { thread_id: "th_test" },
      });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.id).toBe("th_test");
      expect(data.status).toBe("active");
    });

    it("should create thread", async () => {
      const { executeTool } = await import("../lib/mcp.js");
      const { loadThreadState } = await import("../lib/thread.js");

      vi.mocked(loadThreadState).mockResolvedValueOnce({
        id: "th_new",
        title: "New Thread",
        repos: ["repo-a", "repo-b"],
        status: "active",
        turn: 0,
        pending_for: [],
        suspects: [],
        created_at: "2025-01-01",
        updated_at: "2025-01-01",
      });

      const result = await executeTool("/test", {
        name: "council_thread_create",
        arguments: { title: "New Thread", repos: ["repo-a", "repo-b"] },
      });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.thread_id).toBe("th_new");
    });

    it("should send message via council_ask", async () => {
      const { executeTool } = await import("../lib/mcp.js");

      const result = await executeTool("/test", {
        name: "council_ask",
        arguments: {
          thread_id: "th_test",
          from: "repo-a",
          to: "repo-b",
          type: "question",
          summary: "Test question",
        },
      });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.message_id).toBe("msg_test");
      expect(data.type).toBe("question");
    });

    it("should return error for unknown tool", async () => {
      const { executeTool } = await import("../lib/mcp.js");

      const result = await executeTool("/test", {
        name: "unknown_tool",
        arguments: {},
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Unknown tool");
    });
  });
});
