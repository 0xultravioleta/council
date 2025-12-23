/**
 * Acontext Memory Client
 *
 * Acontext is the operational memory system that stores:
 * - Sessions (thread data with all messages)
 * - Artifacts (screenshots, logs, code snippets)
 * - SOPs (Standard Operating Procedures learned from resolved threads)
 */

import type { ThreadState } from "./thread.js";
import type { Message } from "./message.js";

export interface AcontextConfig {
  base_url: string;
  api_key: string;
  space_name: string;
}

export interface AcontextSession {
  id: string;
  space_name: string;
  title: string;
  labels: string[];
  created_at: string;
  updated_at: string;
  status: "active" | "completed" | "archived";
  metadata?: Record<string, unknown>;
}

export interface AcontextArtifact {
  id: string;
  session_id: string;
  type: "screenshot" | "log" | "snippet" | "file";
  name: string;
  content_type: string;
  size: number;
  url?: string;
  created_at: string;
}

export interface SOP {
  id: string;
  title: string;
  description: string;
  steps: string[];
  trigger_pattern?: string;
  confidence: number;
  source_sessions: string[];
  created_at: string;
}

export interface ExperienceSearchResult {
  sops: SOP[];
  relevance_scores: number[];
}

export interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
}

const DEFAULT_RETRY: RetryOptions = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
};

const DEFAULT_TIMEOUT = 30000;

export class AcontextError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = "AcontextError";
  }
}

export class AcontextClient {
  private config: AcontextConfig;
  private retryOptions: RetryOptions;
  private timeout: number;

  constructor(
    config: AcontextConfig,
    options?: { retry?: Partial<RetryOptions>; timeout?: number }
  ) {
    this.config = config;
    this.retryOptions = { ...DEFAULT_RETRY, ...options?.retry };
    this.timeout = options?.timeout ?? DEFAULT_TIMEOUT;
  }

  /**
   * Make an HTTP request with retries and timeout
   */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.config.base_url}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.config.api_key}`,
      "Content-Type": "application/json",
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.retryOptions.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorBody = await response.text().catch(() => "");
          throw new AcontextError(
            `HTTP ${response.status}: ${errorBody}`,
            response.status
          );
        }

        return (await response.json()) as T;
      } catch (error) {
        lastError = error as Error;

        // Don't retry on client errors (4xx) except 429
        if (error instanceof AcontextError) {
          if (error.status && error.status >= 400 && error.status < 500 && error.status !== 429) {
            throw error;
          }
        }

        // Don't retry on abort
        if ((error as Error).name === "AbortError") {
          throw new AcontextError("Request timeout", undefined, "TIMEOUT");
        }

        // Wait before retry with exponential backoff
        if (attempt < this.retryOptions.maxRetries) {
          const delay = Math.min(
            this.retryOptions.baseDelay * Math.pow(2, attempt),
            this.retryOptions.maxDelay
          );
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }

    throw lastError ?? new AcontextError("Unknown error");
  }

  /**
   * Create a new session from a thread
   */
  async createSession(
    thread: ThreadState,
    messages: Message[]
  ): Promise<AcontextSession> {
    const labels = [
      ...thread.repos,
      `status:${thread.status}`,
      `turns:${thread.turn}`,
    ];

    if (thread.resolution_summary) {
      labels.push("has_resolution");
    }

    return this.request<AcontextSession>("POST", "/sessions", {
      space_name: this.config.space_name,
      title: thread.title,
      external_id: thread.id,
      labels,
      metadata: {
        thread_id: thread.id,
        repos: thread.repos,
        created_at: thread.created_at,
        resolved_at: thread.updated_at,
        turn_count: thread.turn,
        resolution_summary: thread.resolution_summary,
      },
      messages: messages.map((m) => ({
        role: m.from === "HUMAN" ? "user" : "assistant",
        content: JSON.stringify(m),
        timestamp: m.timestamp,
        metadata: {
          from: m.from,
          to: m.to,
          type: m.type,
        },
      })),
    });
  }

  /**
   * Update a session
   */
  async updateSession(
    sessionId: string,
    updates: Partial<{
      status: "active" | "completed" | "archived";
      labels: string[];
      metadata: Record<string, unknown>;
    }>
  ): Promise<AcontextSession> {
    return this.request<AcontextSession>("PATCH", `/sessions/${sessionId}`, updates);
  }

  /**
   * Upload an artifact to a session
   */
  async uploadArtifact(
    sessionId: string,
    artifact: {
      type: "screenshot" | "log" | "snippet" | "file";
      name: string;
      content: string;
      content_type?: string;
    }
  ): Promise<AcontextArtifact> {
    return this.request<AcontextArtifact>(
      "POST",
      `/sessions/${sessionId}/artifacts`,
      {
        type: artifact.type,
        name: artifact.name,
        content: artifact.content,
        content_type: artifact.content_type ?? "text/plain",
      }
    );
  }

  /**
   * Search for relevant SOPs based on query
   */
  async experienceSearch(
    query: string,
    options?: {
      limit?: number;
      labels?: string[];
      min_confidence?: number;
    }
  ): Promise<ExperienceSearchResult> {
    return this.request<ExperienceSearchResult>("POST", "/experience/search", {
      space_name: this.config.space_name,
      query,
      limit: options?.limit ?? 5,
      labels: options?.labels,
      min_confidence: options?.min_confidence ?? 0.5,
    });
  }

  /**
   * Trigger learning from a completed session
   */
  async learn(sessionId: string): Promise<{ sops_created: number; sops: SOP[] }> {
    return this.request<{ sops_created: number; sops: SOP[] }>(
      "POST",
      `/sessions/${sessionId}/learn`,
      {}
    );
  }

  /**
   * Get a session by external ID (thread ID)
   */
  async getSessionByThreadId(threadId: string): Promise<AcontextSession | null> {
    try {
      const result = await this.request<{ sessions: AcontextSession[] }>(
        "GET",
        `/sessions?space_name=${encodeURIComponent(this.config.space_name)}&external_id=${encodeURIComponent(threadId)}`
      );
      return result.sessions[0] ?? null;
    } catch (error) {
      if (error instanceof AcontextError && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.request<{ status: string }>("GET", "/health");
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Create an Acontext client from registry config
 */
export function createAcontextClient(
  config: AcontextConfig,
  options?: { retry?: Partial<RetryOptions>; timeout?: number }
): AcontextClient {
  return new AcontextClient(config, options);
}

/**
 * Format SOPs for prompt injection
 */
export function formatSOPsForPrompt(sops: SOP[]): string {
  if (sops.length === 0) {
    return "";
  }

  let output = "=== RUNBOOKS FROM ACONTEXT ===\n\n";

  for (const sop of sops) {
    output += `### ${sop.title}\n`;
    output += `${sop.description}\n\n`;
    output += `**Steps:**\n`;
    for (let i = 0; i < sop.steps.length; i++) {
      output += `${i + 1}. ${sop.steps[i]}\n`;
    }
    output += `\n_Confidence: ${(sop.confidence * 100).toFixed(0)}%_\n\n`;
  }

  return output;
}
