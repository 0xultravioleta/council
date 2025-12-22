#!/usr/bin/env node

import { Command } from "commander";
import { version } from "./version.js";

const program = new Command();

program
  .name("council")
  .description("Agentic multi-repo orchestrator with live dialogue and dual memory")
  .version(version);

// init command
program
  .command("init")
  .description("Initialize .council/ workspace in current directory")
  .action(async () => {
    const { initCommand } = await import("./commands/init.js");
    await initCommand();
  });

// thread commands
const thread = program
  .command("thread")
  .description("Manage conversation threads");

thread
  .command("new")
  .description("Create a new conversation thread")
  .requiredOption("--title <title>", "Thread title")
  .requiredOption("--repos <repos>", "Comma-separated list of repos")
  .action(async (options) => {
    const { threadNewCommand } = await import("./commands/thread.js");
    await threadNewCommand(options);
  });

thread
  .command("list")
  .description("List all threads")
  .action(async () => {
    const { threadListCommand } = await import("./commands/thread.js");
    await threadListCommand();
  });

// ask command
program
  .command("ask")
  .description("Send a message from one repo to another")
  .requiredOption("--thread <id>", "Thread ID")
  .requiredOption("--from <repo>", "Source repo")
  .requiredOption("--to <repo>", "Target repo")
  .requiredOption("--summary <text>", "Message summary")
  .action(async (options) => {
    const { askCommand } = await import("./commands/ask.js");
    await askCommand(options);
  });

// tick command
program
  .command("tick")
  .description("Advance thread by one turn")
  .requiredOption("--thread <id>", "Thread ID")
  .action(async (options) => {
    const { tickCommand } = await import("./commands/tick.js");
    await tickCommand(options);
  });

// prompts command
program
  .command("prompts")
  .description("Generate and display prompts for each repo")
  .requiredOption("--thread <id>", "Thread ID")
  .option("--repo <repo>", "Generate prompt for specific repo only")
  .option("--output <format>", "Output format: full or summary", "full")
  .action(async (options) => {
    const { promptsCommand } = await import("./commands/prompts.js");
    await promptsCommand(options);
  });

// live command
program
  .command("live")
  .description("Stream conversation updates in real-time")
  .requiredOption("--thread <id>", "Thread ID")
  .action(async (options) => {
    const { liveCommand } = await import("./commands/live.js");
    await liveCommand(options);
  });

// interrupt command
program
  .command("interrupt")
  .description("Inject human context into thread")
  .requiredOption("--thread <id>", "Thread ID")
  .requiredOption("--note <text>", "Context note to inject")
  .action(async (options) => {
    const { interruptCommand } = await import("./commands/interrupt.js");
    await interruptCommand(options);
  });

// close command
program
  .command("close")
  .description("Close a thread")
  .requiredOption("--thread <id>", "Thread ID")
  .requiredOption("--status <status>", "Final status (resolved, blocked, abandoned)")
  .option("--summary <text>", "Resolution summary")
  .action(async (options) => {
    const { closeCommand } = await import("./commands/close.js");
    await closeCommand(options);
  });

// add-evidence command
program
  .command("add-evidence")
  .description("Add evidence file to thread")
  .requiredOption("--thread <id>", "Thread ID")
  .requiredOption("--file <path>", "Path to evidence file")
  .action(async (options) => {
    const { addEvidenceCommand } = await import("./commands/evidence.js");
    await addEvidenceCommand(options);
  });

// scan command
program
  .command("scan")
  .description("Scan repos for synergy and integration opportunities")
  .requiredOption("--repos <repos>", "Comma-separated list of repos to scan")
  .action(async (options) => {
    const { scanCommand } = await import("./commands/scan.js");
    await scanCommand(options);
  });

program.parse();
