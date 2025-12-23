import chalk from "chalk";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { workspaceExists } from "../lib/workspace.js";
import { loadThreadState, saveThreadState, getThreadPaths } from "../lib/thread.js";
import { appendRawToTranscript } from "../lib/transcript.js";
import { loadRegistry } from "../lib/registry.js";
import { createMemoryManager } from "../lib/memory.js";
import type { Message } from "../lib/message.js";

export interface CloseOptions {
  thread: string;
  status: "resolved" | "blocked" | "abandoned";
  summary?: string;
}

// Read all messages from inbox
async function readAllMessages(inboxPath: string): Promise<Message[]> {
  const messages: Message[] = [];
  try {
    const files = await readdir(inboxPath);
    for (const file of files) {
      if (file.endsWith(".json")) {
        const content = await readFile(join(inboxPath, file), "utf-8");
        messages.push(JSON.parse(content));
      }
    }
    messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  } catch {
    // Ignore errors
  }
  return messages;
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

    // Save to memory if enabled
    try {
      const registry = await loadRegistry(cwd);
      if (registry.memory.enabled) {
        console.log(chalk.gray("\nSaving to memory..."));

        const memoryManager = createMemoryManager(registry);
        await memoryManager.initialize();

        if (memoryManager.isAvailable()) {
          const paths = getThreadPaths(cwd, options.thread);
          const messages = await readAllMessages(paths.inbox);

          const result = await memoryManager.saveThread(state, messages);

          if (result.session) {
            console.log(chalk.green(`  ✓ Session saved to Acontext`));
          }
          if (result.learned && result.learned > 0) {
            console.log(chalk.green(`  ✓ Learned ${result.learned} SOP(s)`));
          }
        } else {
          console.log(chalk.yellow("  ⚠ Memory systems unavailable"));
        }
      }
    } catch (error) {
      // Graceful degradation - don't fail the close
      console.log(chalk.yellow(`  ⚠ Memory save failed: ${(error as Error).message}`));
    }
  } catch (error) {
    console.error(chalk.red("Failed to close thread:"), error);
    process.exit(1);
  }
}
