/**
 * Dual Memory Manager
 *
 * Manages both Acontext (operational memory) and Cognee (semantic memory).
 * Handles graceful degradation when memory systems are unavailable.
 */

import {
  AcontextClient,
  createAcontextClient,
  formatSOPsForPrompt,
  type AcontextConfig,
  type AcontextSession,
  type SOP,
  type ExperienceSearchResult,
  AcontextError,
} from "./acontext.js";
import type { ThreadState } from "./thread.js";
import type { Message } from "./message.js";
import type { NormalizedRegistry } from "./registry.js";

export interface MemoryConfig {
  enabled: boolean;
  acontext?: AcontextConfig;
  cognee?: {
    enabled?: boolean;
    local?: boolean;
  };
}

export interface MemoryContext {
  sops: SOP[];
  facts: string[];
  sopPrompt: string;
  factPrompt: string;
}

export interface MemoryStatus {
  enabled: boolean;
  acontext: {
    available: boolean;
    lastError?: string;
  };
  cognee: {
    available: boolean;
    lastError?: string;
  };
}

export class MemoryManager {
  private acontext: AcontextClient | null = null;
  private config: MemoryConfig;
  private status: MemoryStatus;

  constructor(config: MemoryConfig) {
    this.config = config;
    this.status = {
      enabled: config.enabled,
      acontext: { available: false },
      cognee: { available: false },
    };

    if (config.enabled && config.acontext) {
      this.acontext = createAcontextClient(config.acontext);
    }
  }

  /**
   * Initialize and check availability of memory systems
   */
  async initialize(): Promise<MemoryStatus> {
    if (!this.config.enabled) {
      return this.status;
    }

    // Check Acontext
    if (this.acontext) {
      try {
        const healthy = await this.acontext.healthCheck();
        this.status.acontext.available = healthy;
        if (!healthy) {
          this.status.acontext.lastError = "Health check failed";
        }
      } catch (error) {
        this.status.acontext.available = false;
        this.status.acontext.lastError = (error as Error).message;
      }
    }

    // Cognee check would go here (M4)
    // For now, mark as unavailable
    this.status.cognee.available = false;

    return this.status;
  }

  /**
   * Get memory context for a new thread (SOPs and facts)
   */
  async getContextForThread(
    threadTitle: string,
    repos: string[]
  ): Promise<MemoryContext> {
    const context: MemoryContext = {
      sops: [],
      facts: [],
      sopPrompt: "",
      factPrompt: "",
    };

    if (!this.config.enabled) {
      return context;
    }

    // Fetch SOPs from Acontext
    if (this.acontext && this.status.acontext.available) {
      try {
        const query = `${threadTitle} ${repos.join(" ")}`;
        const result = await this.acontext.experienceSearch(query, {
          limit: 5,
          labels: repos,
        });
        context.sops = result.sops;
        context.sopPrompt = formatSOPsForPrompt(result.sops);
      } catch (error) {
        this.logWarning("Acontext search failed", error);
        this.status.acontext.lastError = (error as Error).message;
      }
    }

    // Fetch facts from Cognee would go here (M4)

    return context;
  }

  /**
   * Save a completed thread to memory
   */
  async saveThread(
    thread: ThreadState,
    messages: Message[]
  ): Promise<{ session?: AcontextSession; learned?: number }> {
    const result: { session?: AcontextSession; learned?: number } = {};

    if (!this.config.enabled) {
      return result;
    }

    // Save to Acontext
    if (this.acontext && this.status.acontext.available) {
      try {
        // Check if session already exists
        let session = await this.acontext.getSessionByThreadId(thread.id);

        if (session) {
          // Update existing session
          session = await this.acontext.updateSession(session.id, {
            status: thread.status === "resolved" ? "completed" : "active",
            labels: [
              ...thread.repos,
              `status:${thread.status}`,
              `turns:${thread.turn}`,
            ],
          });
        } else {
          // Create new session
          session = await this.acontext.createSession(thread, messages);
        }

        result.session = session;

        // Trigger learning if thread is resolved
        if (thread.status === "resolved" && session) {
          try {
            const learnResult = await this.acontext.learn(session.id);
            result.learned = learnResult.sops_created;
          } catch (error) {
            this.logWarning("Acontext learn failed", error);
          }
        }
      } catch (error) {
        this.logWarning("Acontext save failed", error);
        this.status.acontext.lastError = (error as Error).message;
      }
    }

    return result;
  }

  /**
   * Upload an artifact to the current session
   */
  async uploadArtifact(
    threadId: string,
    artifact: {
      type: "screenshot" | "log" | "snippet" | "file";
      name: string;
      content: string;
      content_type?: string;
    }
  ): Promise<boolean> {
    if (!this.acontext || !this.status.acontext.available) {
      return false;
    }

    try {
      const session = await this.acontext.getSessionByThreadId(threadId);
      if (session) {
        await this.acontext.uploadArtifact(session.id, artifact);
        return true;
      }
    } catch (error) {
      this.logWarning("Artifact upload failed", error);
    }

    return false;
  }

  /**
   * Get current status
   */
  getStatus(): MemoryStatus {
    return { ...this.status };
  }

  /**
   * Check if any memory system is available
   */
  isAvailable(): boolean {
    return (
      this.config.enabled &&
      (this.status.acontext.available || this.status.cognee.available)
    );
  }

  /**
   * Log a warning without throwing
   */
  private logWarning(message: string, error: unknown): void {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.warn(`[Memory] ${message}: ${errorMsg}`);
  }
}

/**
 * Create a memory manager from registry config
 */
export function createMemoryManager(registry: NormalizedRegistry): MemoryManager {
  return new MemoryManager({
    enabled: registry.memory.enabled ?? false,
    acontext: registry.memory.acontext,
    cognee: registry.memory.cognee,
  });
}

/**
 * Singleton memory manager instance
 */
let memoryInstance: MemoryManager | null = null;

export function getMemoryManager(registry?: NormalizedRegistry): MemoryManager | null {
  if (!memoryInstance && registry) {
    memoryInstance = createMemoryManager(registry);
  }
  return memoryInstance;
}

export function resetMemoryManager(): void {
  memoryInstance = null;
}
