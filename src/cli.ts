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
  .option("--memory", "Include SOPs and facts from memory")
  .option("--copy", "Copy prompt to clipboard (with confirmation)")
  .option("--interactive", "Interactive mode to select and copy prompts")
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

// spawn command
program
  .command("spawn")
  .description("Spawn Claude Code sessions for pending repos")
  .requiredOption("--thread <id>", "Thread ID")
  .option("--repo <repo>", "Spawn for specific repo only")
  .option("--print", "Run in print mode (non-interactive)")
  .option("--all", "Spawn for all pending repos")
  .option("--tmux", "Use tmux multi-pane layout")
  .option("--layout <type>", "Tmux layout: horizontal, vertical, tiled", "tiled")
  .option("--attach", "Attach to tmux session after creation")
  .action(async (options) => {
    const { spawnCommand } = await import("./commands/spawn.js");
    await spawnCommand(options);
  });

// sessions command
const sessions = program
  .command("sessions")
  .description("Manage Claude Code and tmux sessions");

sessions
  .command("list")
  .description("List active sessions")
  .action(async () => {
    const { listSessions } = await import("./commands/spawn.js");
    listSessions();
  });

sessions
  .command("kill")
  .description("Kill a tmux session")
  .requiredOption("--name <name>", "Session name (e.g., council-th_xxx)")
  .action(async (options) => {
    const { killTmuxSession } = await import("./commands/spawn.js");
    killTmuxSession(options.name);
  });

sessions
  .command("attach")
  .description("Attach to a tmux session")
  .requiredOption("--name <name>", "Session name")
  .action(async (options) => {
    const { attachToSession } = await import("./commands/spawn.js");
    attachToSession(options.name);
  });

// run command (auto-tick loop)
program
  .command("run")
  .description("Run auto-tick loop until thread resolves")
  .requiredOption("--thread <id>", "Thread ID")
  .option("--spawn", "Also spawn Claude Code sessions")
  .option("--timeout <ms>", "Max runtime in milliseconds")
  .action(async (options) => {
    const { runCommand } = await import("./commands/run.js");
    await runCommand(options);
  });

// mcp command
const mcp = program
  .command("mcp")
  .description("MCP server for automation");

mcp
  .command("serve")
  .description("Start the MCP server")
  .option("--port <port>", "Port to listen on", "3456")
  .action(async (options) => {
    const { mcpServerCommand } = await import("./commands/mcp.js");
    await mcpServerCommand({ port: parseInt(options.port, 10) });
  });

mcp
  .command("tools")
  .description("List available MCP tools")
  .action(async () => {
    const { listMcpToolsCommand } = await import("./commands/mcp.js");
    listMcpToolsCommand();
  });

program.parse();
