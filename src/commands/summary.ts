import chalk from "chalk";
import { workspaceExists } from "../lib/workspace.js";
import { loadThreadState, getThreadPaths } from "../lib/thread.js";
import { readInboxMessages, readOutboxMessages, type Message } from "../lib/message.js";
import { readTranscript } from "../lib/transcript.js";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface SummaryOptions {
  thread: string;
  output?: "text" | "markdown" | "json";
  save?: boolean;
}

interface ThreadSummary {
  id: string;
  title: string;
  status: string;
  duration: string;
  participants: string[];
  messageCount: number;
  turnCount: number;
  problem: string;
  timeline: { time: string; from: string; to: string; summary: string; type: string }[];
  hypotheses: { description: string; outcome: string }[];
  resolution: string | null;
  decisions: string[];
  actionItems: string[];
  lessonsLearned: string[];
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

function extractProblem(messages: Message[], title: string): string {
  // Look for the first message or use title
  const firstMsg = messages.find((m) => m.type === "question" || m.type === "hypothesis");
  if (firstMsg) {
    return firstMsg.summary;
  }
  return title;
}

function extractHypotheses(messages: Message[]): { description: string; outcome: string }[] {
  const hypotheses: { description: string; outcome: string }[] = [];
  const hypothesisMessages = messages.filter((m) => m.type === "hypothesis");

  for (const msg of hypothesisMessages) {
    // Try to find if there was a follow-up that confirmed or rejected
    const laterMessages = messages.filter(
      (m) => m.timestamp > msg.timestamp && (m.from === msg.to || m.to === msg.from)
    );

    let outcome = "pending";
    for (const later of laterMessages) {
      const lowerSummary = later.summary.toLowerCase();
      if (lowerSummary.includes("confirmed") || lowerSummary.includes("correct") || lowerSummary.includes("found")) {
        outcome = "confirmed";
        break;
      }
      if (lowerSummary.includes("rejected") || lowerSummary.includes("incorrect") || lowerSummary.includes("not the issue")) {
        outcome = "rejected";
        break;
      }
    }

    hypotheses.push({
      description: msg.summary,
      outcome,
    });
  }

  return hypotheses;
}

function extractDecisions(messages: Message[]): string[] {
  const decisions: string[] = [];
  const decisionMessages = messages.filter((m) => m.type === "decision");

  for (const msg of decisionMessages) {
    decisions.push(`${msg.summary} (by ${msg.from})`);
  }

  return decisions;
}

function extractResolution(messages: Message[], resolutionSummary?: string): string | null {
  if (resolutionSummary) {
    return resolutionSummary;
  }

  const resolutionMsg = messages.find((m) => m.type === "resolution");
  if (resolutionMsg) {
    return resolutionMsg.summary;
  }

  return null;
}

function buildTimeline(messages: Message[]): { time: string; from: string; to: string; summary: string; type: string }[] {
  return messages.map((m) => ({
    time: new Date(m.timestamp).toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    }),
    from: m.from,
    to: m.to,
    summary: m.summary.length > 80 ? m.summary.slice(0, 80) + "..." : m.summary,
    type: m.type,
  }));
}

async function generateSummary(cwd: string, threadId: string): Promise<ThreadSummary> {
  const state = await loadThreadState(cwd, threadId);
  const paths = getThreadPaths(cwd, threadId);

  // Load all messages
  const inboxMessages = await readInboxMessages(cwd, threadId);
  const outboxMessages = await readOutboxMessages(cwd, threadId);
  const allMessages = [...inboxMessages, ...outboxMessages].sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp)
  );

  // Build summary
  const summary: ThreadSummary = {
    id: state.id,
    title: state.title,
    status: state.status,
    duration: calculateDuration(state.created_at, state.updated_at),
    participants: state.repos,
    messageCount: allMessages.length,
    turnCount: state.turn,
    problem: extractProblem(allMessages, state.title),
    timeline: buildTimeline(allMessages),
    hypotheses: extractHypotheses(allMessages),
    resolution: extractResolution(allMessages, state.resolution_summary),
    decisions: extractDecisions(allMessages),
    actionItems: [], // Would need to be extracted from messages
    lessonsLearned: [], // Would need to be extracted from resolution
  };

  return summary;
}

