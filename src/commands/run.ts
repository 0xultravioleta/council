import { resolve } from "node:path";
import { loadThreadState, saveThreadState, type ThreadState } from "../lib/thread.js";
import { runTick, type TickResult } from "../lib/tick.js";
import { generatePrompts } from "../lib/prompts.js";
import { createWatcher, type OutboxEvent } from "../lib/watcher.js";
import { spawner, type SpawnedSession } from "../lib/spawner.js";

export interface RunCommandOptions {
  thread: string;
  spawn?: boolean;
  timeout?: string;
}

interface RunState {
  running: boolean;
  tickCount: number;
  startTime: number;
  lastTickTime: number;
  sessions: SpawnedSession[];
}

export async function runCommand(options: RunCommandOptions): Promise<void> {
  const basePath = resolve(process.cwd(), ".council");
  const timeoutMs = options.timeout ? parseInt(options.timeout, 10) : undefined;

  const runState: RunState = {
    running: true,
    tickCount: 0,
    startTime: Date.now(),
    lastTickTime: 0,
    sessions: [],
  };

  try {
    // Load initial state
    let state = await loadThreadState(basePath, options.thread);

    console.log(`\n🚀 Council Auto-Run`);
    console.log(`   Thread: ${options.thread}`);
    console.log(`   Title: ${state.title}`);
    console.log(`   Status: ${state.status}`);
    console.log(`   Turn: ${state.turn}`);
    console.log(`   Pending: ${state.pending_for.join(", ") || "(none)"}`);

    if (timeoutMs) {
      console.log(`   Timeout: ${timeoutMs}ms`);
    }

    if (state.status !== "active") {
      console.log(`\n⚠️  Thread is not active (status: ${state.status})`);
      return;
    }

    // Create watcher for outbox
    const watcher = createWatcher({
      threadId: options.thread,
      basePath,
    });

    // Track pending ticks
    let tickPending = false;

    // Handle outbox events
    watcher.on("outbox", async (event: OutboxEvent) => {
      if (!runState.running) return;

      console.log(`\n📬 New outbox message: ${event.filename}`);

      if (event.message) {
        console.log(`   From: ${event.message.from}`);
        console.log(`   To: ${event.message.to}`);
        console.log(`   Type: ${event.message.type}`);
        console.log(`   Summary: ${event.message.summary}`);
      }

      // Debounce ticks slightly to batch multiple messages
      if (!tickPending) {
        tickPending = true;
        setTimeout(async () => {
          tickPending = false;
          if (runState.running) {
            await doTick();
          }
        }, 500);
      }
    });

    watcher.on("error", (error) => {
      console.error(`\n❌ Watcher error: ${error.message}`);
    });

    watcher.on("ready", () => {
      console.log(`\n👀 Watching for outbox changes...`);
    });

    // Do a tick
    async function doTick(): Promise<void> {
      runState.tickCount++;
      runState.lastTickTime = Date.now();

      console.log(`\n⏱️  Tick #${runState.tickCount}`);

      try {
        const result = await runTick(basePath, options.thread);

        console.log(`   Processed: ${result.processedMessages.length} messages`);
        console.log(`   New pending: ${result.newPendingRepos.join(", ") || "(none)"}`);
        console.log(`   Turn: ${result.turn}`);
        console.log(`   Status: ${result.status}`);

        // Check for stop conditions
        if (result.status === "resolved") {
          console.log(`\n✅ Thread resolved!`);
          await cleanup("resolved");
          return;
        }

        if (result.status === "max_turns") {
          console.log(`\n⚠️  Max turns reached`);
          await cleanup("max_turns");
          return;
        }

        // Generate prompts for pending repos
        if (result.newPendingRepos.length > 0) {
          const prompts = await generatePrompts(basePath, options.thread);
          console.log(`\n📝 Generated ${prompts.length} prompt(s)`);

          for (const p of prompts) {
            console.log(`   - ${p.repo}: ${p.inboxMessages.length} message(s)`);
          }

          // Spawn Claude sessions if requested
          if (options.spawn && prompts.length > 0) {
            await spawnSessions(result.newPendingRepos);
          }
        }
      } catch (error) {
        console.error(`   Error: ${(error as Error).message}`);
      }
    }

    // Spawn Claude sessions
    async function spawnSessions(repos: string[]): Promise<void> {
      console.log(`\n🤖 Spawning Claude Code sessions...`);

      for (const repo of repos) {
        try {
          // Check if session already exists
          const existing = spawner.getSession(options.thread, repo);
          if (existing && existing.status === "running") {
            console.log(`   ⏭️  ${repo}: already running (PID: ${existing.pid})`);
            continue;
          }

          const session = await spawner.spawn({
            basePath,
            threadId: options.thread,
            repo,
          });

          runState.sessions.push(session);
          console.log(`   ✓ ${repo} (PID: ${session.pid})`);
        } catch (error) {
          console.error(`   ✗ ${repo}: ${(error as Error).message}`);
        }
      }
    }

    // Cleanup function
    async function cleanup(reason: string): Promise<void> {
      runState.running = false;

      console.log(`\n🏁 Stopping (${reason})`);

      // Stop watcher
      await watcher.stop();

      // Kill any running sessions
      const killed = spawner.killThread(options.thread);
      if (killed > 0) {
        console.log(`   Killed ${killed} session(s)`);
      }

      const elapsed = Date.now() - runState.startTime;
      console.log(`\n📊 Run complete`);
      console.log(`   Ticks: ${runState.tickCount}`);
      console.log(`   Duration: ${(elapsed / 1000).toFixed(1)}s`);
    }

    // Handle graceful shutdown
    const handleShutdown = async () => {
      console.log("\n\n🛑 Interrupted");
      await cleanup("interrupted");
      process.exit(0);
    };

    process.on("SIGINT", handleShutdown);
    process.on("SIGTERM", handleShutdown);

    // Set timeout if specified
    if (timeoutMs) {
      setTimeout(async () => {
        console.log("\n\n⏰ Timeout reached");
        await cleanup("timeout");
        process.exit(0);
      }, timeoutMs);
    }

    // Start watching
    watcher.start();

    // Do initial tick if there are pending messages
    state = await loadThreadState(basePath, options.thread);
    if (state.pending_for.length > 0) {
      console.log(`\n📋 Initial state has ${state.pending_for.length} pending repo(s)`);

      // Generate initial prompts
      const prompts = await generatePrompts(basePath, options.thread);
      if (prompts.length > 0) {
        console.log(`📝 Generated ${prompts.length} prompt(s)`);
        for (const p of prompts) {
          console.log(`   - ${p.repo}: ${p.inboxMessages.length} message(s)`);
        }

        // Spawn if requested
        if (options.spawn) {
          await spawnSessions(state.pending_for);
        } else {
          console.log(`\nℹ️  Use 'council prompts --thread ${options.thread}' to view prompts`);
          console.log(`   Or run with --spawn to auto-spawn Claude Code sessions`);
        }
      }
    }

    // Keep the process running
    await new Promise(() => {});

  } catch (error) {
    console.error(`\n❌ Error: ${(error as Error).message}`);
    process.exit(1);
  }
}
