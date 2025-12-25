import chalk from "chalk";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { workspaceExists } from "../lib/workspace.js";
import { loadThreadState, getThreadPaths } from "../lib/thread.js";
import { readInboxMessages, readOutboxMessages, type Message } from "../lib/message.js";

export interface NarrateOptions {
  thread: string;
  verbosity?: "low" | "medium" | "high";
  format?: "terminal" | "markdown" | "json";
  save?: boolean;
}

interface NarrationEvent {
  timestamp: string;
  time: string;
  event: string;
  type: string;
  from: string;
  to: string;
  summary: string;
  significance: "low" | "medium" | "high";
  narration: string;
  icon: string;
}

// Event type to icon mapping
const eventIcons: Record<string, string> = {
  // Session events
  thread_start: "🎬",
  thread_close: "🏁",
  human_joins: "👤",
  context_load: "📋",

  // Message types
  hypothesis: "💭",
  question: "❓",
  answer: "💬",
  context_injection: "📎",
  analysis: "🔍",

  // Progress events
  breakthrough: "💡",
  root_cause: "🎯",
  patch_proposal: "🔧",
  resolution: "✅",
  blocked: "🚫",

  // Meta events
  memory_query: "🧠",
  synergy: "🔗",
  decision: "⚖️",
  action_item: "📝",
};

function getEventIcon(type: string, summary: string): string {
  // Check for special content
  const lower = summary.toLowerCase();

  if (lower.includes("found") || lower.includes("discovered") || lower.includes("breakthrough")) {
    return eventIcons.breakthrough;
  }

  if (lower.includes("root cause") || lower.includes("the issue is") || lower.includes("problem identified")) {
    return eventIcons.root_cause;
  }

  if (lower.includes("blocked") || lower.includes("stuck") || lower.includes("cannot")) {
    return eventIcons.blocked;
  }

  return eventIcons[type] || "📌";
}

function getSignificance(msg: Message): "low" | "medium" | "high" {
  const lower = msg.summary.toLowerCase();

  // High significance
  if (msg.type === "resolution" || msg.type === "decision") return "high";
  if (lower.includes("found") || lower.includes("root cause") || lower.includes("fix")) return "high";
  if (msg.from === "HUMAN") return "high";

  // Low significance
  if (msg.type === "answer" && msg.summary.length < 50) return "low";
  if (lower.includes("checking") || lower.includes("looking")) return "low";

  return "medium";
}

function generateNarration(msg: Message, verbosity: string): string {
  const isHuman = msg.from === "HUMAN";

  // Low verbosity - just the facts
  if (verbosity === "low") {
    return `${msg.from} → ${msg.to}: ${msg.type}`;
  }

  // Build narration based on message type and content
  let narration = "";
  const lower = msg.summary.toLowerCase();

  if (isHuman) {
    narration = `Human intervention: "${msg.summary}"`;
  } else if (msg.type === "hypothesis") {
    narration = `${msg.from} proposes a theory: ${msg.summary}`;
  } else if (msg.type === "question") {
    narration = `${msg.from} needs clarification from ${msg.to}: ${msg.summary}`;
  } else if (msg.type === "answer") {
    narration = `${msg.from} responds: ${msg.summary}`;
  } else if (msg.type === "resolution") {
    narration = `Resolution reached! ${msg.summary}`;
  } else if (msg.type === "patch_proposal") {
    narration = `${msg.from} suggests a fix: ${msg.summary}`;
  } else if (msg.type === "context_injection") {
    narration = `New context added: ${msg.summary}`;
  } else {
    narration = `${msg.from} to ${msg.to}: ${msg.summary}`;
  }

  // High verbosity - add commentary
  if (verbosity === "high") {
    if (lower.includes("found") || lower.includes("identified")) {
      narration += "\n\n💬 NARRATOR: This could be a key breakthrough in the investigation.";
    }

    if (lower.includes("hypothesis") || lower.includes("suspect")) {
      narration += "\n\n💬 NARRATOR: A new theory is being explored. Let's see if it holds up.";
    }

    if (lower.includes("confirmed") || lower.includes("verified")) {
      narration += "\n\n💬 NARRATOR: Good progress! The hypothesis has been validated.";
    }
  }

  return narration;
}

