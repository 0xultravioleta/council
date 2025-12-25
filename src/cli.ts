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
  .option("--optimize", "Optimize prompts for efficiency")
  .option("--hint <text>", "Add a focus hint to guide investigation")
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
  .option("--redact", "Automatically redact detected secrets")
  .option("--force", "Add file even if secrets are detected (use with caution)")
  .action(async (options) => {
    const { addEvidenceCommand } = await import("./commands/evidence.js");
    await addEvidenceCommand(options);
  });

// scan command
program
  .command("scan")
  .description("Scan repos for synergy and integration opportunities")
  .requiredOption("--repos <repos>", "Comma-separated list of repos to scan")
  .option("--output <format>", "Output format: summary, full, or json", "full")
  .option("--save", "Save results to .council/scans/")
  .option("--focus <areas>", "Focus on specific areas: endpoints,boundaries,config,dependencies,exports")
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

// memory commands
const memory = program
  .command("memory")
  .description("Query and manage dual memory (Acontext + Cognee)");

memory
  .command("query")
  .description("Query memory for relevant SOPs and facts")
  .requiredOption("--query <text>", "Search query")
  .option("--source <source>", "Source: acontext, cognee, or all", "all")
  .option("--limit <n>", "Max results", "10")
  .action(async (options) => {
    const { memoryQueryCommand } = await import("./commands/memory.js");
    await memoryQueryCommand({
      query: options.query,
      source: options.source,
      limit: parseInt(options.limit, 10),
    });
  });

memory
  .command("status")
  .description("Show memory system status")
  .action(async () => {
    const { memoryStatusCommand } = await import("./commands/memory.js");
    await memoryStatusCommand({});
  });

// registry commands
const registry = program
  .command("registry")
  .description("Manage repo registry");

registry
  .command("add")
  .description("Add a repo to the registry")
  .requiredOption("--name <name>", "Repo name")
  .requiredOption("--path <path>", "Path to repo")
  .requiredOption("--description <desc>", "Repo description")
  .option("--tech <tech>", "Comma-separated list of technologies")
  .action(async (options) => {
    const { registryAddCommand } = await import("./commands/registry.js");
    await registryAddCommand(options);
  });

registry
  .command("verify")
  .description("Verify repos in registry")
  .option("--repo <name>", "Verify specific repo only")
  .action(async (options) => {
    const { registryVerifyCommand } = await import("./commands/registry.js");
    await registryVerifyCommand(options);
  });

registry
  .command("list")
  .description("List all registered repos")
  .action(async () => {
    const { registryListCommand } = await import("./commands/registry.js");
    await registryListCommand({});
  });

// resolve command
program
  .command("resolve")
  .description("Log a resolution or decision")
  .requiredOption("--thread <id>", "Thread ID")
  .requiredOption("--type <type>", "Type: decision, root_cause, fix, action_item, rejection")
  .requiredOption("--summary <text>", "Resolution summary")
  .option("--rationale <text>", "Rationale for the resolution")
  .option("--alternatives <list>", "Comma-separated alternatives considered")
  .option("--evidence <list>", "Comma-separated evidence references")
  .option("--decided-by <repo>", "Who made the decision")
  .option("--owner <repo>", "Owner for action items")
  .option("--priority <level>", "Priority: low, medium, high")
  .option("--verified", "Mark fix as verified")
  .option("--commit <hash>", "Related commit hash")
  .action(async (options) => {
    const { resolveCommand } = await import("./commands/resolution.js");
    await resolveCommand({
      thread: options.thread,
      type: options.type,
      summary: options.summary,
      rationale: options.rationale,
      alternatives: options.alternatives,
      evidence: options.evidence,
      decidedBy: options.decidedBy,
      owner: options.owner,
      priority: options.priority,
      verified: options.verified,
      commit: options.commit,
    });
  });

// resolutions command
program
  .command("resolutions")
  .description("List resolutions")
  .option("--thread <id>", "Thread ID")
  .option("--all", "List from all threads")
  .option("--type <type>", "Filter by type")
  .option("--owner <repo>", "Filter by owner")
  .option("--status <status>", "Filter by status")
  .option("--format <format>", "Output format: text, json, markdown", "text")
  .action(async (options) => {
    const { resolutionsListCommand } = await import("./commands/resolution.js");
    await resolutionsListCommand(options);
  });

// evidence list command
program
  .command("evidence-list")
  .description("List evidence files in a thread")
  .requiredOption("--thread <id>", "Thread ID")
  .option("--type <type>", "Filter by type: image, log, code, config, screenshot")
  .option("--format <format>", "Output format: text, json", "text")
  .action(async (options) => {
    const { listEvidenceCommand } = await import("./commands/evidence.js");
    await listEvidenceCommand(options);
  });

// evidence bundle command
program
  .command("evidence-bundle")
  .description("Create an evidence bundle for a thread")
  .requiredOption("--thread <id>", "Thread ID")
  .option("--output <path>", "Output file path")
  .option("--include-transcript", "Include thread transcript")
  .option("--include-messages", "Include all messages")
  .action(async (options) => {
    const { bundleEvidenceCommand } = await import("./commands/evidence.js");
    await bundleEvidenceCommand({
      thread: options.thread,
      output: options.output,
      includeTranscript: options.includeTranscript,
      includeMessages: options.includeMessages,
    });
  });

// summary command
program
  .command("summary")
  .description("Generate a thread summary")
  .requiredOption("--thread <id>", "Thread ID")
  .option("--output <format>", "Output format: text, markdown, json", "text")
  .option("--save", "Save summary to thread directory")
  .action(async (options) => {
    const { summaryCommand } = await import("./commands/summary.js");
    await summaryCommand(options);
  });

// postmortem command
program
  .command("postmortem")
  .description("Generate a postmortem report for a thread")
  .requiredOption("--thread <id>", "Thread ID")
  .option("--output <format>", "Output format: text, markdown, json", "text")
  .option("--save", "Save postmortem to thread directory")
  .option("--template <type>", "Template: standard, blameless, brief", "standard")
  .action(async (options) => {
    const { postmortemCommand } = await import("./commands/postmortem.js");
    await postmortemCommand(options);
  });

// narrate command
program
  .command("narrate")
  .description("Narrate a thread session for human observers")
  .requiredOption("--thread <id>", "Thread ID")
  .option("--verbosity <level>", "Verbosity: low, medium, high", "medium")
  .option("--format <format>", "Output format: terminal, markdown, json", "terminal")
  .option("--save", "Save narration to thread directory")
  .action(async (options) => {
    const { narrateCommand } = await import("./commands/narrate.js");
    await narrateCommand(options);
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
