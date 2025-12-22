import chalk from "chalk";
import { workspaceExists } from "../lib/workspace.js";
import { loadThreadState } from "../lib/thread.js";
import { runTick } from "../lib/tick.js";

export interface TickOptions {
  thread: string;
}

export async function tickCommand(options: TickOptions): Promise<void> {
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

  // Check thread status
  if (state.status !== "active") {
    console.error(chalk.yellow(`Thread is ${state.status}. Cannot advance.`));
    process.exit(0);
  }

  // Run tick
  try {
    const result = await runTick(cwd, options.thread);

    console.log(chalk.bold(`\nTick ${result.turn} completed\n`));

    if (result.status === "max_turns") {
      console.log(chalk.yellow("Maximum turns reached. Thread will be blocked."));
      console.log(chalk.gray("Use 'council close' to close the thread."));
      return;
    }

    if (result.status === "resolved") {
      console.log(chalk.green("Thread has been resolved!"));
      return;
    }

    // Show processed messages
    if (result.processedMessages.length > 0) {
      console.log(chalk.gray("Processed messages:"));
      for (const msg of result.processedMessages) {
        console.log(chalk.gray(`  ${msg.from} -> ${msg.to}: ${msg.summary} (${msg.type})`));
      }
      console.log();
    }

    // Show pending repos
    if (result.newPendingRepos.length > 0) {
      console.log(chalk.cyan("Pending repos:"));
      for (const repo of result.newPendingRepos) {
        console.log(chalk.cyan(`  - ${repo}`));
      }
      console.log();

      console.log("Next steps:");
      console.log(chalk.gray(`  council prompts --thread ${options.thread}`));
      console.log(chalk.gray(`  # Run Claude Code on each pending repo`));
      console.log(chalk.gray(`  council tick --thread ${options.thread}`));
    } else {
      console.log(chalk.yellow("No repos pending. Use 'council ask' to continue."));
    }
  } catch (error) {
    console.error(chalk.red("Failed to run tick:"), error);
    process.exit(1);
  }
}
