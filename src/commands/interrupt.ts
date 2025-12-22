import chalk from "chalk";
import { workspaceExists } from "../lib/workspace.js";
import { loadThreadState, saveThreadState } from "../lib/thread.js";
import { createMessage, writeInboxMessage } from "../lib/message.js";
import { appendToTranscript } from "../lib/transcript.js";

export interface InterruptOptions {
  thread: string;
  note: string;
}

export async function interruptCommand(options: InterruptOptions): Promise<void> {
  const cwd = process.cwd();

  // Check workspace exists
  if (!(await workspaceExists(cwd))) {
    console.error(chalk.red("No council workspace found. Run 'council init' first."));
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

  // Create human context injection message
  const message = createMessage({
    threadId: options.thread,
    from: "HUMAN",
    to: "ALL",
    type: "context_injection",
    summary: options.note,
    notes: [options.note],
  });

  try {
    // Write to inbox
    await writeInboxMessage(cwd, options.thread, message);

    // Update pending repos to all thread repos
    state.pending_for = [...state.repos];
    state.last_message_from = "HUMAN";
    state.last_message_to = "ALL";
    state.updated_at = new Date().toISOString();
    await saveThreadState(cwd, options.thread, state);

    // Append to transcript
    await appendToTranscript(cwd, options.thread, message);

    console.log(chalk.green(`Context injected: ${message.message_id}`));
    console.log();
    console.log(chalk.gray(`Note: ${options.note}`));
    console.log(chalk.gray(`Pending repos: ${state.pending_for.join(", ")}`));
    console.log();
    console.log("Next steps:");
    console.log(chalk.cyan(`  council prompts --thread ${options.thread}`));
    console.log(chalk.cyan(`  council tick --thread ${options.thread}`));
  } catch (error) {
    console.error(chalk.red("Failed to inject context:"), error);
    process.exit(1);
  }
}