async function generateNarration_(cwd: string, threadId: string, verbosity: string): Promise<NarrationEvent[]> {
  const state = await loadThreadState(cwd, threadId);

  // Load all messages
  const inboxMessages = await readInboxMessages(cwd, threadId);
  const outboxMessages = await readOutboxMessages(cwd, threadId);
  const allMessages = [...inboxMessages, ...outboxMessages].sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp)
  );

  const events: NarrationEvent[] = [];

  // Add thread start event
  events.push({
    timestamp: state.created_at,
    time: new Date(state.created_at).toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    }),
    event: "thread_start",
    type: "session",
    from: "system",
    to: "all",
    summary: state.title,
    significance: "high",
    narration: `Thread started: "${state.title}"\nParticipants: ${state.repos.join(", ")}`,
    icon: eventIcons.thread_start,
  });

  // Convert messages to narration events
  for (const msg of allMessages) {
    const significance = getSignificance(msg);

    // In low verbosity, skip low significance events
    if (verbosity === "low" && significance === "low") continue;

    events.push({
      timestamp: msg.timestamp,
      time: new Date(msg.timestamp).toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
      }),
      event: "message",
      type: msg.type,
      from: msg.from,
      to: msg.to,
      summary: msg.summary,
      significance,
      narration: generateNarration(msg, verbosity),
      icon: getEventIcon(msg.type, msg.summary),
    });
  }

  // Add thread close event if resolved
  if (state.status === "resolved" || state.status === "abandoned") {
    events.push({
      timestamp: state.updated_at,
      time: new Date(state.updated_at).toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
      }),
      event: "thread_close",
      type: "session",
      from: "system",
      to: "all",
      summary: state.resolution_summary || `Thread ${state.status}`,
      significance: "high",
      narration: `Thread closed: ${state.resolution_summary || state.status}`,
      icon: eventIcons.thread_close,
    });
  }

  return events;
}

function formatAsTerminal(events: NarrationEvent[], verbosity: string): string {
  let output = "";

  for (const event of events) {
    // Format based on verbosity
    if (verbosity === "low") {
      output += `[${event.time}] ${event.from} → ${event.to}: ${event.summary.slice(0, 60)}${event.summary.length > 60 ? "..." : ""}\n`;
    } else if (verbosity === "medium") {
      output += chalk.gray(`[${event.time}]`) + ` ${event.icon} `;
      output += chalk.cyan(event.type.toUpperCase()) + "\n";
      output += `        ${event.from} → ${event.to}:\n`;
      output += chalk.white(`        "${event.summary}"\n`);
      output += "\n";
    } else {
      // High verbosity
      output += chalk.gray(`[${event.time}]`) + ` ${event.icon} `;
      output += chalk.cyan(event.type.toUpperCase()) + "\n";
      output += chalk.gray("┌" + "─".repeat(55) + "┐\n");
      output += chalk.gray("│ ") + `From: ${event.from.padEnd(20)} To: ${event.to.padEnd(20)}` + chalk.gray(" │\n");
      output += chalk.gray("├" + "─".repeat(55) + "┤\n");

      // Wrap summary
      const words = event.summary.split(" ");
      let line = "";
      for (const word of words) {
        if (line.length + word.length > 50) {
          output += chalk.gray("│ ") + line.padEnd(53) + chalk.gray(" │\n");
          line = word;
        } else {
          line = line ? `${line} ${word}` : word;
        }
      }
      if (line) {
        output += chalk.gray("│ ") + line.padEnd(53) + chalk.gray(" │\n");
      }

      output += chalk.gray("└" + "─".repeat(55) + "┘\n");

      if (event.narration.includes("NARRATOR:")) {
        output += chalk.yellow(event.narration.split("NARRATOR:")[1].trim()) + "\n";
      }
      output += "\n";
    }
  }

  return output;
}

function formatAsMarkdown(events: NarrationEvent[]): string {
  let output = "# Session Narration\n\n";

  for (const event of events) {
    output += `## [${event.time}] ${event.icon} ${event.type}\n\n`;
    output += `**${event.from}** → **${event.to}**\n\n`;
    output += `> ${event.summary}\n\n`;
    if (event.narration !== event.summary) {
      output += `*${event.narration}*\n\n`;
    }
    output += "---\n\n";
  }

  return output;
}

export async function narrateCommand(options: NarrateOptions): Promise<void> {
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

  const verbosity = options.verbosity || "medium";

  console.log(chalk.bold(`\n🎬 Narrating: ${state.title}\n`));
  console.log(chalk.gray(`Verbosity: ${verbosity}\n`));
  console.log(chalk.gray("═".repeat(60)) + "\n");

  try {
    const events = await generateNarration_(cwd, options.thread, verbosity);

    let output: string;
    if (options.format === "json") {
      output = JSON.stringify(events, null, 2);
    } else if (options.format === "markdown") {
      output = formatAsMarkdown(events);
    } else {
      output = formatAsTerminal(events, verbosity);
    }

    console.log(output);

    // Save if requested
    if (options.save) {
      const paths = getThreadPaths(cwd, options.thread);
      const ext = options.format === "json" ? "json" : "md";
      const filepath = join(paths.root, `narration.${ext}`);
      await writeFile(filepath, output.replace(/\x1b\[[0-9;]*m/g, ""), "utf-8"); // Strip ANSI codes
      console.log(chalk.green(`\n✅ Narration saved to ${filepath}`));
    }
  } catch (error) {
    console.error(chalk.red("Failed to generate narration:"), error);
    process.exit(1);
  }
}
