/**
 * Tmux Integration
 *
 * Spawns multi-pane tmux sessions for council threads.
 * Each repo gets its own pane in the correct working directory.
 */

import { execSync, spawn } from "node:child_process";
import { resolve } from "node:path";
import { loadRegistry } from "./registry.js";
import { loadThreadState, getThreadPaths } from "./thread.js";
import { generatePromptForRepo } from "./prompts.js";
import { writeFile } from "node:fs/promises";

export interface TmuxOptions {
  /** Thread ID */
  threadId: string;
  /** Base path for .council directory */
  basePath?: string;
  /** Tmux session name (default: "council-<threadId>") */
  sessionName?: string;
  /** Layout: horizontal, vertical, or tiled (default: tiled) */
  layout?: "horizontal" | "vertical" | "tiled";
  /** Start Claude Code in each pane */
  startClaude?: boolean;
  /** Use print mode for Claude */
  claudePrintMode?: boolean;
  /** Attach to session after creation */
  attach?: boolean;
}

export interface TmuxSession {
  /** Tmux session name */
  sessionName: string;
  /** Thread ID */
  threadId: string;
  /** Panes created */
  panes: TmuxPane[];
  /** Created at timestamp */
  createdAt: string;
}

export interface TmuxPane {
  /** Pane index */
  index: number;
  /** Repo name */
  repo: string;
  /** Working directory */
  cwd: string;
  /** Initial command run */
  command?: string;
}

/**
 * Check if tmux is available
 */
export function isTmuxAvailable(): boolean {
  try {
    execSync("tmux -V", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a tmux session exists
 */
export function sessionExists(sessionName: string): boolean {
  try {
    execSync(`tmux has-session -t "${sessionName}"`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Kill a tmux session
 */
export function killSession(sessionName: string): boolean {
  try {
    execSync(`tmux kill-session -t "${sessionName}"`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Create a tmux session with panes for each repo
 */
export async function createTmuxSession(
  options: TmuxOptions
): Promise<TmuxSession> {
  const basePath = options.basePath ?? process.cwd();
  const sessionName = options.sessionName ?? `council-${options.threadId}`;
  const layout = options.layout ?? "tiled";

  // Check tmux availability
  if (!isTmuxAvailable()) {
    throw new Error("tmux is not installed or not in PATH");
  }

  // Kill existing session if it exists
  if (sessionExists(sessionName)) {
    killSession(sessionName);
  }

  // Load thread state and registry
  const state = await loadThreadState(basePath, options.threadId);
  const registry = await loadRegistry(basePath);
  const paths = getThreadPaths(basePath, options.threadId);

  // Get repos from thread (pending or all)
  const repos = state.pending_for.length > 0 ? state.pending_for : state.repos;

  if (repos.length === 0) {
    throw new Error("No repos to spawn panes for");
  }

  const panes: TmuxPane[] = [];

  // Create the session with the first repo
  const firstRepo = repos[0];
  const firstConfig = registry.repos[firstRepo];
  if (!firstConfig) {
    throw new Error(`Repo "${firstRepo}" not found in registry`);
  }
  const firstCwd = resolve(basePath, firstConfig.path);

  // Create session (detached)
  execSync(
    `tmux new-session -d -s "${sessionName}" -c "${firstCwd}" -n "${firstRepo}"`,
    { stdio: "ignore" }
  );

  panes.push({
    index: 0,
    repo: firstRepo,
    cwd: firstCwd,
  });

  // Create additional panes for remaining repos
  for (let i = 1; i < repos.length; i++) {
    const repo = repos[i];
    const repoConfig = registry.repos[repo];
    if (!repoConfig) {
      throw new Error(`Repo "${repo}" not found in registry`);
    }
    const cwd = resolve(basePath, repoConfig.path);

    // Split window horizontally or vertically based on layout preference
    const splitFlag = layout === "horizontal" ? "-h" : "-v";
    execSync(
      `tmux split-window ${splitFlag} -t "${sessionName}" -c "${cwd}"`,
      { stdio: "ignore" }
    );

    panes.push({
      index: i,
      repo,
      cwd,
    });
  }

  // Apply layout
  const tmuxLayout =
    layout === "horizontal"
      ? "even-horizontal"
      : layout === "vertical"
        ? "even-vertical"
        : "tiled";

  execSync(`tmux select-layout -t "${sessionName}" ${tmuxLayout}`, {
    stdio: "ignore",
  });

  // If startClaude, send Claude commands to each pane
  if (options.startClaude) {
    for (let i = 0; i < panes.length; i++) {
      const pane = panes[i];
      const promptData = await generatePromptForRepo(
        basePath,
        options.threadId,
        pane.repo
      );

      if (promptData) {
        // Save prompt to file
        const promptFile = `${paths.prompts}/${pane.repo}_prompt.md`;
        await writeFile(promptFile, promptData.prompt, "utf-8");

        // Build claude command
        const claudeArgs = options.claudePrintMode ? "--print" : "";
        const command = `claude ${claudeArgs} -p "$(cat '${promptFile}')"`;

        // Send command to pane
        execSync(
          `tmux send-keys -t "${sessionName}:0.${i}" '${command}' Enter`,
          { stdio: "ignore" }
        );

        pane.command = command;
      }
    }
  }

  // Attach to session if requested
  if (options.attach) {
    // Use spawn to attach interactively
    spawn("tmux", ["attach-session", "-t", sessionName], {
      stdio: "inherit",
    });
  }

  return {
    sessionName,
    threadId: options.threadId,
    panes,
    createdAt: new Date().toISOString(),
  };
}

/**
 * List all council tmux sessions
 */
export function listCouncilSessions(): string[] {
  try {
    const output = execSync("tmux list-sessions -F '#{session_name}'", {
      encoding: "utf-8",
    });
    return output
      .trim()
      .split("\n")
      .filter((s) => s.startsWith("council-"));
  } catch {
    return [];
  }
}

/**
 * Attach to an existing tmux session
 */
export function attachSession(sessionName: string): void {
  if (!sessionExists(sessionName)) {
    throw new Error(`Session "${sessionName}" does not exist`);
  }

  spawn("tmux", ["attach-session", "-t", sessionName], {
    stdio: "inherit",
  });
}

/**
 * Send a command to all panes in a session
 */
export function sendToAllPanes(sessionName: string, command: string): void {
  if (!sessionExists(sessionName)) {
    throw new Error(`Session "${sessionName}" does not exist`);
  }

  try {
    const paneList = execSync(
      `tmux list-panes -t "${sessionName}" -F '#{pane_index}'`,
      { encoding: "utf-8" }
    );
    const panes = paneList.trim().split("\n");

    for (const pane of panes) {
      execSync(
        `tmux send-keys -t "${sessionName}:0.${pane}" '${command}' Enter`,
        { stdio: "ignore" }
      );
    }
  } catch (error) {
    throw new Error(`Failed to send command: ${(error as Error).message}`);
  }
}
