import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ClaudeSpawner, type SpawnedSession } from "../lib/spawner.js";
import type { ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";

// Mock the dependencies
vi.mock("../lib/registry.js", () => ({
  loadRegistry: vi.fn().mockResolvedValue({
    repos: {
      "test-repo": {
        path: "/test/path",
        tech_hints: ["typescript"],
      },
    },
    council: {
      parallelism: 3,
      max_turns: 14,
      stop_when: [],
    },
    human: {},
    memory: {},
  }),
}));

vi.mock("../lib/prompts.js", () => ({
  generatePromptForRepo: vi.fn().mockResolvedValue({
    repo: "test-repo",
    repoConfig: { path: "/test/path" },
    prompt: "Test prompt content",
    inboxMessages: [],
  }),
}));

vi.mock("../lib/thread.js", () => ({
  getThreadPaths: vi.fn().mockReturnValue({
    root: "/test/.council/threads/th_test",
    inbox: "/test/.council/threads/th_test/inbox",
    outbox: "/test/.council/threads/th_test/outbox",
    evidence: "/test/.council/threads/th_test/evidence",
    artifacts: "/test/.council/threads/th_test/artifacts",
    prompts: "/test/.council/threads/th_test/prompts",
    memory: "/test/.council/threads/th_test/memory",
    transcript: "/test/.council/threads/th_test/transcript.md",
    state: "/test/.council/threads/th_test/state.json",
    resolution: "/test/.council/threads/th_test/resolution.md",
  }),
}));

vi.mock("node:fs/promises", () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

// Mock child_process.spawn
const mockChildProcess = () => {
  const emitter = new EventEmitter() as EventEmitter & Partial<ChildProcess>;
  emitter.pid = 12345;
  emitter.stdin = new EventEmitter() as any;
  emitter.stdin.write = vi.fn();
  emitter.stdin.end = vi.fn();
  emitter.stdout = new EventEmitter();
  emitter.stderr = new EventEmitter();
  emitter.kill = vi.fn().mockReturnValue(true);
  return emitter;
};

vi.mock("node:child_process", () => ({
  spawn: vi.fn().mockImplementation(() => mockChildProcess()),
}));

describe("ClaudeSpawner", () => {
  let spawner: ClaudeSpawner;

  beforeEach(() => {
    spawner = new ClaudeSpawner();
    vi.clearAllMocks();
  });

  afterEach(() => {
    spawner.killAll();
  });

  describe("spawn", () => {
    it("should spawn a session with correct options", async () => {
      const session = await spawner.spawn({
        threadId: "th_test",
        repo: "test-repo",
        basePath: "/test/.council",
      });

      expect(session).toBeDefined();
      expect(session.pid).toBe(12345);
      expect(session.repo).toBe("test-repo");
      expect(session.threadId).toBe("th_test");
      expect(session.status).toBe("running");
    });

    it("should track spawned sessions", async () => {
      await spawner.spawn({
        threadId: "th_test",
        repo: "test-repo",
        basePath: "/test/.council",
      });

      const session = spawner.getSession("th_test", "test-repo");
      expect(session).toBeDefined();
      expect(session?.repo).toBe("test-repo");
    });

    it("should throw if repo not in registry", async () => {
      await expect(
        spawner.spawn({
          threadId: "th_test",
          repo: "unknown-repo",
          basePath: "/test/.council",
        })
      ).rejects.toThrow('Repo "unknown-repo" not found in registry');
    });
  });

  describe("getActiveSessions", () => {
    it("should return only running sessions", async () => {
      const session = await spawner.spawn({
        threadId: "th_test",
        repo: "test-repo",
        basePath: "/test/.council",
      });

      const active = spawner.getActiveSessions();
      expect(active).toHaveLength(1);
      expect(active[0].repo).toBe("test-repo");
    });
  });

  describe("getThreadSessions", () => {
    it("should return sessions for a specific thread", async () => {
      await spawner.spawn({
        threadId: "th_test",
        repo: "test-repo",
        basePath: "/test/.council",
      });

      const sessions = spawner.getThreadSessions("th_test");
      expect(sessions).toHaveLength(1);
      expect(sessions[0].threadId).toBe("th_test");
    });

    it("should return empty array for unknown thread", () => {
      const sessions = spawner.getThreadSessions("unknown");
      expect(sessions).toHaveLength(0);
    });
  });

  describe("kill", () => {
    it("should kill a running session", async () => {
      const session = await spawner.spawn({
        threadId: "th_test",
        repo: "test-repo",
        basePath: "/test/.council",
      });

      const killed = spawner.kill("th_test", "test-repo");
      expect(killed).toBe(true);
      expect(session.process.kill).toHaveBeenCalledWith("SIGTERM");
    });

    it("should return false for non-existent session", () => {
      const killed = spawner.kill("unknown", "unknown");
      expect(killed).toBe(false);
    });
  });

  describe("killThread", () => {
    it("should kill all sessions in a thread", async () => {
      await spawner.spawn({
        threadId: "th_test",
        repo: "test-repo",
        basePath: "/test/.council",
      });

      const killed = spawner.killThread("th_test");
      expect(killed).toBe(1);
    });
  });

  describe("killAll", () => {
    it("should kill all sessions", async () => {
      await spawner.spawn({
        threadId: "th_test",
        repo: "test-repo",
        basePath: "/test/.council",
      });

      const killed = spawner.killAll();
      expect(killed).toBe(1);
    });
  });
});

describe("SessionState", () => {
  it("should have correct interface", () => {
    const state: SpawnedSession = {
      pid: 1234,
      repo: "test",
      threadId: "th_test",
      cwd: "/path",
      process: {} as ChildProcess,
      startedAt: new Date().toISOString(),
      status: "running",
    };

    expect(state.pid).toBe(1234);
    expect(state.status).toBe("running");
  });
});
