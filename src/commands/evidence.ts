import chalk from "chalk";
import { copyFile, stat, readFile, writeFile } from "node:fs/promises";
import { basename, join, extname } from "node:path";
import { workspaceExists } from "../lib/workspace.js";
import { loadThreadState, getThreadPaths } from "../lib/thread.js";
import {
  scanForSecrets,
  redactSecrets,
  isSensitiveFilename,
  isSensitiveExtension,
} from "../lib/redact.js";

export interface AddEvidenceOptions {
  thread: string;
  file: string;
  redact?: boolean;
  force?: boolean;
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
  const ext = extname(filename).toLowerCase();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "").slice(0, 15);
  const destFilename = `${timestamp}_${filename}`;
  const destPath = join(paths.evidence, destFilename);

  // Check for sensitive filename
  if (isSensitiveFilename(filename) || isSensitiveExtension(filename)) {
    console.log(chalk.yellow(`\n⚠️  Warning: "${filename}" appears to be a sensitive file.`));
    if (!options.force) {
      console.log(chalk.yellow("   Use --force to add anyway, or --redact to mask secrets.\n"));
      process.exit(1);
    }
  }

  // For text files, scan for secrets
  const textExtensions = [".txt", ".log", ".json", ".yaml", ".yml", ".md", ".env", ".conf", ".cfg", ".ini", ".ts", ".js", ".py", ".sh"];
  const isTextFile = textExtensions.includes(ext) || ext === "";

  if (isTextFile) {
    try {
      const content = await readFile(options.file, "utf-8");
      const secrets = scanForSecrets(content);

      if (secrets.length > 0) {
        console.log(chalk.yellow(`\n⚠️  Potential secrets detected in "${filename}":\n`));

        for (const secret of secrets) {
          console.log(chalk.yellow(`   Line ${secret.line}: ${secret.type}`));
          console.log(chalk.gray(`   ${secret.masked}`));
        }

        console.log();

        if (options.redact) {
          // Redact and save
          const result = redactSecrets(content);
          await writeFile(destPath, result.redactedContent, "utf-8");
          console.log(chalk.green(`Evidence added with ${secrets.length} secret(s) redacted: ${destFilename}`));
          console.log(chalk.gray(`Path: ${destPath}`));
        } else if (options.force) {
          // Copy as-is with warning
          await copyFile(options.file, destPath);
          console.log(chalk.yellow(`Evidence added WITH SECRETS (--force used): ${destFilename}`));
          console.log(chalk.gray(`Path: ${destPath}`));
        } else {
          console.log(chalk.yellow("   Use --redact to mask secrets, or --force to add as-is.\n"));
          process.exit(1);
        }

        console.log();
        console.log("Use this reference in messages:");
        console.log(chalk.cyan(`  evidence_refs: ["${destFilename}"]`));
        return;
      }
    } catch {
      // If we can't read as text, treat as binary
    }
  }

  // No secrets found or binary file - copy directly
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
