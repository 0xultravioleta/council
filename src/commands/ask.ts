import chalk from "chalk";
import { workspaceExists } from "../lib/workspace.js";
import { loadRegistry, validateRepos } from "../lib/registry.js";
import { loadThreadState, saveThreadState } from "../lib/thread.js";
import { createMessage, writeInboxMessage } from "../lib/message.js";
import { appendToTranscript } from "../lib/transcript.js";

export interface AskOptions {
  thread: string;
  from: string;
  to: string;
  summary: string;
}

export async function askCommand(options: AskOptions): Promise<void> {
  const cwd = process.cwd();

  // Check workspace exists
  if (!(await workspaceExists(cwd))) {
    console.error(chalk.red("No council workspace found. Run 'council init' first."));
    process.exit(1);
  }

  // Load registry and validate repos
  let registry;
  try {
    registry = await loadRegistry(cwd);
    validateRepos(registry, [options.from, options.to]);
  } catch (error) {
    if (error instanceof Error) {
      console.error(chalk.red(error.message));
    }
    process.exit(1);
  }

  // Load thread state
  let state;
  try {
    state = await loadThreadState(cwd, options.thread);
  } catch (error) {
    console.error(chalk.red(`Thread ${options.thread} not found.`));
    process.exit(1);
  }

  // Validate repos are part of thread
  if (!state.repos.includes(options.from)) {
    console.error(chalk.red(`Repo "${options.from}" is not part of this thread.`));
    console.error(chalk.gray(`Thread repos: ${state.repos.join(", ")}`));
    process.exit(1);
  }

  if (!state.repos.includes(options.to)) {
    console.error(chalk.red(`Repo "${options.to}" is not part of this thread.`));
    console.error(chalk.gray(`Thread repos: ${state.repos.join(", ")}`));
    process.exit(1);
  }

  // Create message
  const message = createMessage({
    threadId: options.thread,
    from: options.from,
    to: options.to,
    type: "question",
    summary: options.summary,
  });

  // Write to inbox
  try {
    const filepath = await writeInboxMessage(cwd, options.thread, message);

    // Update thread state
    state.pending_for = [...new Set([...state.pending_for, options.to])];
    state.last_message_from = options.from;
    state.last_message_to = options.to;
    await saveThreadState(cwd, options.thread, state);

    // Append to transcript
    await appendToTranscript(cwd, options.thread, message);

    console.log(chalk.green(`Message sent: ${message.message_id}`));
    console.log();
    console.log(chalk.gray(`From: ${options.from}`));
    console.log(chalk.gray(`To:   ${options.to}`));
    console.log(chalk.gray(`Type: question`));
    console.log(chalk.gray(`Summary: ${options.summary}`));
    console.log();
    console.log("Next steps:");
    console.log(chalk.cyan(`  council prompts --thread ${options.thread}`));
    console.log(chalk.cyan(`  council tick --thread ${options.thread}`));
  } catch (error) {
    console.error(chalk.red("Failed to send message:"), error);
    process.exit(1);
  }
}
