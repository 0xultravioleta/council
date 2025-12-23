import chalk from "chalk";
import { workspaceExists } from "../lib/workspace.js";
import { loadThreadState } from "../lib/thread.js";
import { generatePrompts, generatePromptForRepo } from "../lib/prompts.js";
import {
  isClipboardAvailable,
  copyToClipboard,
  copyPromptWithConfirmation,
  interactivePromptSelector,
} from "../lib/clipboard.js";

export interface PromptsOptions {
  thread: string;
  repo?: string;
  output?: "full" | "summary";
  memory?: boolean;
  copy?: boolean;
  interactive?: boolean;
}

export async function promptsCommand(options: PromptsOptions): Promise<void> {
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

  // Check if there are pending repos
  if (state.pending_for.length === 0) {
    console.log(chalk.yellow("No repos pending. Use 'council ask' to send a message."));
    return;
  }

  const promptOptions = { includeMemory: options.memory };

  try {
    if (options.repo) {
      // Generate prompt for specific repo
      const prompt = await generatePromptForRepo(cwd, options.thread, options.repo, promptOptions);

      if (!prompt) {
        console.error(chalk.red(`Repo "${options.repo}" is not pending in this thread.`));
        console.error(chalk.gray(`Pending repos: ${state.pending_for.join(", ")}`));
        process.exit(1);
      }

      // Handle copy option
      if (options.copy) {
        await copyPromptWithConfirmation(prompt.prompt, options.repo);
        return;
      }

      if (options.output === "summary") {
        printSummary([prompt]);
      } else {
        if (options.memory && prompt.memoryContext?.sops.length) {
          console.log(chalk.green(`  ✓ Injected ${prompt.memoryContext.sops.length} SOP(s) from memory\n`));
        }
        console.log(prompt.prompt);
      }
    } else {
      // Generate prompts for all pending repos
      const prompts = await generatePrompts(cwd, options.thread, promptOptions);

      // Handle interactive copy mode
      if (options.interactive) {
        await interactivePromptSelector(
          prompts.map((p) => ({ repo: p.repo, prompt: p.prompt }))
        );
        return;
      }

      // Handle copy (first prompt only, with confirmation)
      if (options.copy && prompts.length > 0) {
        console.log(chalk.yellow(`Multiple prompts available. Use --interactive for selection.`));
        await copyPromptWithConfirmation(prompts[0].prompt, prompts[0].repo);
        return;
      }

      if (options.output === "summary") {
        printSummary(prompts);
      } else {
        for (const p of prompts) {
          console.log(chalk.cyan(`\n${"=".repeat(60)}`));
          console.log(chalk.cyan(`  PROMPT FOR: ${p.repo}`));
          if (options.memory && p.memoryContext?.sops.length) {
            console.log(chalk.green(`  ✓ ${p.memoryContext.sops.length} SOP(s) from memory`));
          }
          console.log(chalk.cyan(`${"=".repeat(60)}\n`));
          console.log(p.prompt);
        }
      }
    }
  } catch (error) {
    console.error(chalk.red("Failed to generate prompts:"), error);
    process.exit(1);
  }
}

function printSummary(
  prompts: Array<{ repo: string; inboxMessages: Array<{ from: string; summary: string }> }>
): void {
  console.log(chalk.bold("\nPending Prompts:\n"));

  for (const p of prompts) {
    console.log(chalk.cyan(`  ${p.repo}`));
    console.log(chalk.gray(`    Messages: ${p.inboxMessages.length}`));

    for (const msg of p.inboxMessages) {
      console.log(chalk.gray(`      - ${msg.from}: ${msg.summary}`));
    }
    console.log();
  }
}
