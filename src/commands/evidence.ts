import chalk from "chalk";
import { copyFile, stat, readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { basename, join, extname, resolve } from "node:path";
import { workspaceExists } from "../lib/workspace.js";
import { loadThreadState, getThreadPaths } from "../lib/thread.js";
import {
  scanForSecrets,
  redactSecrets,
  isSensitiveFilename,
  isSensitiveExtension,
} from "../lib/redact.js";
import * as yaml from "yaml";

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

export interface ListEvidenceOptions {
  thread: string;
  type?: string;
  format?: "text" | "json";
}

interface EvidenceFile {
  filename: string;
  path: string;
  timestamp: string;
  originalName: string;
  extension: string;
  size: number;
}

export async function listEvidenceCommand(options: ListEvidenceOptions): Promise<void> {
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

  const paths = getThreadPaths(cwd, options.thread);
  const evidenceDir = paths.evidence;

  let files: EvidenceFile[] = [];

  try {
    const entries = await readdir(evidenceDir);

    for (const entry of entries) {
      const filePath = join(evidenceDir, entry);
      const stats = await stat(filePath);

      if (stats.isFile()) {
        // Parse timestamp from filename (format: YYYYMMDDTHHMMSS_originalname)
        const match = entry.match(/^(\d{8}T\d{6})_(.+)$/);
        const timestamp = match ? match[1] : "";
        const originalName = match ? match[2] : entry;
        const extension = extname(originalName).toLowerCase();

        files.push({
          filename: entry,
          path: filePath,
          timestamp,
          originalName,
          extension,
          size: stats.size,
        });
      }
    }
  } catch {
    // Evidence directory might not exist
  }

  // Filter by type/extension if specified
  if (options.type) {
    const types: Record<string, string[]> = {
      image: [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"],
      log: [".log", ".txt"],
      code: [".ts", ".js", ".py", ".go", ".rs", ".java", ".sh"],
      config: [".json", ".yaml", ".yml", ".toml", ".env", ".conf"],
      screenshot: [".png", ".jpg", ".jpeg"],
    };

    const extensions = types[options.type] || [`.${options.type}`];
    files = files.filter((f) => extensions.includes(f.extension));
  }

  // Sort by timestamp (newest first)
  files.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  if (files.length === 0) {
    console.log(chalk.yellow("\nNo evidence files found.\n"));
    return;
  }

  if (options.format === "json") {
    console.log(JSON.stringify(files, null, 2));
    return;
  }

  console.log(chalk.bold(`\n📎 Evidence for ${options.thread}\n`));

  const typeIcons: Record<string, string> = {
    ".png": "🖼️ ",
    ".jpg": "🖼️ ",
    ".jpeg": "🖼️ ",
    ".gif": "🖼️ ",
    ".log": "📄",
    ".txt": "📄",
    ".json": "📋",
    ".yaml": "📋",
    ".yml": "📋",
    ".ts": "📝",
    ".js": "📝",
    ".py": "📝",
  };

  for (const file of files) {
    const icon = typeIcons[file.extension] || "📁";
    const sizeStr = formatFileSize(file.size);

    console.log(chalk.cyan(`  ${icon} ${file.filename}`));
    console.log(chalk.gray(`     Original: ${file.originalName}`));
    console.log(chalk.gray(`     Size: ${sizeStr}`));
    console.log();
  }

  console.log(chalk.gray(`Total: ${files.length} files\n`));
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface BundleEvidenceOptions {
  thread: string;
  output?: string;
  includeTranscript?: boolean;
  includeMessages?: boolean;
}

interface EvidenceBundle {
  thread_id: string;
  created_at: string;
  evidence: Array<{
    filename: string;
    original_name: string;
    type: string;
    size: number;
  }>;
  transcript?: string;
  messages?: Array<{
    from: string;
    to: string;
    type: string;
    summary: string;
    timestamp: string;
  }>;
}

export async function bundleEvidenceCommand(options: BundleEvidenceOptions): Promise<void> {
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

  const paths = getThreadPaths(cwd, options.thread);

  console.log(chalk.bold("\n📦 Creating Evidence Bundle...\n"));

  const bundle: EvidenceBundle = {
    thread_id: options.thread,
    created_at: new Date().toISOString(),
    evidence: [],
  };

  // Collect evidence files
  try {
    const entries = await readdir(paths.evidence);
    for (const entry of entries) {
      const filePath = join(paths.evidence, entry);
      const stats = await stat(filePath);

      if (stats.isFile()) {
        const match = entry.match(/^(\d{8}T\d{6})_(.+)$/);
        const originalName = match ? match[2] : entry;
        const extension = extname(originalName).toLowerCase();

        bundle.evidence.push({
          filename: entry,
          original_name: originalName,
          type: extension.slice(1) || "unknown",
          size: stats.size,
        });
      }
    }
  } catch {
    // Evidence directory might not exist
  }

  // Include transcript if requested
  if (options.includeTranscript) {
    try {
      const transcriptPath = join(paths.root, "transcript.md");
      bundle.transcript = await readFile(transcriptPath, "utf-8");
    } catch {
      console.log(chalk.yellow("  ⚠ Transcript not found"));
    }
  }

  // Include messages if requested
  if (options.includeMessages) {
    const messages: EvidenceBundle["messages"] = [];

    try {
      // Read from inbox directories
      const inboxPath = paths.inbox;
      const repos = await readdir(inboxPath);

      for (const repo of repos) {
        const repoInbox = join(inboxPath, repo);
        const msgFiles = await readdir(repoInbox);

        for (const msgFile of msgFiles) {
          if (msgFile.endsWith(".json")) {
            const msgPath = join(repoInbox, msgFile);
            const content = await readFile(msgPath, "utf-8");
            const msg = JSON.parse(content);
            messages.push({
              from: msg.from,
              to: msg.to,
              type: msg.type,
              summary: msg.summary,
              timestamp: msg.timestamp,
            });
          }
        }
      }
    } catch {
      // No messages
    }

    if (messages.length > 0) {
      bundle.messages = messages.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    }
  }

  // Output bundle
  const outputPath = options.output || join(paths.root, "evidence-bundle.yaml");
  const content = yaml.stringify(bundle, { indent: 2 });

  await writeFile(outputPath, content, "utf-8");

  console.log(chalk.green(`✅ Bundle created: ${outputPath}\n`));
  console.log(chalk.white("Contents:"));
  console.log(chalk.gray(`  Evidence files: ${bundle.evidence.length}`));
  if (bundle.transcript) {
    console.log(chalk.gray(`  Transcript: included`));
  }
  if (bundle.messages) {
    console.log(chalk.gray(`  Messages: ${bundle.messages.length}`));
  }
  console.log();
}
