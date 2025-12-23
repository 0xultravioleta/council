/**
 * Cognee Semantic Memory Client
 *
 * Cognee is the semantic memory system that stores:
 * - Facts: Stable knowledge about repos, endpoints, contracts
 * - Edges: Relationships between entities
 *
 * Key principle: Only write at checkpoints (decisions, resolutions)
 */

import { createHash } from "node:crypto";
import type { Message } from "./message.js";
import type { ThreadState } from "./thread.js";

// ============================================================================
// Schema Definitions
// ============================================================================

export interface Fact {
  /** Deterministic ID: hash(repo + type + key) */
  fact_id: string;
  /** Source repository */
  repo: string;
  /** Fact type category */
  type: FactType;
  /** The key/subject of the fact */
  key: string;
  /** The value/predicate */
  value: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Evidence that supports this fact */
  evidence: string[];
  /** Source thread IDs */
  source_threads: string[];
  /** Created timestamp */
  created_at: string;
  /** Last updated timestamp */
  updated_at: string;
  /** Optional TTL for soft facts */
  expires_at?: string;
  /** Revision number for updates */
  rev: number;
}

export type FactType =
  | "endpoint"       // API endpoint definition
  | "header"         // Required header
  | "field"          // Request/response field
  | "invariant"      // Always-true constraint
  | "contract"       // Cross-repo contract
  | "error_pattern"  // Known error pattern
  | "dependency"     // Repo dependency
  | "config"         // Configuration value
  | "behavior";      // Expected behavior

export interface Edge {
  /** Deterministic ID: hash(from + relation + to) */
  edge_id: string;
  /** Source entity (repo:type:key) */
  from: string;
  /** Target entity (repo:type:key) */
  to: string;
  /** Relationship type */
  relation: EdgeRelation;
  /** Confidence score */
  confidence: number;
  /** Source threads */
  source_threads: string[];
  /** Created timestamp */
  created_at: string;
}

export type EdgeRelation =
  | "calls"          // A calls B
  | "depends_on"     // A depends on B
  | "validates"      // A validates B
  | "generates"      // A generates B
  | "consumes"       // A consumes B
  | "requires"       // A requires B
  | "conflicts_with" // A conflicts with B
  | "replaces";      // A replaces B

// ============================================================================
// ID Generation (Deterministic)
// ============================================================================

/**
 * Generate deterministic fact ID
 */
export function generateFactId(repo: string, type: FactType, key: string): string {
  const input = `${repo}:${type}:${key}`;
  return `fact_${createHash("sha256").update(input).digest("hex").slice(0, 16)}`;
}

/**
 * Generate deterministic edge ID
 */
export function generateEdgeId(from: string, relation: EdgeRelation, to: string): string {
  const input = `${from}:${relation}:${to}`;
  return `edge_${createHash("sha256").update(input).digest("hex").slice(0, 16)}`;
}

// ============================================================================
// Fact Distiller
// ============================================================================

export interface DistilledFacts {
  facts: Fact[];
  edges: Edge[];
}

/**
 * Extract facts from a resolution message
 */
