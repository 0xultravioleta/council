import chalk from "chalk";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { workspaceExists } from "../lib/workspace.js";
import { loadThreadState, getThreadPaths } from "../lib/thread.js";
import { readInboxMessages, readOutboxMessages, type Message } from "../lib/message.js";
import * as yaml from "yaml";

export interface PostmortemOptions {
  thread: string;
  output?: "text" | "markdown" | "json";
  save?: boolean;
  template?: "standard" | "blameless" | "brief";
}

interface Postmortem {
  thread_id: string;
  title: string;
  date: string;
  duration: string;
  participants: string[];
  status: string;

  // Summary
  summary: string;
  impact: string;

  // Timeline
  timeline: Array<{
    time: string;
    event: string;
    actor: string;
  }>;

  // Root cause analysis
  rootCause: string;
  contributingFactors: string[];

  // Resolution
  resolution: string;
  verified: boolean;

  // Lessons learned
  whatWorked: string[];
  whatDidntWork: string[];
  lessonsLearned: string[];

  // Action items
  actionItems: Array<{
    description: string;
    owner: string;
    priority: string;
    status: string;
  }>;

  // Metrics
  metrics: {
    timeToDetect?: string;
    timeToResolve?: string;
    messageCount: number;
    turnCount: number;
  };
}

function calculateDuration(createdAt: string, updatedAt: string): string {
  const start = new Date(createdAt);
  const end = new Date(updatedAt);
  const diffMs = end.getTime() - start.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;

  if (diffHours > 0) {
    return `${diffHours}h ${mins}m`;
  }
  return `${mins}m`;
}

function extractRootCause(messages: Message[]): string {
  // Look for resolution type messages or messages containing "root cause"
  const rootCauseMsg = messages.find((m) => m.type === "resolution");
  if (rootCauseMsg) {
    return rootCauseMsg.summary;
  }

  // Look for messages that seem to identify the cause
  for (const msg of messages) {
    const lower = msg.summary.toLowerCase();
    if (lower.includes("found the issue") || lower.includes("root cause") || lower.includes("the problem is") || lower.includes("caused by")) {
      return msg.summary;
    }
  }

  return "Root cause not explicitly documented";
}

function extractContributingFactors(messages: Message[]): string[] {
  const factors: string[] = [];

  for (const msg of messages) {
    const lower = msg.summary.toLowerCase();
    if (lower.includes("contributing") || lower.includes("also") || lower.includes("additionally") || lower.includes("factor")) {
      factors.push(msg.summary);
    }
  }

  return factors.slice(0, 5);
}

function buildTimeline(messages: Message[]): Array<{ time: string; event: string; actor: string }> {
  return messages.slice(0, 20).map((m) => ({
    time: new Date(m.timestamp).toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    }),
    event: m.summary.length > 100 ? m.summary.slice(0, 100) + "..." : m.summary,
    actor: m.from,
  }));
}

function extractLessons(messages: Message[]): string[] {
  const lessons: string[] = [];

  for (const msg of messages) {
    const lower = msg.summary.toLowerCase();
    if (lower.includes("should") || lower.includes("next time") || lower.includes("prevent") || lower.includes("improve")) {
      lessons.push(msg.summary);
    }
  }

  return [...new Set(lessons)].slice(0, 5);
}

async function generatePostmortem(cwd: string, threadId: string): Promise<Postmortem> {
  const state = await loadThreadState(cwd, threadId);
  const paths = getThreadPaths(cwd, threadId);

  // Load all messages
  const inboxMessages = await readInboxMessages(cwd, threadId);
  const outboxMessages = await readOutboxMessages(cwd, threadId);
  const allMessages = [...inboxMessages, ...outboxMessages].sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp)
  );

  // Try to load resolutions
  let resolutions: any[] = [];
  try {
    const resolutionsPath = join(paths.root, "resolutions.yaml");
    const content = await readFile(resolutionsPath, "utf-8");
    const data = yaml.parse(content);
    resolutions = data.resolutions || [];
  } catch {
    // No resolutions file
  }

  // Extract action items from resolutions
  const actionItems = resolutions
    .filter((r: any) => r.type === "action_item")
    .map((r: any) => ({
      description: r.summary,
      owner: r.owner || "unassigned",
      priority: r.priority || "medium",
      status: r.status || "pending",
    }));

  // Build postmortem
  const postmortem: Postmortem = {
    thread_id: state.id,
    title: state.title,
    date: new Date(state.created_at).toISOString().split("T")[0],
    duration: calculateDuration(state.created_at, state.updated_at),
    participants: state.repos,
    status: state.status,

    summary: state.title,
    impact: "Impact assessment not documented",

    timeline: buildTimeline(allMessages),

    rootCause: extractRootCause(allMessages),
    contributingFactors: extractContributingFactors(allMessages),

    resolution: state.resolution_summary || "Resolution not documented",
    verified: state.status === "resolved",

    whatWorked: [],
    whatDidntWork: [],
    lessonsLearned: extractLessons(allMessages),

    actionItems,

    metrics: {
      timeToResolve: calculateDuration(state.created_at, state.updated_at),
      messageCount: allMessages.length,
      turnCount: state.turn,
    },
  };

  return postmortem;
}

