import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  MemoryManager,
  createMemoryManager,
  type MemoryConfig,
} from "../lib/memory.js";
import type { ThreadState } from "../lib/thread.js";
import type { Message } from "../lib/message.js";

// Mock the acontext client
vi.mock("../lib/acontext.js", () => ({
  createAcontextClient: vi.fn().mockReturnValue({
    healthCheck: vi.fn().mockResolvedValue(true),
    experienceSearch: vi.fn().mockResolvedValue({
      sops: [
        {
          id: "sop-1",
          title: "Debug payment failures",
          description: "Steps for debugging payment issues",
          steps: ["Check logs", "Verify request", "Test endpoint"],
          confidence: 0.85,
          source_sessions: ["session-1"],
          created_at: "2025-01-01T00:00:00Z",
        },
      ],
      relevance_scores: [0.85],
    }),
    createSession: vi.fn().mockResolvedValue({
      id: "session-123",
      space_name: "test-space",
      title: "Test Thread",
      labels: [],
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
      status: "active",
    }),
    getSessionByThreadId: vi.fn().mockResolvedValue(null),
    updateSession: vi.fn(),
    learn: vi.fn().mockResolvedValue({ sops_created: 1, sops: [] }),
  }),
  formatSOPsForPrompt: vi.fn().mockReturnValue("=== RUNBOOKS FROM ACONTEXT ===\n"),
  AcontextError: class extends Error {},
}));

describe("MemoryManager", () => {
  const mockConfig: MemoryConfig = {
    enabled: true,
    acontext: {
      base_url: "http://localhost:8029/api/v1",
      api_key: "test-key",
      space_name: "test-space",
    },
  };

  const mockThread: ThreadState = {
    id: "th_test",
    title: "Test Thread",
    repos: ["repo-a", "repo-b"],
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    turn: 5,
    status: "resolved",
    pending_for: [],
    suspects: [],
    resolution_summary: "Fixed the bug",
  };

  const mockMessages: Message[] = [
    {
      message_id: "msg-1",
      thread_id: "th_test",
      from: "repo-a",
      to: "repo-b",
      type: "question",
      summary: "What happened?",
      timestamp: "2025-01-01T00:00:00Z",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should create manager with disabled config", () => {
      const manager = new MemoryManager({ enabled: false });
      expect(manager.getStatus().enabled).toBe(false);
    });

    it("should create manager with enabled config", () => {
      const manager = new MemoryManager(mockConfig);
      expect(manager.getStatus().enabled).toBe(true);
    });
  });

  describe("initialize", () => {
    it("should check acontext health", async () => {
      const manager = new MemoryManager(mockConfig);
      const status = await manager.initialize();

      expect(status.acontext.available).toBe(true);
    });

    it("should return unavailable when disabled", async () => {
      const manager = new MemoryManager({ enabled: false });
      const status = await manager.initialize();

      expect(status.enabled).toBe(false);
      expect(status.acontext.available).toBe(false);
    });
  });

  describe("getContextForThread", () => {
    it("should return empty context when disabled", async () => {
      const manager = new MemoryManager({ enabled: false });
      const context = await manager.getContextForThread("Test", ["repo-a"]);

      expect(context.sops).toHaveLength(0);
      expect(context.sopPrompt).toBe("");
    });

    it("should fetch SOPs when enabled and available", async () => {
      const manager = new MemoryManager(mockConfig);
      await manager.initialize();

      const context = await manager.getContextForThread("Test", ["repo-a"]);

      expect(context.sops).toHaveLength(1);
      expect(context.sops[0].title).toBe("Debug payment failures");
    });
  });

  describe("saveThread", () => {
    it("should return empty result when disabled", async () => {
      const manager = new MemoryManager({ enabled: false });
      const result = await manager.saveThread(mockThread, mockMessages);

      expect(result.session).toBeUndefined();
      expect(result.learned).toBeUndefined();
    });

    it("should save thread and trigger learning when resolved", async () => {
      const manager = new MemoryManager(mockConfig);
      await manager.initialize();

      const result = await manager.saveThread(mockThread, mockMessages);

      expect(result.session).toBeDefined();
      expect(result.session?.id).toBe("session-123");
      expect(result.learned).toBe(1);
    });
  });

  describe("isAvailable", () => {
    it("should return false when disabled", () => {
      const manager = new MemoryManager({ enabled: false });
      expect(manager.isAvailable()).toBe(false);
    });

    it("should return true when acontext is available", async () => {
      const manager = new MemoryManager(mockConfig);
      await manager.initialize();
      expect(manager.isAvailable()).toBe(true);
    });
  });

  describe("getStatus", () => {
    it("should return current status", async () => {
      const manager = new MemoryManager(mockConfig);
      await manager.initialize();

      const status = manager.getStatus();

      expect(status.enabled).toBe(true);
      expect(status.acontext.available).toBe(true);
      expect(status.cognee.available).toBe(false);
    });
  });
});

describe("createMemoryManager", () => {
  it("should create manager from registry config", () => {
    const registry = {
      repos: {},
      council: { parallelism: 3, max_turns: 14, stop_when: [] },
      human: {},
      memory: {
        enabled: true,
        acontext: {
          base_url: "http://localhost:8029/api/v1",
          api_key: "key",
          space_name: "space",
        },
      },
    };

    const manager = createMemoryManager(registry);
    expect(manager.getStatus().enabled).toBe(true);
  });
});
