import { writeFile, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { getThreadPaths } from "./thread.js";

// Message types
export const MessageTypeSchema = z.enum([
  "question",
  "answer",
  "request_evidence",
  "hypothesis",
  "repro",
  "patch_proposal",
  "decision",
  "resolution",
  "context_injection", // From HUMAN
]);

export type MessageType = z.infer<typeof MessageTypeSchema>;

// Context schema
const MessageContextSchema = z.object({
  env: z.string().optional(),
  time_window: z.string().optional(),
  request_id: z.string().optional(),
  commit: z.string().optional(),
}).optional();

// Message schema
export const MessageSchema = z.object({
  thread_id: z.string(),
  message_id: z.string(),
  from: z.string(), // repo name or "HUMAN"
  to: z.string(), // repo name or "ALL"
  type: MessageTypeSchema,
  timestamp: z.string(),
  summary: z.string(),
  context: MessageContextSchema,
  evidence_refs: z.array(z.string()).optional(),
  questions: z.array(z.string()).optional(),
  asks: z.array(z.string()).optional(),
  notes: z.array(z.string()).optional(), // For HUMAN messages
  suspects: z.array(z.string()).optional(),
  fix_proposal: z.object({
    file: z.string(),
    change: z.string(),
  }).optional(),
});

export type Message = z.infer<typeof MessageSchema>;

// Generate message ID: msg_HHMMSS_xxxx
export function generateMessageId(): string {
  const now = new Date();
  const time = now.toTimeString().slice(0, 8).replace(/:/g, "");
  const random = Math.random().toString(36).slice(2, 6);
  return `msg_${time}_${random}`;
}

// Generate message filename
export function getMessageFilename(message: Message): string {
  const ts = message.timestamp.replace(/[:.]/g, "").slice(0, 15);
  return `${ts}_${message.from}_to_${message.to}.json`;
}

// Create a new message
export interface CreateMessageOptions {
  threadId: string;
  from: string;
  to: string;
  type: MessageType;
  summary: string;
  context?: z.infer<typeof MessageContextSchema>;
  evidence_refs?: string[];
  questions?: string[];
  asks?: string[];
  notes?: string[];
  suspects?: string[];
}

export function createMessage(options: CreateMessageOptions): Message {
  return {
    thread_id: options.threadId,
    message_id: generateMessageId(),
    from: options.from,
    to: options.to,
    type: options.type,
    timestamp: new Date().toISOString(),
    summary: options.summary,
    context: options.context,
    evidence_refs: options.evidence_refs,
    questions: options.questions,
    asks: options.asks,
    notes: options.notes,
    suspects: options.suspects,
  };
}

// Write message to inbox
export async function writeInboxMessage(
  basePath: string,
  threadId: string,
  message: Message
): Promise<string> {
  const paths = getThreadPaths(basePath, threadId);
  const filename = getMessageFilename(message);
  const filepath = join(paths.inbox, filename);

  await writeFile(filepath, JSON.stringify(message, null, 2), "utf-8");
  return filepath;
}

// Write message to outbox
export async function writeOutboxMessage(
  basePath: string,
  threadId: string,
  message: Message
): Promise<string> {
  const paths = getThreadPaths(basePath, threadId);
  const filename = getMessageFilename(message);
  const filepath = join(paths.outbox, filename);

  await writeFile(filepath, JSON.stringify(message, null, 2), "utf-8");
  return filepath;
}

// Read all messages from a directory
export async function readMessages(dir: string): Promise<Message[]> {
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return [];
  }

  const messages: Message[] = [];

  for (const file of files) {
    if (!file.endsWith(".json")) continue;

    try {
      const content = await readFile(join(dir, file), "utf-8");
      const parsed = JSON.parse(content);
      const result = MessageSchema.safeParse(parsed);
      if (result.success) {
        messages.push(result.data);
      }
    } catch {
      // Skip invalid messages
    }
  }

  // Sort by timestamp
  messages.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  return messages;
}

// Read inbox messages
export async function readInboxMessages(basePath: string, threadId: string): Promise<Message[]> {
  const paths = getThreadPaths(basePath, threadId);
  return readMessages(paths.inbox);
}

// Read outbox messages
export async function readOutboxMessages(basePath: string, threadId: string): Promise<Message[]> {
  const paths = getThreadPaths(basePath, threadId);
  return readMessages(paths.outbox);
}

// Validate message
export function validateMessage(data: unknown): { success: true; data: Message } | { success: false; error: string } {
  const result = MessageSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const issues = result.error.issues
    .map((i) => `${i.path.join(".")}: ${i.message}`)
    .join("; ");
  return { success: false, error: issues };
}
