import chalk from "chalk";
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { workspaceExists } from "../lib/workspace.js";
import { loadThreadState, getThreadPaths, saveThreadState } from "../lib/thread.js";
import * as yaml from "yaml";

export interface ResolveOptions {
  thread: string;
  type: "decision" | "root_cause" | "fix" | "action_item" | "rejection";
  summary: string;
  rationale?: string;
  alternatives?: string;
  evidence?: string;
  decidedBy?: string;
  owner?: string;
  priority?: "low" | "medium" | "high";
  verified?: boolean;
  commit?: string;
}

export interface ResolutionsListOptions {
  thread?: string;
  all?: boolean;
  type?: string;
  owner?: string;
  status?: string;
  format?: "text" | "json" | "markdown";
}

interface Resolution {
  id: string;
  thread_id: string;
  type: string;
  summary: string;
  rationale?: string;
  alternatives_considered?: string[];
  decided_by?: string;
  approved_by?: string[];
  evidence?: string[];
  owner?: string;
  priority?: string;
  verified?: boolean;
  commit?: string;
  status?: string;
  created_at: string;
  confidence?: string;
}

function generateResolutionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 6);
  return `res_${timestamp}_${random}`;
}

async function loadResolutions(cwd: string, threadId: string): Promise<Resolution[]> {
  const paths = getThreadPaths(cwd, threadId);
  const resolutionsFile = join(paths.root, "resolutions.yaml");

  try {
    const content = await readFile(resolutionsFile, "utf-8");
    const data = yaml.parse(content);
    return data.resolutions || [];
  } catch {
    return [];
  }
}

async function saveResolutions(cwd: string, threadId: string, resolutions: Resolution[]): Promise<void> {
  const paths = getThreadPaths(cwd, threadId);
  const resolutionsFile = join(paths.root, "resolutions.yaml");

  const content = yaml.stringify({ resolutions }, { indent: 2 });
  await writeFile(resolutionsFile, content, "utf-8");
}

export async function resolveCommand(options: ResolveOptions): Promise<void> {
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

  // Create resolution
  const resolution: Resolution = {
    id: generateResolutionId(),
    thread_id: options.thread,
    type: options.type,
    summary: options.summary,
    created_at: new Date().toISOString(),
  };

  if (options.rationale) {
    resolution.rationale = options.rationale;
  }

  if (options.alternatives) {
    resolution.alternatives_considered = options.alternatives.split(",").map((a) => a.trim());
  }

  if (options.evidence) {
    resolution.evidence = options.evidence.split(",").map((e) => e.trim());
  }

  if (options.decidedBy) {
    resolution.decided_by = options.decidedBy;
  }

  if (options.owner) {
    resolution.owner = options.owner;
  }

  if (options.priority) {
    resolution.priority = options.priority;
  }

  if (options.verified !== undefined) {
    resolution.verified = options.verified;
  }

  if (options.commit) {
    resolution.commit = options.commit;
  }

  // Set status for action items
  if (options.type === "action_item") {
    resolution.status = "pending";
  }

  // Load existing resolutions and add new one
  const resolutions = await loadResolutions(cwd, options.thread);
  resolutions.push(resolution);
  await saveResolutions(cwd, options.thread, resolutions);

  // Update thread state if this is a resolution type
  if (options.type === "root_cause" || options.type === "fix") {
    const currentState = await loadThreadState(cwd, options.thread);
    currentState.resolution_summary = options.summary;
    currentState.updated_at = new Date().toISOString();
    await saveThreadState(cwd, options.thread, currentState);
  }

  console.log(chalk.green(`\n✅ Resolution logged: ${resolution.id}\n`));

  console.log(chalk.white("Details:"));
  console.log(chalk.gray(`  Type: ${options.type}`));
  console.log(chalk.gray(`  Summary: ${options.summary}`));
  if (options.rationale) {
    console.log(chalk.gray(`  Rationale: ${options.rationale}`));
  }
  if (options.decidedBy) {
    console.log(chalk.gray(`  Decided by: ${options.decidedBy}`));
  }
  if (options.owner) {
    console.log(chalk.gray(`  Owner: ${options.owner}`));
  }
  console.log();
}