function formatAsText(pm: Postmortem, template: string): string {
  let output = "";

  output += `POSTMORTEM: ${pm.thread_id}\n`;
  output += `${"=".repeat(60)}\n\n`;

  output += `Title: ${pm.title}\n`;
  output += `Date: ${pm.date}\n`;
  output += `Duration: ${pm.duration}\n`;
  output += `Participants: ${pm.participants.join(", ")}\n`;
  output += `Status: ${pm.status}\n\n`;

  if (template !== "brief") {
    output += `SUMMARY\n${"-".repeat(40)}\n`;
    output += `${pm.summary}\n\n`;
  }

  output += `ROOT CAUSE\n${"-".repeat(40)}\n`;
  output += `${pm.rootCause}\n\n`;

  if (pm.contributingFactors.length > 0 && template !== "brief") {
    output += `CONTRIBUTING FACTORS\n${"-".repeat(40)}\n`;
    for (const factor of pm.contributingFactors) {
      output += `• ${factor}\n`;
    }
    output += "\n";
  }

  output += `RESOLUTION\n${"-".repeat(40)}\n`;
  output += `${pm.resolution}\n`;
  output += `Verified: ${pm.verified ? "Yes" : "No"}\n\n`;

  if (template !== "brief") {
    output += `TIMELINE\n${"-".repeat(40)}\n`;
    for (const event of pm.timeline) {
      output += `[${event.time}] ${event.actor}: ${event.event}\n`;
    }
    output += "\n";
  }

  if (pm.lessonsLearned.length > 0) {
    output += `LESSONS LEARNED\n${"-".repeat(40)}\n`;
    for (const lesson of pm.lessonsLearned) {
      output += `• ${lesson}\n`;
    }
    output += "\n";
  }

  if (pm.actionItems.length > 0) {
    output += `ACTION ITEMS\n${"-".repeat(40)}\n`;
    for (const item of pm.actionItems) {
      output += `• [${item.priority.toUpperCase()}] ${item.description}\n`;
      output += `  Owner: ${item.owner} | Status: ${item.status}\n`;
    }
    output += "\n";
  }

  output += `METRICS\n${"-".repeat(40)}\n`;
  output += `Time to Resolve: ${pm.metrics.timeToResolve || "N/A"}\n`;
  output += `Messages: ${pm.metrics.messageCount}\n`;
  output += `Turns: ${pm.metrics.turnCount}\n`;

  return output;
}

function formatAsMarkdown(pm: Postmortem, template: string): string {
  let output = "";

  output += `# Postmortem: ${pm.title}\n\n`;

  output += `| Attribute | Value |\n`;
  output += `|-----------|-------|\n`;
  output += `| **Thread ID** | ${pm.thread_id} |\n`;
  output += `| **Date** | ${pm.date} |\n`;
  output += `| **Duration** | ${pm.duration} |\n`;
  output += `| **Participants** | ${pm.participants.join(", ")} |\n`;
  output += `| **Status** | ${pm.status} |\n\n`;

  output += `## Summary\n\n${pm.summary}\n\n`;

  output += `## Root Cause\n\n${pm.rootCause}\n\n`;

  if (pm.contributingFactors.length > 0 && template !== "brief") {
    output += `### Contributing Factors\n\n`;
    for (const factor of pm.contributingFactors) {
      output += `- ${factor}\n`;
    }
    output += "\n";
  }

  output += `## Resolution\n\n${pm.resolution}\n\n`;
  output += `**Verified**: ${pm.verified ? "Yes ✓" : "No"}\n\n`;

  if (template !== "brief") {
    output += `## Timeline\n\n`;
    output += `| Time | Actor | Event |\n`;
    output += `|------|-------|-------|\n`;
    for (const event of pm.timeline) {
      output += `| ${event.time} | ${event.actor} | ${event.event} |\n`;
    }
    output += "\n";
  }

  if (pm.lessonsLearned.length > 0) {
    output += `## Lessons Learned\n\n`;
    for (const lesson of pm.lessonsLearned) {
      output += `- ${lesson}\n`;
    }
    output += "\n";
  }

  if (pm.actionItems.length > 0) {
    output += `## Action Items\n\n`;
    output += `| Priority | Description | Owner | Status |\n`;
    output += `|----------|-------------|-------|--------|\n`;
    for (const item of pm.actionItems) {
      output += `| ${item.priority} | ${item.description} | ${item.owner} | ${item.status} |\n`;
    }
    output += "\n";
  }

  output += `## Metrics\n\n`;
  output += `- **Time to Resolve**: ${pm.metrics.timeToResolve || "N/A"}\n`;
  output += `- **Messages Exchanged**: ${pm.metrics.messageCount}\n`;
  output += `- **Turns**: ${pm.metrics.turnCount}\n`;

  return output;
}

export async function postmortemCommand(options: PostmortemOptions): Promise<void> {
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

  console.log(chalk.bold("\n📋 Generating Postmortem...\n"));

  try {
    const postmortem = await generatePostmortem(cwd, options.thread);
    const template = options.template || "standard";

    let output: string;
    if (options.output === "json") {
      output = JSON.stringify(postmortem, null, 2);
    } else if (options.output === "markdown") {
      output = formatAsMarkdown(postmortem, template);
    } else {
      output = formatAsText(postmortem, template);
    }

    console.log(output);

    // Save if requested
    if (options.save) {
      const paths = getThreadPaths(cwd, options.thread);
      const ext = options.output === "json" ? "json" : "md";
      const filepath = join(paths.root, `postmortem.${ext}`);
      await writeFile(filepath, output, "utf-8");
      console.log(chalk.green(`\n✅ Postmortem saved to ${filepath}`));
    }
  } catch (error) {
    console.error(chalk.red("Failed to generate postmortem:"), error);
    process.exit(1);
  }
}
