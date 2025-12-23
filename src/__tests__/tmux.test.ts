import { describe, it, expect, vi, beforeEach } from "vitest";
import * as childProcess from "node:child_process";

// Mock child_process
vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
  spawn: vi.fn(),
}));

// Mock fs/promises
vi.mock("node:fs/promises", () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

// Mock dependencies
vi.mock("../lib/registry.js", () => ({
  loadRegistry: vi.fn().mockResolvedValue({
    repos: {
      "repo-a": { path: "../repo-a", role: "backend" },
      "repo-b": { path: "../repo-b", role: "frontend" },
    },
    memory: { enabled: false },
  }),
}));

vi.mock("../lib/thread.js", () => ({
  loadThreadState: vi.fn().mockResolvedValue({
    id: "th_test",
    title: "Test Thread",
    repos: ["repo-a", "repo-b"],
    pending_for: ["repo-a", "repo-b"],
    status: "active",
    turn: 1,
  }),
  getThreadPaths: vi.fn().mockReturnValue({
    root: "/test/.council/threads/th_test",
    inbox: "/test/.council/threads/th_test/inbox",
    outbox: "/test/.council/threads/th_test/outbox",
    prompts: "/test/.council/threads/th_test/prompts",
  }),
}));

vi.mock("../lib/prompts.js", () => ({
  generatePromptForRepo: vi.fn().mockResolvedValue({
    repo: "repo-a",
    prompt: "Test prompt",
    pendingMessages: [],
    timestamp: new Date().toISOString(),
  }),
}));

describe("tmux utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("isTmuxAvailable", () => {
    it("should return true when tmux is installed", async () => {
      vi.mocked(childProcess.execSync).mockReturnValue(Buffer.from("tmux 3.3a"));

      const { isTmuxAvailable } = await import("../lib/tmux.js");
      expect(isTmuxAvailable()).toBe(true);
    });

    it("should return false when tmux is not installed", async () => {
      vi.mocked(childProcess.execSync).mockImplementation(() => {
        throw new Error("command not found");
      });

      // Clear module cache to re-import
      vi.resetModules();
      const { isTmuxAvailable } = await import("../lib/tmux.js");
      expect(isTmuxAvailable()).toBe(false);
    });
  });

  describe("sessionExists", () => {
    it("should return true when session exists", async () => {
      vi.mocked(childProcess.execSync).mockReturnValue(Buffer.from(""));

      const { sessionExists } = await import("../lib/tmux.js");
      expect(sessionExists("council-test")).toBe(true);
    });

    it("should return false when session does not exist", async () => {
      vi.mocked(childProcess.execSync).mockImplementation(() => {
        throw new Error("session not found");
      });

      vi.resetModules();
      const { sessionExists } = await import("../lib/tmux.js");
      expect(sessionExists("nonexistent")).toBe(false);
    });
  });

  describe("killSession", () => {
    it("should return true when session is killed", async () => {
      vi.mocked(childProcess.execSync).mockReturnValue(Buffer.from(""));

      const { killSession } = await import("../lib/tmux.js");
      expect(killSession("council-test")).toBe(true);
    });

    it("should return false when kill fails", async () => {
      vi.mocked(childProcess.execSync).mockImplementation(() => {
        throw new Error("session not found");
      });

      vi.resetModules();
      const { killSession } = await import("../lib/tmux.js");
      expect(killSession("nonexistent")).toBe(false);
    });
  });

  describe("listCouncilSessions", () => {
    it("should return list of council sessions", async () => {
      // Need to return a string because encoding: 'utf-8' is passed
      vi.mocked(childProcess.execSync).mockReturnValue(
        "council-th_001\ncouncil-th_002\nother-session" as unknown as Buffer
      );

      vi.resetModules();
      const { listCouncilSessions } = await import("../lib/tmux.js");
      const sessions = listCouncilSessions();

      expect(sessions).toContain("council-th_001");
      expect(sessions).toContain("council-th_002");
      expect(sessions).not.toContain("other-session");
    });

    it("should return empty array when no sessions", async () => {
      vi.mocked(childProcess.execSync).mockImplementation(() => {
        throw new Error("no sessions");
      });

      vi.resetModules();
      const { listCouncilSessions } = await import("../lib/tmux.js");
      expect(listCouncilSessions()).toEqual([]);
    });
  });
});

describe("createTmuxSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(childProcess.execSync).mockReturnValue(Buffer.from(""));
  });

  it("should create session with correct name", async () => {
    const { createTmuxSession, isTmuxAvailable } = await import("../lib/tmux.js");

    // Skip if isTmuxAvailable returns false
    vi.mocked(childProcess.execSync).mockReturnValue(Buffer.from("tmux 3.3a"));

    const session = await createTmuxSession({
      threadId: "th_test",
      basePath: "/test",
    });

    expect(session.sessionName).toBe("council-th_test");
    expect(session.threadId).toBe("th_test");
    expect(session.panes.length).toBe(2);
  });

  it("should create panes for each repo", async () => {
    vi.mocked(childProcess.execSync).mockReturnValue(Buffer.from("tmux 3.3a"));

    const { createTmuxSession } = await import("../lib/tmux.js");

    const session = await createTmuxSession({
      threadId: "th_test",
      basePath: "/test",
    });

    expect(session.panes[0].repo).toBe("repo-a");
    expect(session.panes[1].repo).toBe("repo-b");
  });

  it("should use custom session name", async () => {
    vi.mocked(childProcess.execSync).mockReturnValue(Buffer.from("tmux 3.3a"));

    const { createTmuxSession } = await import("../lib/tmux.js");

    const session = await createTmuxSession({
      threadId: "th_test",
      basePath: "/test",
      sessionName: "my-custom-session",
    });

    expect(session.sessionName).toBe("my-custom-session");
  });
});
