import chalk from "chalk";
import { watch } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { workspaceExists } from "../lib/workspace.js";
import { loadThreadState, getThreadPaths, type ThreadState } from "../lib/thread.js";

export interface LiveOptions {
  thread: string;
}

export async function liveCommand(options: LiveOptions): Promise<void> {
  const cwd = process.cwd();

  // Check workspace exists
  if (!(await workspaceExists(cwd))) {
    console.error(chalk.red("No council workspace found. Run 'council init' first."));
    process.exit(1);
  }

  // Load thread state
  let state: ThreadState;
  try {
    state = await loadThreadState(cwd, options.thread);
  } catch {
    console.error(chalk.red(`Thread ${options.thread} not found.`));
    process.exit(1);
  }

  const paths = getThreadPaths(cwd, options.thread);

  console.log(chalk.bold(`\nLive view: ${state.title}`));
  console.log(chalk.gray(`Thread: ${options.thread}`));
  console.log(chalk.gray(`Status: ${state.status} | Turn: ${state.turn}`));
  console.log(chalk.gray("Watching for changes... (Ctrl+C to exit)\n"));

  // Display current transcript
  try {
    const transcript = await readFile(paths.transcript, "utf-8");
    console.log(transcript);
  } catch {
    console.log(chalk.gray("(No transcript yet)"));
  }

  let lastContent = "";
  let lastSize = 0;

  try {
    const stats = await stat(paths.transcript);
    lastSize = stats.size;
    lastContent = await readFile(paths.transcript, "utf-8");
  } catch {
    // File might not exist yet
  }

  // Watch transcript for changes
  const watcher = watch(paths.root, { recursive: true }, async (eventType, filename) => {
    if (filename === "transcript.md" || filename?.endsWith("transcript.md")) {
      try {
        const stats = await stat(paths.transcript);
        if (stats.size > lastSize) {
          const content = await readFile(paths.transcript, "utf-8");
          // Only print the new content
          const newContent = content.slice(lastContent.length);
          if (newContent.trim()) {
            process.stdout.write(chalk.cyan(newContent));
          }
          lastContent = content;
          lastSize = stats.size;
        }
      } catch {
        // File might be in flux
      }
    }

    if (filename === "state.json" || filename?.endsWith("state.json")) {
      try {
        const newState = await loadThreadState(cwd, options.thread);
        if (newState.status !== state.status) {
          console.log(chalk.yellow(`\n[STATUS] ${state.status} -> ${newState.status}`));
          state = newState;

          if (newState.status !== "active") {
            console.log(chalk.green("\nThread is no longer active. Exiting live view."));
            watcher.close();
            process.exit(0);
          }
        }
        if (newState.turn !== state.turn) {
          console.log(chalk.blue(`\n[TURN] ${state.turn} -> ${newState.turn}`));
          state = newState;
        }
      } catch {
        // State might be in flux
      }
    }
  });

  // Handle graceful shutdown
  process.on("SIGINT", () => {
    console.log(chalk.gray("\n\nExiting live view."));
    watcher.close();
    process.exit(0);
  });

  // Keep process alive
  await new Promise(() => {});
}