export async function resolutionsListCommand(options: ResolutionsListOptions): Promise<void> {
  const cwd = process.cwd();

  // Check workspace exists
  if (!(await workspaceExists(cwd))) {
    console.error(chalk.red("No council workspace found. Run 'council init' first."));
    process.exit(1);
  }

  let allResolutions: Resolution[] = [];

  if (options.thread) {
    // Load resolutions for specific thread
    try {
      await loadThreadState(cwd, options.thread);
      allResolutions = await loadResolutions(cwd, options.thread);
    } catch {
      console.error(chalk.red(`Thread ${options.thread} not found.`));
      process.exit(1);
    }
  } else if (options.all) {
    // Load resolutions from all threads
    const threadsDir = join(cwd, ".council", "threads");
    try {
      const threadDirs = await readdir(threadsDir);
      for (const threadId of threadDirs) {
        if (threadId.startsWith("th_")) {
          const resolutions = await loadResolutions(cwd, threadId);
          allResolutions.push(...resolutions);
        }
      }
    } catch {
      console.error(chalk.red("No threads found."));
      process.exit(1);
    }
  } else {
    console.error(chalk.red("Specify --thread <id> or --all"));
    process.exit(1);
  }

  // Apply filters
  if (options.type) {
    allResolutions = allResolutions.filter((r) => r.type === options.type);
  }

  if (options.owner) {
    allResolutions = allResolutions.filter((r) => r.owner === options.owner);
  }

  if (options.status) {
    allResolutions = allResolutions.filter((r) => r.status === options.status);
  }

  // Sort by creation date
  allResolutions.sort((a, b) => a.created_at.localeCompare(b.created_at));

  if (allResolutions.length === 0) {
    console.log(chalk.yellow("\nNo resolutions found.\n"));
    return;
  }

  // Output format
  if (options.format === "json") {
    console.log(JSON.stringify(allResolutions, null, 2));
    return;
  }

  if (options.format === "markdown") {
    console.log(formatAsMarkdown(allResolutions));
    return;
  }

  // Default text format
  console.log(chalk.bold("\n📋 Resolutions\n"));

  const typeIcons: Record<string, string> = {
    decision: "⚖️ ",
    root_cause: "🎯",
    fix: "🔧",
    action_item: "📝",
    rejection: "❌",
  };

  for (const res of allResolutions) {
    const icon = typeIcons[res.type] || "📌";
    console.log(chalk.cyan(`${icon} ${res.id}`));
    console.log(chalk.white(`   ${res.summary}`));
    console.log(chalk.gray(`   Type: ${res.type} | Thread: ${res.thread_id}`));
    if (res.rationale) {
      console.log(chalk.gray(`   Rationale: ${res.rationale}`));
    }
    if (res.owner) {
      console.log(chalk.gray(`   Owner: ${res.owner}`));
    }
    if (res.status) {
      const statusColor = res.status === "completed" ? chalk.green : chalk.yellow;
      console.log(statusColor(`   Status: ${res.status}`));
    }
    console.log();
  }

  console.log(chalk.gray(`Total: ${allResolutions.length} resolutions\n`));
}

function formatAsMarkdown(resolutions: Resolution[]): string {
  let output = "# Resolution Log\n\n";

  output += `| ID | Type | Summary | Thread | Status |\n`;
  output += `|----|------|---------|--------|--------|\n`;

  for (const res of resolutions) {
    const status = res.status || (res.verified ? "verified" : "-");
    output += `| ${res.id} | ${res.type} | ${res.summary.slice(0, 50)}${res.summary.length > 50 ? "..." : ""} | ${res.thread_id} | ${status} |\n`;
  }

  output += "\n---\n\n## Details\n\n";

  for (const res of resolutions) {
    output += `### ${res.id}\n\n`;
    output += `**Type**: ${res.type}\n`;
    output += `**Summary**: ${res.summary}\n`;
    if (res.rationale) {
      output += `**Rationale**: ${res.rationale}\n`;
    }
    if (res.alternatives_considered?.length) {
      output += `**Alternatives**: ${res.alternatives_considered.join(", ")}\n`;
    }
    if (res.decided_by) {
      output += `**Decided by**: ${res.decided_by}\n`;
    }
    if (res.owner) {
      output += `**Owner**: ${res.owner}\n`;
    }
    output += `**Created**: ${res.created_at}\n\n`;
  }

  return output;
}
