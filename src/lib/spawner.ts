import { spawn, type ChildProcess } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { EventEmitter } from "node:events";
import { generatePromptForRepo, type GeneratedPrompt } from "./prompts.js";
import { getThreadPaths } from "./thread.js";
import { loadRegistry } from "./registry.js";

export interface SpawnOptions {
  /** Thread ID */
  threadId: string;
  /** Repo name */
  repo: string;
  /** Base path for .council directory */
  basePath?: string;
  /** Claude CLI executable name (default: "claude") */
  claudeCommand?: string;
  /** Run in print mode (non-interactive) */
  printMode?: boolean;
  /** Pipe prompt via stdin instead of -p flag */
  useStdin?: boolean;
  /** Additional environment variables */
  env?: Record<string, string>;
}

export interface SpawnedSession {
  /** Process ID */
  pid: number;
  /** Repo name */
  repo: string;
  /** Thread ID */
  threadId: string;
  /** Working directory */
  cwd: string;
  /** Child process handle */
  process: ChildProcess;
  /** Started at timestamp */
  startedAt: string;
  /** Status */
  status: "running" | "exited" | "error";
  /** Exit code if exited */
  exitCode?: number;
}

export interface SessionEvents {
  stdout: (data: string, session: SpawnedSession) => void;
  stderr: (data: string, session: SpawnedSession) => void;
  exit: (code: number | null, session: SpawnedSession) => void;
  error: (error: Error, session: SpawnedSession) => void;
}

export class ClaudeSpawner extends EventEmitter {
  private sessions: Map<string, SpawnedSession> = new Map();

  /**
   * Spawn a Claude Code session for a repo
   */
  async spawn(options: SpawnOptions): Promise<SpawnedSession> {
    const basePath = options.basePath ?? process.cwd();
    const claudeCmd = options.claudeCommand ?? "claude";

    // Load registry to get repo path
    const registry = await loadRegistry(basePath);
    const repoConfig = registry.repos[options.repo];

    if (!repoConfig) {
      throw new Error(`Repo "${options.repo}" not found in registry`);
    }

    // Generate the prompt
    const promptData = await generatePromptForRepo(
      basePath,
      options.threadId,
      options.repo
    );

    if (!promptData) {
      throw new Error(
        `No pending messages for repo "${options.repo}" in thread ${options.threadId}`
      );
    }

    // Resolve the working directory
    const cwd = resolve(basePath, repoConfig.path);

    // Save prompt to file for reference
    const paths = getThreadPaths(basePath, options.threadId);
    const promptFile = join(paths.prompts, `${options.repo}_prompt.md`);
    await writeFile(promptFile, promptData.prompt, "utf-8");

    // Build command arguments
    const args: string[] = [];

    if (options.printMode) {
      args.push("--print");
    }

    if (!options.useStdin) {
      // Pass prompt via -p flag
      args.push("-p", promptData.prompt);
    }

    // Build environment
    const env = {
      ...process.env,
      ...options.env,
      // Set council-specific env vars
      COUNCIL_THREAD_ID: options.threadId,
      COUNCIL_REPO: options.repo,
      COUNCIL_OUTBOX: join(paths.outbox),
    };

    // Spawn the process
    const child = spawn(claudeCmd, args, {
      cwd,
      env,
      stdio: options.useStdin ? ["pipe", "pipe", "pipe"] : ["inherit", "pipe", "pipe"],
      shell: process.platform === "win32",
    });

    if (!child.pid) {
      throw new Error(`Failed to spawn Claude Code for repo "${options.repo}"`);
    }

    const session: SpawnedSession = {
      pid: child.pid,
      repo: options.repo,
      threadId: options.threadId,
      cwd,
      process: child,
      startedAt: new Date().toISOString(),
      status: "running",
    };

    // If using stdin, pipe the prompt
    if (options.useStdin && child.stdin) {
      child.stdin.write(promptData.prompt);
      child.stdin.end();
    }

    // Set up event handlers
    if (child.stdout) {
      child.stdout.on("data", (data: Buffer) => {
        this.emit("stdout", data.toString(), session);
      });
    }

    if (child.stderr) {
      child.stderr.on("data", (data: Buffer) => {
        this.emit("stderr", data.toString(), session);
      });
    }

    child.on("exit", (code) => {
      session.status = "exited";
      session.exitCode = code ?? undefined;
      this.emit("exit", code, session);
    });

    child.on("error", (error) => {
      session.status = "error";
      this.emit("error", error, session);
    });

    // Track the session
    const sessionKey = `${options.threadId}:${options.repo}`;
    this.sessions.set(sessionKey, session);

    return session;
  }

