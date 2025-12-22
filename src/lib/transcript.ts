import { appendFile, readFile } from "node:fs/promises";
import { getThreadPaths } from "./thread.js";
import type { Message } from "./message.js";

// Format a message for the transcript
function formatTranscriptEntry(message: Message): string {
  const time = new Date(message.timestamp).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const arrow = message.from === "HUMAN" ? ">>>" : "->";

  let entry = `[${time}] ${message.from} ${arrow} ${message.to}: ${message.summary}`;

  if (message.type !== "question" && message.type !== "context_injection") {
    entry += ` (${message.type})`;
  }

  return entry + "\n";
}

// Append a message to the transcript
export async function appendToTranscript(
  basePath: string,
  threadId: string,
  message: Message
): Promise<void> {
  const paths = getThreadPaths(basePath, threadId);
  const entry = formatTranscriptEntry(message);
  await appendFile(paths.transcript, entry, "utf-8");
}

// Read the transcript
export async function readTranscript(basePath: string, threadId: string): Promise<string> {
  const paths = getThreadPaths(basePath, threadId);
  try {
    return await readFile(paths.transcript, "utf-8");
  } catch {
    return "";
  }
}

// Append raw text to transcript
export async function appendRawToTranscript(
  basePath: string,
  threadId: string,
  text: string
): Promise<void> {
  const paths = getThreadPaths(basePath, threadId);
  await appendFile(paths.transcript, text, "utf-8");
}
