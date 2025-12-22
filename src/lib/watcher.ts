import { watch, type FSWatcher } from "chokidar";
import { EventEmitter } from "node:events";
import { basename, join } from "node:path";
import { readFile } from "node:fs/promises";
import { getThreadPaths } from "./thread.js";
import type { Message } from "./message.js";

export interface WatcherOptions {
  /** Thread ID */
  threadId: string;
  /** Base path for .council directory */
  basePath?: string;
  /** Debounce delay in ms (default: 300) */
  debounceMs?: number;
  /** Watch for inbox changes too */
  watchInbox?: boolean;
}

export interface OutboxEvent {
  type: "add" | "change";
  path: string;
  filename: string;
  message?: Message;
  timestamp: string;
}

export interface WatcherEvents {
  outbox: (event: OutboxEvent) => void;
  inbox: (event: OutboxEvent) => void;
  error: (error: Error) => void;
  ready: () => void;
}

export class ThreadWatcher extends EventEmitter {
  private watcher: FSWatcher | null = null;
  private options: Required<WatcherOptions>;
  private paths: ReturnType<typeof getThreadPaths>;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(options: WatcherOptions) {
    super();
    this.options = {
      basePath: options.basePath ?? process.cwd(),
      debounceMs: options.debounceMs ?? 300,
      watchInbox: options.watchInbox ?? false,
      threadId: options.threadId,
    };
    this.paths = getThreadPaths(this.options.basePath, this.options.threadId);
  }

  /**
   * Start watching the thread directories
   */
  start(): void {
    if (this.watcher) {
      return;
    }

    const watchPaths = [this.paths.outbox];
    if (this.options.watchInbox) {
      watchPaths.push(this.paths.inbox);
    }

    this.watcher = watch(watchPaths, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 200,
        pollInterval: 100,
      },
    });

    this.watcher.on("add", (path) => this.handleFileEvent("add", path));
    this.watcher.on("change", (path) => this.handleFileEvent("change", path));
    this.watcher.on("error", (error) => this.emit("error", error));
    this.watcher.on("ready", () => this.emit("ready"));
  }

  /**
   * Stop watching
   */
  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }

    // Clear any pending debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }

  /**
   * Handle file events with debouncing
   */
  private handleFileEvent(type: "add" | "change", path: string): void {
    const filename = basename(path);

    // Only handle JSON files
    if (!filename.endsWith(".json")) {
      return;
    }

    // Debounce rapid events for the same file
    const existing = this.debounceTimers.get(path);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(async () => {
      this.debounceTimers.delete(path);
      await this.processFileEvent(type, path, filename);
    }, this.options.debounceMs);

    this.debounceTimers.set(path, timer);
  }

  /**
   * Process a file event after debouncing
   */
  private async processFileEvent(
    type: "add" | "change",
    path: string,
    filename: string
  ): Promise<void> {
    let message: Message | undefined;

    try {
      const content = await readFile(path, "utf-8");
      message = JSON.parse(content) as Message;
    } catch {
      // File might be partially written or invalid JSON
    }

    const event: OutboxEvent = {
      type,
      path,
      filename,
      message,
      timestamp: new Date().toISOString(),
    };

    // Determine if this is an inbox or outbox event
    if (path.includes("/outbox/") || path.includes("\\outbox\\")) {
      this.emit("outbox", event);
    } else if (path.includes("/inbox/") || path.includes("\\inbox\\")) {
      this.emit("inbox", event);
    }
  }

  /**
   * Check if watcher is active
   */
  isActive(): boolean {
    return this.watcher !== null;
  }
}

/**
 * Create a watcher for a thread
 */
export function createWatcher(options: WatcherOptions): ThreadWatcher {
  return new ThreadWatcher(options);
}

/**
 * Watch multiple threads
 */
export class MultiThreadWatcher extends EventEmitter {
  private watchers: Map<string, ThreadWatcher> = new Map();
  private basePath: string;

  constructor(basePath: string = process.cwd()) {
    super();
    this.basePath = basePath;
  }

  /**
   * Add a thread to watch
   */
  watch(threadId: string, options?: Partial<WatcherOptions>): ThreadWatcher {
    if (this.watchers.has(threadId)) {
      return this.watchers.get(threadId)!;
    }

    const watcher = new ThreadWatcher({
      ...options,
      threadId,
      basePath: this.basePath,
    });

    // Forward events with thread context
    watcher.on("outbox", (event) => {
      this.emit("outbox", { ...event, threadId });
    });

    watcher.on("inbox", (event) => {
      this.emit("inbox", { ...event, threadId });
    });

    watcher.on("error", (error) => {
      this.emit("error", error, threadId);
    });

    watcher.start();
    this.watchers.set(threadId, watcher);

    return watcher;
  }

  /**
   * Stop watching a thread
   */
  async unwatch(threadId: string): Promise<void> {
    const watcher = this.watchers.get(threadId);
    if (watcher) {
      await watcher.stop();
      this.watchers.delete(threadId);
    }
  }

  /**
   * Stop all watchers
   */
  async stopAll(): Promise<void> {
    const promises = Array.from(this.watchers.values()).map((w) => w.stop());
    await Promise.all(promises);
    this.watchers.clear();
  }

  /**
   * Get watched thread IDs
   */
  getWatchedThreads(): string[] {
    return Array.from(this.watchers.keys());
  }
}
