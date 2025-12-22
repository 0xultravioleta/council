import { readdir, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { loadThreadState, saveThreadState, getThreadPaths, type ThreadState } from "./thread.js";
import { readMessages, type Message } from "./message.js";
import { appendToTranscript } from "./transcript.js";
import { loadRegistry } from "./registry.js";

export interface TickResult {
  turn: number;
  pendingRepos: string[];
  processedMessages: Message[];
  newPendingRepos: string[];
  status: "active" | "resolved" | "blocked" | "max_turns";
}

// Process outbox messages and move them to inboxes
async function processOutboxMessages(
  basePath: string,
  threadId: string,
  state: ThreadState
): Promise<Message[]> {
  const paths = getThreadPaths(basePath, threadId);
  const processed: Message[] = [];

  // Read all outbox messages
  const outboxMessages = await readMessages(paths.outbox);

  for (const msg of outboxMessages) {
    // Append to transcript
    await appendToTranscript(basePath, threadId, msg);

    // Move message file from outbox to inbox
    const filename = `${msg.timestamp.replace(/[:.]/g, "").slice(0, 15)}_${msg.from}_to_${msg.to}.json`;
    const srcPath = join(paths.outbox, filename);
    const dstPath = join(paths.inbox, filename);

    try {
      await rename(srcPath, dstPath);
    } catch {
      // File might have different name, try to find it
      const files = await readdir(paths.outbox);
      for (const f of files) {
        if (f.includes(msg.message_id) || (f.includes(msg.from) && f.includes(msg.to))) {
          await rename(join(paths.outbox, f), join(paths.inbox, f));
          break;
        }
      }
    }

    processed.push(msg);
  }

  return processed;
}

// Determine which repos need to respond
function determineNewPendingRepos(
  processedMessages: Message[],
  state: ThreadState
): string[] {
  const pending = new Set<string>();

  for (const msg of processedMessages) {
    if (msg.to === "ALL") {
      // All repos except sender should respond
      for (const repo of state.repos) {
        if (repo !== msg.from) {
          pending.add(repo);
        }
      }
    } else if (state.repos.includes(msg.to)) {
      pending.add(msg.to);
    }
  }

  return Array.from(pending);
}

// Check if thread should be closed
function checkResolution(processedMessages: Message[]): boolean {
  return processedMessages.some((m) => m.type === "resolution");
}

// Run a single tick
export async function runTick(
  basePath: string,
  threadId: string
): Promise<TickResult> {
  const registry = await loadRegistry(basePath);
  const state = await loadThreadState(basePath, threadId);

  // Check max turns
  const maxTurns = registry.council?.max_turns ?? 14;
  if (state.turn >= maxTurns) {
    return {
      turn: state.turn,
      pendingRepos: state.pending_for,
      processedMessages: [],
      newPendingRepos: [],
      status: "max_turns",
    };
  }

  // Process outbox messages
  const processedMessages = await processOutboxMessages(basePath, threadId, state);

  // Determine new pending repos
  const newPendingRepos = determineNewPendingRepos(processedMessages, state);

  // Check for resolution
  const resolved = checkResolution(processedMessages);

  // Update state
  const newTurn = state.turn + 1;
  const newStatus = resolved ? "resolved" : "active";

  const lastMsg = processedMessages[processedMessages.length - 1];

  const updatedState: ThreadState = {
    ...state,
    turn: newTurn,
    status: newStatus,
    pending_for: resolved ? [] : newPendingRepos,
    last_message_from: lastMsg?.from ?? state.last_message_from,
    last_message_to: lastMsg?.to ?? state.last_message_to,
    updated_at: new Date().toISOString(),
  };

  await saveThreadState(basePath, threadId, updatedState);

  return {
    turn: newTurn,
    pendingRepos: state.pending_for,
    processedMessages,
    newPendingRepos,
    status: newStatus,
  };
}

// Clear inbox for a repo (after processing)
export async function clearInboxFor(
  basePath: string,
  threadId: string,
  repo: string
): Promise<number> {
  const paths = getThreadPaths(basePath, threadId);
  const messages = await readMessages(paths.inbox);

  let cleared = 0;
  const files = await readdir(paths.inbox);

  for (const file of files) {
    if (file.includes(`_to_${repo}.json`) || file.includes("_to_ALL.json")) {
      await rm(join(paths.inbox, file));
      cleared++;
    }
  }

  return cleared;
}
