import chalk from "chalk";
import { workspaceExists } from "../lib/workspace.js";
import { loadThreadState, saveThreadState } from "../lib/thread.js";
import { appendRawToTranscript } from "../lib/transcript.js";

export interface CloseOptions {
  thread: string;
  status: "resolved" | "blocked" | "abandoned";
  summary?: string;
}

const VALID_STATUSES = ["resolved", "blocked", "abandoned"];

export async function closeCommand(options: CloseOptions): Promise<void> {
  const cwd = process.cwd();

  // Check workspace exists
  if (!(await workspaceExists(cwd))) {
    console.error(chalk.red("No council workspace found. Run 'council init' first."));
    process.exit(1);
  }

  // Validate status
  if (!VALID_STATUSES.includes(options.status)) {
    console.error(chalk.red(`Invalid status: ${options.status}`));
    console.error(chalk.gray(`Valid statuses: ${VALID_STATUSES.join(", ")}`));
    process.exit(1);
  }

  // Load thread state
  let state;
  try {
    state = await loadThreadState(cwd, options.thread);
  } catch {
    console.error(chalk.red(`Thread ${options.thread} not found.`));
    process.exit(1);
  }

  // Check if already closed
  if (state.status !== "active") {
    console.error(chalk.yellow(`Thread is already ${state.status}.`));
    process.exit(0);
  }

  try {
    // Update state
    state.status = options.status;
    state.pending_for = [];
    state.updated_at = new Date().toISOString();
    if (options.summary) {
      state.resolution_summary = options.summary;
    }
    await saveThreadState(cwd, options.thread, state);

    // Append closure to transcript
    const time = new Date().toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    let closureEntry = `\n---\n\n[${time}] HUMAN >>> THREAD CLOSED (${options.status})`;
    if (options.summary) {
      closureEntry += `\n  Summary: ${options.summary}`;
    }
    closureEntry += "\n";
    await appendRawToTranscript(cwd, options.thread, closureEntry);

    // Display result
    const statusColor =
      options.status === "resolved"
        ? chalk.green
        : options.status === "blocked"
          ? chalk.yellow
          : chalk.red;

    console.log(statusColor(`\nThread ${options.thread} closed: ${options.status}`));
    if (options.summary) {
      console.log(chalk.gray(`Summary: ${options.summary}`));
    }
    console.log(chalk.gray(`Turns completed: ${state.turn}`));
  } catch (error) {
    console.error(chalk.red("Failed to close thread:"), error);
    process.exit(1);
  }
}
