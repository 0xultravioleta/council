import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { getThreadPaths, loadThreadState } from "./thread.js";
import { loadRegistry, type NormalizedRegistry, type RepoConfig } from "./registry.js";
import { createMemoryManager, type MemoryContext } from "./memory.js";
import type { Message } from "./message.js";

export interface GeneratedPrompt {
  repo: string;
  repoConfig: RepoConfig;
  prompt: string;
  inboxMessages: Message[];
  memoryContext?: MemoryContext;
}

// Read all messages from a repo's inbox
async function readInboxMessages(inboxPath: string): Promise<Message[]> {
  const messages: Message[] = [];

  try {
    const files = await readdir(inboxPath);
    const jsonFiles = files.filter((f) => f.endsWith(".json"));

    for (const file of jsonFiles) {
      const content = await readFile(join(inboxPath, file), "utf-8");
      messages.push(JSON.parse(content));
    }

    // Sort by timestamp
    messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  } catch {
    // Inbox doesn't exist or is empty
  }

  return messages;
}

// Generate the system prompt for a repo
function generateSystemPrompt(
  repo: string,
  repoConfig: RepoConfig,
  threadId: string,
  threadTitle: string,
  allRepos: string[],
  registry: NormalizedRegistry
): string {
  const otherRepos = allRepos.filter((r) => r !== repo);

  let prompt = `# Council Session - ${repo}

You are an AI assistant working on the **${repo}** codebase as part of a multi-repo debugging session.

## Thread Context
- **Thread ID:** ${threadId}
- **Title:** ${threadTitle}
- **Your repo:** ${repo}
- **Other repos in session:** ${otherRepos.join(", ") || "none"}

## Your Codebase
- **Path:** ${repoConfig.path}
`;

  if (repoConfig.tech_hints && repoConfig.tech_hints.length > 0) {
    prompt += `- **Technologies:** ${repoConfig.tech_hints.join(", ")}\n`;
  }

  if (repoConfig.quick_commands && Object.keys(repoConfig.quick_commands).length > 0) {
    prompt += `- **Quick commands:**\n`;
    for (const [name, cmd] of Object.entries(repoConfig.quick_commands)) {
      prompt += `  - \`${name}\`: \`${cmd}\`\n`;
    }
  }

  prompt += `
## Instructions

You are participating in a collaborative debugging session. Other AI assistants are working on other repos.

**Your role:**
1. Read incoming messages from other repos
2. Investigate issues in YOUR codebase (${repo})
3. Respond with findings, hypotheses, or requests for more information

**Response format:**
When you have something to communicate, create a JSON message file in your outbox with this structure:

\`\`\`json
{
  "to": "<target_repo or ALL>",
  "type": "<message_type>",
  "summary": "<one-line summary>",
  "content": "<detailed content>",
  "questions": ["optional array of questions"],
  "evidence": ["optional array of evidence/findings"]
}
\`\`\`

**Message types:**
- \`answer\` - Direct response to a question
- \`hypothesis\` - Theory about what might be wrong
- \`request_evidence\` - Ask another repo for logs, traces, etc.
- \`repro\` - Steps to reproduce an issue
- \`patch_proposal\` - Proposed code fix
- \`decision\` - A decision point that needs consensus

`;

  return prompt;
}

// Format inbox messages for the prompt
function formatInboxMessages(messages: Message[]): string {
  if (messages.length === 0) {
    return "No pending messages.\n";
  }

  let formatted = "";

  for (const msg of messages) {
    const time = new Date(msg.timestamp).toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    });

    formatted += `### From: ${msg.from} | Type: ${msg.type} | ${time}\n\n`;
    formatted += `**Summary:** ${msg.summary}\n\n`;

    if (msg.notes && msg.notes.length > 0) {
      formatted += `**Notes:**\n`;
      for (const n of msg.notes) {
        formatted += `- ${n}\n`;
      }
      formatted += "\n";
    }

    if (msg.questions && msg.questions.length > 0) {
      formatted += `**Questions:**\n`;
      for (const q of msg.questions) {
        formatted += `- ${q}\n`;
      }
      formatted += "\n";
    }

    if (msg.asks && msg.asks.length > 0) {
      formatted += `**Asks:**\n`;
      for (const a of msg.asks) {
        formatted += `- ${a}\n`;
      }
      formatted += "\n";
    }

    if (msg.evidence_refs && msg.evidence_refs.length > 0) {
      formatted += `**Evidence:**\n`;
      for (const e of msg.evidence_refs) {
        formatted += `- ${e}\n`;
      }
      formatted += "\n";
    }

    formatted += "---\n\n";
  }

  return formatted;
}

