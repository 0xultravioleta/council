import chalk from "chalk";
import { copyFile, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import { workspaceExists } from "../lib/workspace.js";
import { loadThreadState, getThreadPaths } from "../lib/thread.js";

export interface AddEvidenceOptions {
  thread: string;
  file: string;
}

export async function addEvidenceCommand(options: AddEvidenceOptions): Promise<void> {
  const cwd = process.cwd();

  // Check workspace exists
  if (!(await workspaceExists(cwd))) {
    console.error(chalk.red("No council workspace found. Run 'council init' first."));
    process.exit(1);
  }

  // Load thread state
  try {
    await loadThreadState(cwd, options.thread);
  } catch {
    console.error(chalk.red(`Thread ${options.thread} not found.`));
    process.exit(1);
  }

  // Check source file exists
  try {
    await stat(options.file);
  } catch {
    console.error(chalk.red(`File not found: ${options.file}`));
    process.exit(1);
  }

  const paths = getThreadPaths(cwd, options.thread);
  const filename = basename(options.file);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "").slice(0, 15);
  const destFilename = `${timestamp}_${filename}`;
  const destPath = join(paths.evidence, destFilename);

  try {
    await copyFile(options.file, destPath);
    console.log(chalk.green(`Evidence added: ${destFilename}`));
    console.log(chalk.gray(`Path: ${destPath}`));
    console.log();
    console.log("Use this reference in messages:");
    console.log(chalk.cyan(`  evidence_refs: ["${destFilename}"]`));
  } catch (error) {
    console.error(chalk.red("Failed to add evidence:"), error);
    process.exit(1);
  }
}
