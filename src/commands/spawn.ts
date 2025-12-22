import { resolve } from "node:path";
import { loadThreadState } from "../lib/thread.js";
import { loadRegistry } from "../lib/registry.js";
import { spawner, spawnAllPending, type SpawnedSession } from "../lib/spawner.js";

export interface SpawnCommandOptions {
  thread: string;
  repo?: string;
  print?: boolean;
  all?: boolean;
}

export async function spawnCommand(options: SpawnCommandOptions): Promise<void> {
  const basePath = resolve(process.cwd(), ".council");

  try {
    // Load thread state
    const state = await loadThreadState(basePath, options.thread);
    const registry = await loadRegistry(basePath);

    console.log(`\n📦 Thread: ${options.thread}`);
    console.log(`   Title: ${state.title}`);
    console.log(`   Status: ${state.status}`);
    console.log(`   Turn: ${state.turn}`);

    if (state.pending_for.length === 0) {
      console.log("\n⚠️  No pending repos - nothing to spawn");
      console.log("   Run 'council ask' to send a message first, or");
      console.log("   Run 'council tick' to process outbox messages.");
      return;
    }

    console.log(`   Pending: ${state.pending_for.join(", ")}`);

    // Determine which repos to spawn
    const reposToSpawn = options.repo
      ? [options.repo]
      : options.all
        ? state.pending_for
        : state.pending_for;

    // Validate repos
    for (const repo of reposToSpawn) {
      if (!state.pending_for.includes(repo)) {
        console.error(`\n❌ Repo "${repo}" is not pending in this thread`);
        process.exit(1);
      }
      if (!registry.repos[repo]) {
        console.error(`\n❌ Repo "${repo}" not found in registry`);
        process.exit(1);
      }
    }

    console.log(`\n🚀 Spawning Claude Code sessions for: ${reposToSpawn.join(", ")}`);

    if (options.print) {
      console.log("   Mode: print (non-interactive)\n");
    } else {
      console.log("   Mode: interactive\n");
    }

    const sessions: SpawnedSession[] = [];

    // Set up event handlers
    spawner.on("stdout", (data, session) => {
      const lines = data.trim().split("\n");
      for (const line of lines) {
        console.log(`[${session.repo}] ${line}`);
      }
    });

    spawner.on("stderr", (data, session) => {
      const lines = data.trim().split("\n");
      for (const line of lines) {
        console.error(`[${session.repo}:err] ${line}`);
      }
    });

    spawner.on("exit", (code, session) => {
      console.log(`\n✅ [${session.repo}] Claude Code exited with code ${code}`);
    });

    spawner.on("error", (error, session) => {
      console.error(`\n❌ [${session.repo}] Error: ${error.message}`);
    });

    // Spawn sessions
    for (const repo of reposToSpawn) {
      try {
        const session = await spawner.spawn({
          basePath,
          threadId: options.thread,
          repo,
          printMode: options.print,
        });
        sessions.push(session);
        console.log(`   ✓ ${repo} (PID: ${session.pid}, CWD: ${session.cwd})`);
      } catch (error) {
        console.error(`   ✗ ${repo}: ${(error as Error).message}`);
      }
    }

    if (sessions.length === 0) {
      console.error("\n❌ No sessions were spawned");
      process.exit(1);
    }

    console.log(`\n📊 ${sessions.length} session(s) running`);
    console.log("\nPress Ctrl+C to terminate all sessions");

    // Handle graceful shutdown
    const cleanup = () => {
      console.log("\n\n🛑 Terminating sessions...");
      const killed = spawner.killAll();
      console.log(`   Killed ${killed} session(s)`);
      process.exit(0);
    };

    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);

    // Wait for all sessions to complete
    await Promise.all(
      sessions.map(async (session) => {
        try {
          await spawner.waitForSession(session.threadId, session.repo);
        } catch {
          // Session already handled by error event
        }
      })
    );

    console.log("\n✨ All sessions completed");

  } catch (error) {
    console.error(`\n❌ Error: ${(error as Error).message}`);
    process.exit(1);
  }
}

/**
 * List active sessions
 */
export function listSessions(): void {
  const sessions = spawner.getActiveSessions();

  if (sessions.length === 0) {
    console.log("\nNo active Claude Code sessions");
    return;
  }

  console.log(`\n📊 Active sessions (${sessions.length}):\n`);

  for (const session of sessions) {
    console.log(`   ${session.repo}`);
    console.log(`     Thread: ${session.threadId}`);
    console.log(`     PID: ${session.pid}`);
    console.log(`     CWD: ${session.cwd}`);
    console.log(`     Started: ${session.startedAt}`);
    console.log("");
  }
}