export interface GeneratePromptsOptions {
  /** Include memory context (SOPs, facts) */
  includeMemory?: boolean;
  /** Optimize prompts for efficiency (shorter, more focused) */
  optimize?: boolean;
  /** Add a hint/focus area to guide the investigation */
  hint?: string;
}

// Generate prompts for all pending repos
export async function generatePrompts(
  basePath: string,
  threadId: string,
  options?: GeneratePromptsOptions
): Promise<GeneratedPrompt[]> {
  const registry = await loadRegistry(basePath);
  const state = await loadThreadState(basePath, threadId);
  const paths = getThreadPaths(basePath, threadId);

  const prompts: GeneratedPrompt[] = [];

  // Fetch memory context if enabled
  let memoryContext: MemoryContext | undefined;
  if (options?.includeMemory && registry.memory.enabled) {
    try {
      const memoryManager = createMemoryManager(registry);
      await memoryManager.initialize();
      if (memoryManager.isAvailable()) {
        memoryContext = await memoryManager.getContextForThread(
          state.title,
          state.repos
        );
      }
    } catch (error) {
      // Graceful degradation - continue without memory
      console.warn(`[Memory] Failed to fetch context: ${(error as Error).message}`);
    }
  }

  for (const repo of state.pending_for) {
    const repoConfig = registry.repos[repo];
    if (!repoConfig) {
      continue;
    }

    // Get inbox path for this repo
    const repoInboxPath = join(paths.inbox);

    // Read messages addressed to this repo
    const allMessages = await readInboxMessages(repoInboxPath);
    const repoMessages = allMessages.filter((m) => m.to === repo || m.to === "ALL");

    // Generate the prompt
    const systemPrompt = generateSystemPrompt(
      repo,
      repoConfig,
      threadId,
      state.title,
      state.repos,
      registry
    );

    // Build memory section if available
    let memorySection = "";
    if (memoryContext && (memoryContext.sopPrompt || memoryContext.factPrompt)) {
      memorySection = "\n## Memory Context\n\n";
      if (memoryContext.sopPrompt) {
        memorySection += memoryContext.sopPrompt + "\n";
      }
      if (memoryContext.factPrompt) {
        memorySection += memoryContext.factPrompt + "\n";
      }
    }

    // Build hint section if provided
    let hintSection = "";
    if (options?.hint) {
      hintSection = `\n## Focus Area\n\n**Hint from orchestrator:** ${options.hint}\n\nPrioritize investigating aspects related to this hint.\n`;
    }

    // Build task section based on optimization level
    let taskSection = "";
    if (options?.optimize) {
      taskSection = `\n## Task\n\nInvestigate based on inbox messages. Respond concisely with key findings only.\n`;
    } else {
      taskSection = `\n## Your Task\n\nReview the messages above and investigate in your codebase. When ready, respond with a message to the appropriate repo.\n`;
    }

    const fullPrompt =
      systemPrompt +
      memorySection +
      hintSection +
      "\n## Inbox Messages\n\n" +
      formatInboxMessages(repoMessages) +
      taskSection;

    prompts.push({
      repo,
      repoConfig,
      prompt: fullPrompt,
      inboxMessages: repoMessages,
      memoryContext,
    });
  }

  return prompts;
}

// Generate a single prompt for a specific repo
export async function generatePromptForRepo(
  basePath: string,
  threadId: string,
  repo: string,
  options?: GeneratePromptsOptions
): Promise<GeneratedPrompt | null> {
  const prompts = await generatePrompts(basePath, threadId, options);
  return prompts.find((p) => p.repo === repo) || null;
}