function formatAsText(summary: ThreadSummary): string {
  let output = "";

  output += `Thread Summary: ${summary.id}\n`;
  output += `${"=".repeat(50)}\n\n`;

  output += `Title: ${summary.title}\n`;
  output += `Status: ${summary.status}\n`;
  output += `Duration: ${summary.duration}\n`;
  output += `Participants: ${summary.participants.join(", ")}\n`;
  output += `Messages: ${summary.messageCount} | Turns: ${summary.turnCount}\n\n`;

  output += `Problem\n${"-".repeat(20)}\n`;
  output += `${summary.problem}\n\n`;

  output += `Timeline\n${"-".repeat(20)}\n`;
  for (const event of summary.timeline) {
    output += `[${event.time}] ${event.from} → ${event.to}: ${event.summary}\n`;
  }
  output += "\n";

  if (summary.hypotheses.length > 0) {
    output += `Hypotheses\n${"-".repeat(20)}\n`;
    for (const h of summary.hypotheses) {
      output += `• ${h.description} → ${h.outcome}\n`;
    }
    output += "\n";
  }

  if (summary.resolution) {
    output += `Resolution\n${"-".repeat(20)}\n`;
    output += `${summary.resolution}\n\n`;
  }

  if (summary.decisions.length > 0) {
    output += `Decisions\n${"-".repeat(20)}\n`;
    for (const d of summary.decisions) {
      output += `• ${d}\n`;
    }
    output += "\n";
  }

  return output;
}

function formatAsMarkdown(summary: ThreadSummary): string {
  let output = "";

  output += `# Thread Summary: ${summary.id}\n\n`;

  output += `**Title**: ${summary.title}\n`;
  output += `**Duration**: ${summary.duration}\n`;
  output += `**Participants**: ${summary.participants.join(", ")}\n`;
  output += `**Status**: ${summary.status}\n\n`;

  output += `## Problem\n\n`;
  output += `${summary.problem}\n\n`;

  output += `## Timeline\n\n`;
  output += `| Time | From | To | Summary |\n`;
  output += `|------|------|-----|--------|\n`;
  for (const event of summary.timeline) {
    output += `| ${event.time} | ${event.from} | ${event.to} | ${event.summary} |\n`;
  }
  output += "\n";

  if (summary.hypotheses.length > 0) {
    output += `## Hypotheses Explored\n\n`;
    for (const h of summary.hypotheses) {
      const icon = h.outcome === "confirmed" ? "✓" : h.outcome === "rejected" ? "✗" : "?";
      output += `- **${h.description}** → \`${h.outcome}\` ${icon}\n`;
    }
    output += "\n";
  }

  if (summary.resolution) {
    output += `## Resolution\n\n`;
    output += `${summary.resolution}\n\n`;
  }

  if (summary.decisions.length > 0) {
    output += `## Decisions Made\n\n`;
    for (let i = 0; i < summary.decisions.length; i++) {
      output += `${i + 1}. ${summary.decisions[i]}\n`;
    }
    output += "\n";
  }

  return output;
}

export async function summaryCommand(options: SummaryOptions): Promise<void> {
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

  console.log(chalk.bold("\n📋 Generating Thread Summary...\n"));

  try {
    const summary = await generateSummary(cwd, options.thread);

    let output: string;
    if (options.output === "json") {
      output = JSON.stringify(summary, null, 2);
    } else if (options.output === "markdown") {
      output = formatAsMarkdown(summary);
    } else {
      output = formatAsText(summary);
    }

    console.log(output);

    // Save if requested
    if (options.save) {
      const paths = getThreadPaths(cwd, options.thread);
      const ext = options.output === "json" ? "json" : "md";
      const filepath = join(paths.root, `summary.${ext}`);
      await writeFile(filepath, output, "utf-8");
      console.log(chalk.green(`\n✅ Summary saved to ${filepath}`));
    }
  } catch (error) {
    console.error(chalk.red("Failed to generate summary:"), error);
    process.exit(1);
  }
}
