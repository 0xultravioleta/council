import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ThreadWatcher, MultiThreadWatcher, createWatcher } from "../lib/watcher.js";
import { EventEmitter } from "node:events";

// Mock chokidar
const mockWatcher = () => {
  const emitter = new EventEmitter();
  (emitter as any).close = vi.fn().mockResolvedValue(undefined);
  return emitter;
};

let mockWatcherInstance: EventEmitter;

vi.mock("chokidar", () => ({
  watch: vi.fn().mockImplementation(() => {
    mockWatcherInstance = mockWatcher();
    return mockWatcherInstance;
  }),
}));

// Mock thread.js
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

// Mock fs/promises
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn().mockResolvedValue(
    JSON.stringify({
      thread_id: "th_test",
      from: "repo-a",
      to: "repo-b",
      type: "answer",
      summary: "test message",
      timestamp: "2025-01-01T00:00:00Z",
    })
  ),
}));

describe("ThreadWatcher", () => {
  let watcher: ThreadWatcher;

  beforeEach(() => {
    vi.clearAllMocks();
    watcher = new ThreadWatcher({
      threadId: "th_test",
      basePath: "/test/.council",
      debounceMs: 10,
    });
  });

  afterEach(async () => {
    await watcher.stop();
  });

  describe("start", () => {
    it("should start watching", () => {
      expect(watcher.isActive()).toBe(false);
      watcher.start();
      expect(watcher.isActive()).toBe(true);
    });

    it("should not start twice", () => {
      watcher.start();
      watcher.start();
      expect(watcher.isActive()).toBe(true);
    });
  });

  describe("stop", () => {
    it("should stop watching", async () => {
      watcher.start();
      await watcher.stop();
      expect(watcher.isActive()).toBe(false);
    });
  });

  describe("events", () => {
    it("should emit ready event", async () => {
      const readyPromise = new Promise<void>((resolve) => {
        watcher.on("ready", resolve);
      });

      watcher.start();
      mockWatcherInstance.emit("ready");

      await readyPromise;
    });

    it("should emit outbox event for new JSON files", async () => {
      const eventPromise = new Promise<any>((resolve) => {
        watcher.on("outbox", resolve);
      });

      watcher.start();
      mockWatcherInstance.emit("add", "/test/.council/threads/th_test/outbox/msg.json");

      const event = await eventPromise;
      expect(event.filename).toBe("msg.json");
      expect(event.type).toBe("add");
    });

    it("should ignore non-JSON files", async () => {
      let emitted = false;
      watcher.on("outbox", () => {
        emitted = true;
      });

      watcher.start();
      mockWatcherInstance.emit("add", "/test/.council/threads/th_test/outbox/file.txt");

      // Wait a bit to ensure no event is emitted
      await new Promise((r) => setTimeout(r, 50));
      expect(emitted).toBe(false);
    });

    it("should emit error event", async () => {
      const errorPromise = new Promise<Error>((resolve) => {
        watcher.on("error", resolve);
      });

      watcher.start();
      const testError = new Error("test error");
      mockWatcherInstance.emit("error", testError);

      const error = await errorPromise;
      expect(error.message).toBe("test error");
    });
  });
});

describe("createWatcher", () => {
  it("should create a ThreadWatcher instance", () => {
    const watcher = createWatcher({
      threadId: "th_test",
    });

    expect(watcher).toBeInstanceOf(ThreadWatcher);
  });
});

describe("MultiThreadWatcher", () => {
  let multiWatcher: MultiThreadWatcher;

  beforeEach(() => {
    vi.clearAllMocks();
    multiWatcher = new MultiThreadWatcher("/test/.council");
  });

  afterEach(async () => {
    await multiWatcher.stopAll();
  });

  describe("watch", () => {
    it("should add a thread to watch", () => {
      const watcher = multiWatcher.watch("th_test");
      expect(watcher).toBeInstanceOf(ThreadWatcher);
      expect(multiWatcher.getWatchedThreads()).toContain("th_test");
    });

    it("should return existing watcher for same thread", () => {
      const watcher1 = multiWatcher.watch("th_test");
      const watcher2 = multiWatcher.watch("th_test");
      expect(watcher1).toBe(watcher2);
    });
  });

  describe("unwatch", () => {
    it("should remove a thread from watch", async () => {
      multiWatcher.watch("th_test");
      await multiWatcher.unwatch("th_test");
      expect(multiWatcher.getWatchedThreads()).not.toContain("th_test");
    });
  });

  describe("stopAll", () => {
    it("should stop all watchers", async () => {
      multiWatcher.watch("th_test1");
      multiWatcher.watch("th_test2");
      await multiWatcher.stopAll();
      expect(multiWatcher.getWatchedThreads()).toHaveLength(0);
    });
  });

  describe("events", () => {
    it("should forward outbox events with thread context", async () => {
      const eventPromise = new Promise<any>((resolve) => {
        multiWatcher.on("outbox", resolve);
      });

      multiWatcher.watch("th_test");
      mockWatcherInstance.emit("add", "/test/.council/threads/th_test/outbox/msg.json");

      const event = await eventPromise;
      expect(event.threadId).toBe("th_test");
    });
  });

  describe("getWatchedThreads", () => {
    it("should return list of watched thread IDs", () => {
      multiWatcher.watch("th_1");
      multiWatcher.watch("th_2");
      const threads = multiWatcher.getWatchedThreads();
      expect(threads).toContain("th_1");
      expect(threads).toContain("th_2");
    });
  });
});
