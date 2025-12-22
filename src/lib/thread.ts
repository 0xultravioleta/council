import { mkdir, writeFile, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { WORKSPACE_STRUCTURE } from "./workspace.js";

// Generate thread ID: th_YYYYMMDD_HHMMSS_xxxx
export function generateThreadId(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const time = now.toTimeString().slice(0, 8).replace(/:/g, "");
  const random = Math.random().toString(36).slice(2, 6);
  return `th_${date}_${time}_${random}`;
}

// Thread directory structure
export function getThreadPaths(basePath: string, threadId: string) {
  const threadDir = join(basePath, WORKSPACE_STRUCTURE.threads, threadId);
  return {
    root: threadDir,
    inbox: join(threadDir, "inbox"),
    outbox: join(threadDir, "outbox"),
    evidence: join(threadDir, "evidence"),
    artifacts: join(threadDir, "artifacts"),
    prompts: join(threadDir, "prompts"),
    memory: join(threadDir, "memory"),
    transcript: join(threadDir, "transcript.md"),
    state: join(threadDir, "state.json"),
    resolution: join(threadDir, "resolution.md"),
  };
}

// Thread state interface
export interface ThreadState {
  id: string;
  title: string;
  repos: string[];
  created_at: string;
  updated_at: string;
  turn: number;
  status: "active" | "paused" | "resolved" | "blocked" | "abandoned";
  pending_for: string[];
  suspects: string[];
  last_message_from?: string;
  last_message_to?: string;
}

// Create initial thread state
function createInitialState(threadId: string, title: string, repos: string[]): ThreadState {
  const now = new Date().toISOString();
  return {
    id: threadId,
    title,
    repos,
    created_at: now,
    updated_at: now,
    turn: 0,
    status: "active",
    pending_for: [],
    suspects: [],
  };
}

// Create initial transcript
function createInitialTranscript(threadId: string, title: string, repos: string[]): string {
  const now = new Date().toISOString();
  return `# Thread: ${title}

**ID:** ${threadId}
**Created:** ${now}
**Repos:** ${repos.join(", ")}

---

## Timeline

`;
}

// Create a new thread
export interface CreateThreadOptions {
  title: string;
  repos: string[];
}

export async function createThread(
  basePath: string,
  options: CreateThreadOptions
): Promise<{ threadId: string; paths: ReturnType<typeof getThreadPaths> }> {
  const threadId = generateThreadId();
  const paths = getThreadPaths(basePath, threadId);

  // Create directories
  const dirs = [
    paths.root,
    paths.inbox,
    paths.outbox,
    paths.evidence,
    paths.artifacts,
    paths.prompts,
    paths.memory,
  ];

  for (const dir of dirs) {
    await mkdir(dir, { recursive: true });
  }

  // Create state.json
  const state = createInitialState(threadId, options.title, options.repos);
  await writeFile(paths.state, JSON.stringify(state, null, 2), "utf-8");

  // Create transcript.md
  const transcript = createInitialTranscript(threadId, options.title, options.repos);
  await writeFile(paths.transcript, transcript, "utf-8");

  return { threadId, paths };
}

// List all threads
export interface ThreadSummary {
  id: string;
  title: string;
  status: string;
  repos: string[];
  created_at: string;
  turn: number;
}

export async function listThreads(basePath: string): Promise<ThreadSummary[]> {
  const threadsDir = join(basePath, WORKSPACE_STRUCTURE.threads);

  let entries: string[];
  try {
    entries = await readdir(threadsDir);
  } catch {
    return [];
  }

  const threads: ThreadSummary[] = [];

  for (const entry of entries) {
    if (!entry.startsWith("th_")) continue;

    const statePath = join(threadsDir, entry, "state.json");
    try {
      const content = await readFile(statePath, "utf-8");
      const state = JSON.parse(content) as ThreadState;
      threads.push({
        id: state.id,
        title: state.title,
        status: state.status,
        repos: state.repos,
        created_at: state.created_at,
        turn: state.turn,
      });
    } catch {
      // Skip invalid threads
    }
  }

  // Sort by created_at descending
  threads.sort((a, b) => b.created_at.localeCompare(a.created_at));

  return threads;
}

// Load thread state
export async function loadThreadState(basePath: string, threadId: string): Promise<ThreadState> {
  const paths = getThreadPaths(basePath, threadId);

  try {
    const content = await readFile(paths.state, "utf-8");
    return JSON.parse(content) as ThreadState;
  } catch (error) {
    throw new Error(`Thread ${threadId} not found or invalid state`);
  }
}

// Save thread state
export async function saveThreadState(basePath: string, threadId: string, state: ThreadState): Promise<void> {
  const paths = getThreadPaths(basePath, threadId);
  state.updated_at = new Date().toISOString();
  await writeFile(paths.state, JSON.stringify(state, null, 2), "utf-8");
}