  /**
   * Get a session by thread and repo
   */
  getSession(threadId: string, repo: string): SpawnedSession | undefined {
    return this.sessions.get(`${threadId}:${repo}`);
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): SpawnedSession[] {
    return Array.from(this.sessions.values()).filter(
      (s) => s.status === "running"
    );
  }

  /**
   * Get all sessions for a thread
   */
  getThreadSessions(threadId: string): SpawnedSession[] {
    return Array.from(this.sessions.values()).filter(
      (s) => s.threadId === threadId
    );
  }

  /**
   * Kill a session
   */
  kill(threadId: string, repo: string, signal: NodeJS.Signals = "SIGTERM"): boolean {
    const session = this.getSession(threadId, repo);
    if (!session || session.status !== "running") {
      return false;
    }

    session.process.kill(signal);
    return true;
  }

  /**
   * Kill all sessions for a thread
   */
  killThread(threadId: string, signal: NodeJS.Signals = "SIGTERM"): number {
    const sessions = this.getThreadSessions(threadId);
    let killed = 0;

    for (const session of sessions) {
      if (session.status === "running") {
        session.process.kill(signal);
        killed++;
      }
    }

    return killed;
  }

  /**
   * Kill all sessions
   */
  killAll(signal: NodeJS.Signals = "SIGTERM"): number {
    const sessions = this.getActiveSessions();
    let killed = 0;

    for (const session of sessions) {
      session.process.kill(signal);
      killed++;
    }

    return killed;
  }

  /**
   * Wait for a session to exit
   */
  async waitForSession(
    threadId: string,
    repo: string,
    timeout?: number
  ): Promise<number | null> {
    const session = this.getSession(threadId, repo);
    if (!session) {
      throw new Error(`No session found for ${threadId}:${repo}`);
    }

    if (session.status !== "running") {
      return session.exitCode ?? null;
    }

    return new Promise((resolve, reject) => {
      const timeoutId = timeout
        ? setTimeout(() => {
            session.process.kill("SIGTERM");
            reject(new Error(`Session timeout after ${timeout}ms`));
          }, timeout)
        : null;

      session.process.on("exit", (code) => {
        if (timeoutId) clearTimeout(timeoutId);
        resolve(code);
      });

      session.process.on("error", (error) => {
        if (timeoutId) clearTimeout(timeoutId);
        reject(error);
      });
    });
  }
}

// Singleton instance for convenience
export const spawner = new ClaudeSpawner();

/**
 * Spawn Claude Code sessions for all pending repos in a thread
 */
export async function spawnAllPending(
  basePath: string,
  threadId: string,
  options?: Partial<SpawnOptions>
): Promise<SpawnedSession[]> {
  const { loadThreadState } = await import("./thread.js");
  const state = await loadThreadState(basePath, threadId);
  const sessions: SpawnedSession[] = [];

  for (const repo of state.pending_for) {
    const session = await spawner.spawn({
      ...options,
      basePath,
      threadId,
      repo,
    });
    sessions.push(session);
  }

  return sessions;
}

/**
 * Get session info for state.json
 */
export function getSessionsState(threadId: string): SessionState[] {
  return spawner.getThreadSessions(threadId).map((s) => ({
    repo: s.repo,
    pid: s.pid,
    cwd: s.cwd,
    startedAt: s.startedAt,
    status: s.status,
    exitCode: s.exitCode,
  }));
}

export interface SessionState {
  repo: string;
  pid: number;
  cwd: string;
  startedAt: string;
  status: "running" | "exited" | "error";
  exitCode?: number;
}