export function distillFromResolution(
  thread: ThreadState,
  resolutionMessage: Message
): DistilledFacts {
  const facts: Fact[] = [];
  const edges: Edge[] = [];
  const now = new Date().toISOString();

  // Extract from resolution summary
  if (thread.resolution_summary) {
    // Look for patterns like "X was causing Y"
    const patterns = extractPatterns(thread.resolution_summary);

    for (const pattern of patterns) {
      if (pattern.type === "error_pattern") {
        facts.push({
          fact_id: generateFactId(pattern.repo || thread.repos[0], "error_pattern", pattern.key),
          repo: pattern.repo || thread.repos[0],
          type: "error_pattern",
          key: pattern.key,
          value: pattern.value,
          confidence: 0.8,
          evidence: [thread.resolution_summary],
          source_threads: [thread.id],
          created_at: now,
          updated_at: now,
          rev: 1,
        });
      }
    }
  }

  // Extract from message summary and notes
  const content = [resolutionMessage.summary, ...(resolutionMessage.notes || [])].join(" ");
  if (content) {

    // Look for endpoint mentions
    const endpointMatches = content.match(/(?:endpoint|route|api)\s+[`"]?([A-Z]+)?\s*([\/\w\-{}:]+)[`"]?/gi);
    if (endpointMatches) {
      for (const match of endpointMatches) {
        const parts = match.match(/([A-Z]+)?\s*([\/\w\-{}:]+)/i);
        if (parts && parts[2]) {
          facts.push({
            fact_id: generateFactId(resolutionMessage.from, "endpoint", parts[2]),
            repo: resolutionMessage.from,
            type: "endpoint",
            key: parts[2],
            value: parts[1] || "GET",
            confidence: 0.7,
            evidence: [match],
            source_threads: [thread.id],
            created_at: now,
            updated_at: now,
            rev: 1,
          });
        }
      }
    }

    // Look for header mentions
    const headerMatches = content.match(/header\s+[`"]?([a-z\-]+)[`"]?\s*(?:=|:|\sis\s)\s*[`"]?([^`"\n]+)[`"]?/gi);
    if (headerMatches) {
      for (const match of headerMatches) {
        const parts = match.match(/([a-z\-]+)\s*(?:=|:|\sis\s)\s*([^`"\n]+)/i);
        if (parts) {
          facts.push({
            fact_id: generateFactId(resolutionMessage.from, "header", parts[1]),
            repo: resolutionMessage.from,
            type: "header",
            key: parts[1],
            value: parts[2].trim(),
            confidence: 0.75,
            evidence: [match],
            source_threads: [thread.id],
            created_at: now,
            updated_at: now,
            rev: 1,
          });
        }
      }
    }
  }

  // Create cross-repo edges from thread context
  if (thread.repos.length > 1 && thread.suspects.length > 0) {
    for (const suspect of thread.suspects) {
      if (thread.repos.includes(suspect)) {
        const from = `${thread.repos[0]}:behavior:main`;
        const to = `${suspect}:behavior:issue`;
        edges.push({
          edge_id: generateEdgeId(from, "depends_on", to),
          from,
          to,
          relation: "depends_on",
          confidence: 0.6,
          source_threads: [thread.id],
          created_at: now,
        });
      }
    }
  }

  return { facts, edges };
}

interface Pattern {
  type: FactType;
  repo?: string;
  key: string;
  value: string;
}

function extractPatterns(text: string): Pattern[] {
  const patterns: Pattern[] = [];

  // Pattern: "X encoding was wrong" or "encoding issue"
  const encodingMatch = text.match(/(\w+)\s+encoding\s+(?:was\s+)?(\w+)/i);
  if (encodingMatch) {
    patterns.push({
      type: "error_pattern",
      key: `${encodingMatch[1]}_encoding`,
      value: encodingMatch[2],
    });
  }

  // Pattern: "nonce mismatch" or "signature invalid"
  const mismatchMatch = text.match(/(\w+)\s+(?:mismatch|invalid|error|failure)/i);
  if (mismatchMatch) {
    patterns.push({
      type: "error_pattern",
      key: mismatchMatch[1].toLowerCase(),
      value: "validation_failure",
    });
  }

  return patterns;
}

// ============================================================================
// Cognee Client
// ============================================================================

export interface CogneeConfig {
  enabled: boolean;
  local?: boolean;
  endpoint?: string;
}

export class CogneeClient {
  private config: CogneeConfig;
  private facts: Map<string, Fact> = new Map();
  private edges: Map<string, Edge> = new Map();

  constructor(config: CogneeConfig) {
    this.config = config;
  }

  /**
   * Add or update a fact (handles deduplication via fact_id)
   */
  async addFact(fact: Fact): Promise<Fact> {
    const existing = this.facts.get(fact.fact_id);

    if (existing) {
      // Update existing fact
      const updated: Fact = {
        ...existing,
        value: fact.value,
        confidence: Math.max(existing.confidence, fact.confidence),
        evidence: [...new Set([...existing.evidence, ...fact.evidence])],
        source_threads: [...new Set([...existing.source_threads, ...fact.source_threads])],
        updated_at: new Date().toISOString(),
        rev: existing.rev + 1,
      };
      this.facts.set(fact.fact_id, updated);
      return updated;
    }

    this.facts.set(fact.fact_id, fact);
    return fact;
  }

  /**
   * Add an edge (handles deduplication via edge_id)
   */
  async addEdge(edge: Edge): Promise<Edge> {
    const existing = this.edges.get(edge.edge_id);

    if (existing) {
      // Update confidence
      const updated: Edge = {
        ...existing,
        confidence: Math.max(existing.confidence, edge.confidence),
        source_threads: [...new Set([...existing.source_threads, ...edge.source_threads])],
      };
      this.edges.set(edge.edge_id, updated);
      return updated;
    }

    this.edges.set(edge.edge_id, edge);
    return edge;
  }

  /**
   * Search for facts
   */
  async search(
    query: string,
    options?: {
      repos?: string[];
      types?: FactType[];
      limit?: number;
      min_confidence?: number;
    }
  ): Promise<Fact[]> {
    const limit = options?.limit ?? 10;
    const minConfidence = options?.min_confidence ?? 0.5;
    const queryLower = query.toLowerCase();

    let results = Array.from(this.facts.values());

    // Filter by repo
    if (options?.repos?.length) {
      results = results.filter((f) => options.repos!.includes(f.repo));
    }

    // Filter by type
    if (options?.types?.length) {
      results = results.filter((f) => options.types!.includes(f.type));
    }

    // Filter by confidence
    results = results.filter((f) => f.confidence >= minConfidence);

    // Simple relevance scoring based on query match
    const scored = results.map((fact) => {
      let score = 0;
      if (fact.key.toLowerCase().includes(queryLower)) score += 2;
      if (fact.value.toLowerCase().includes(queryLower)) score += 1;
      for (const ev of fact.evidence) {
        if (ev.toLowerCase().includes(queryLower)) score += 0.5;
      }
      return { fact, score };
    });

    // Filter out non-matching facts when query is provided
    const filtered = queryLower ? scored.filter((s) => s.score > 0) : scored;

    // Sort by score and confidence
    filtered.sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      return b.fact.confidence - a.fact.confidence;
    });

    return filtered.slice(0, limit).map((s) => s.fact);
  }

  /**
   * Get edges for an entity
   */
  async getEdges(entity: string): Promise<Edge[]> {
    return Array.from(this.edges.values()).filter(
      (e) => e.from === entity || e.to === entity
    );
  }

  /**
   * Get all facts for a repo
   */
  async getFactsForRepo(repo: string): Promise<Fact[]> {
    return Array.from(this.facts.values()).filter((f) => f.repo === repo);
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    return this.config.enabled;
  }

  /**
   * Get stats
   */
  getStats(): { facts: number; edges: number } {
    return {
      facts: this.facts.size,
      edges: this.edges.size,
    };
  }
}

/**
 * Format facts for prompt injection
 */
export function formatFactsForPrompt(facts: Fact[]): string {
  if (facts.length === 0) {
    return "";
  }

  let output = "=== FACTS FROM COGNEE ===\n\n";

  // Group by repo
  const byRepo = new Map<string, Fact[]>();
  for (const fact of facts) {
    const existing = byRepo.get(fact.repo) || [];
    existing.push(fact);
    byRepo.set(fact.repo, existing);
  }

  for (const [repo, repoFacts] of byRepo) {
    output += `**${repo}:**\n`;
    for (const fact of repoFacts) {
      output += `- [${fact.type}] ${fact.key}: ${fact.value}`;
      if (fact.confidence < 0.8) {
        output += ` _(${Math.round(fact.confidence * 100)}% confidence)_`;
      }
      output += "\n";
    }
    output += "\n";
  }

  return output;
}

// Singleton for local storage
let cogneeInstance: CogneeClient | null = null;

export function getCogneeClient(config?: CogneeConfig): CogneeClient {
  if (!cogneeInstance && config) {
    cogneeInstance = new CogneeClient(config);
  }
  return cogneeInstance!;
}

export function resetCogneeClient(): void {
  cogneeInstance = null;
}
