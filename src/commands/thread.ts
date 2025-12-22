import chalk from "chalk";
import { workspaceExists } from "../lib/workspace.js";
import { loadRegistry, validateRepos } from "../lib/registry.js";
import { createThread, listThreads } from "../lib/thread.js";

export interface ThreadNewOptions {
  title: string;
  repos: string;
}

export async function threadNewCommand(options: ThreadNewOptions): Promise<void> {
  const cwd = process.cwd();

  // Check workspace exists
  if (!(await workspaceExists(cwd))) {
    console.error(chalk.red("No council workspace found. Run 'council init' first."));
    process.exit(1);
  }

  // Parse repos
  const repoNames = options.repos.split(",").map((r) => r.trim()).filter(Boolean);
  if (repoNames.length < 2) {
    console.error(chalk.red("At least 2 repos are required for a thread."));
    process.exit(1);
  }

  // Load and validate registry
  try {
    const registry = await loadRegistry(cwd);
    validateRepos(registry, repoNames);
  } catch (error) {
    if (error instanceof Error) {
      console.error(chalk.red(error.message));
    }
    process.exit(1);
  }

  // Create thread
  try {
    const { threadId, paths } = await createThread(cwd, {
      title: options.title,
      repos: repoNames,
    });

    console.log(chalk.green(`Created thread: ${threadId}`));
    console.log();
    console.log("Thread details:");
    console.log(chalk.gray(`  Title: ${options.title}`));
    console.log(chalk.gray(`  Repos: ${repoNames.join(", ")}`));
    console.log(chalk.gray(`  Path:  ${paths.root}`));
    console.log();
    console.log("Next steps:");
    console.log(chalk.cyan(`  council ask --thread ${threadId} --from <repo> --to <repo> --summary "..."`));
  } catch (error) {
    console.error(chalk.red("Failed to create thread:"), error);
    process.exit(1);
  }
}

export async function threadListCommand(): Promise<void> {
  const cwd = process.cwd();

  // Check workspace exists
  if (!(await workspaceExists(cwd))) {
    console.error(chalk.red("No council workspace found. Run 'council init' first."));
    process.exit(1);
  }

  try {
    const threads = await listThreads(cwd);

    if (threads.length === 0) {
      console.log(chalk.yellow("No threads found."));
      console.log(chalk.gray("Create one with: council thread new --title \"...\" --repos \"A,B\""));
      return;
    }

    console.log(chalk.bold("Threads:\n"));

    for (const thread of threads) {
      const statusColor =
        thread.status === "active"
          ? chalk.green
          : thread.status === "resolved"
          ? chalk.blue
          : thread.status === "blocked"
          ? chalk.red
          : chalk.yellow;

      console.log(`${chalk.cyan(thread.id)} ${statusColor(`[${thread.status}]`)}`);
      console.log(chalk.gray(`  ${thread.title}`));
      console.log(chalk.gray(`  Repos: ${thread.repos.join(", ")} | Turn: ${thread.turn}`));
      console.log();
    }
  } catch (error) {
    console.error(chalk.red("Failed to list threads:"), error);
    process.exit(1);
  }
}
