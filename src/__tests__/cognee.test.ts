import { describe, it, expect, beforeEach } from "vitest";
import {
  generateFactId,
  generateEdgeId,
  distillFromResolution,
  CogneeClient,
  formatFactsForPrompt,
  type Fact,
  type Edge,
} from "../lib/cognee.js";
import type { ThreadState } from "../lib/thread.js";
import type { Message } from "../lib/message.js";

describe("ID Generation", () => {
  describe("generateFactId", () => {
    it("should generate deterministic IDs", () => {
      const id1 = generateFactId("repo-a", "endpoint", "/api/pay");
      const id2 = generateFactId("repo-a", "endpoint", "/api/pay");
      expect(id1).toBe(id2);
    });

    it("should generate different IDs for different inputs", () => {
      const id1 = generateFactId("repo-a", "endpoint", "/api/pay");
      const id2 = generateFactId("repo-b", "endpoint", "/api/pay");
      expect(id1).not.toBe(id2);
    });

    it("should have correct format", () => {
      const id = generateFactId("repo-a", "endpoint", "/api/pay");
      expect(id).toMatch(/^fact_[a-f0-9]{16}$/);
    });
  });

  describe("generateEdgeId", () => {
    it("should generate deterministic IDs", () => {
      const id1 = generateEdgeId("a:behavior:main", "calls", "b:endpoint:/pay");
      const id2 = generateEdgeId("a:behavior:main", "calls", "b:endpoint:/pay");
      expect(id1).toBe(id2);
    });

    it("should have correct format", () => {
      const id = generateEdgeId("a:behavior:main", "calls", "b:endpoint:/pay");
      expect(id).toMatch(/^edge_[a-f0-9]{16}$/);
    });
  });
});

describe("distillFromResolution", () => {
  const mockThread: ThreadState = {
    id: "th_test",
    title: "Payment failure",
    repos: ["402milly", "Facilitador"],
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    turn: 5,
    status: "resolved",
    pending_for: [],
    suspects: ["Facilitador"],
    resolution_summary: "nonce encoding was hex instead of base64",
  };

  const mockResolutionMessage: Message = {
    message_id: "msg-1",
    thread_id: "th_test",
    from: "Facilitador",
    to: "ALL",
    type: "resolution",
    summary: "Fixed nonce encoding - endpoint /api/pay was using header x-nonce wrong",
    timestamp: "2025-01-01T00:00:00Z",
  };

  it("should extract error patterns from resolution summary", () => {
    const { facts } = distillFromResolution(mockThread, mockResolutionMessage);

    const encodingFact = facts.find((f) => f.key.includes("encoding"));
    expect(encodingFact).toBeDefined();
    expect(encodingFact?.type).toBe("error_pattern");
  });

  it("should extract endpoints from message content", () => {
    const { facts } = distillFromResolution(mockThread, mockResolutionMessage);

    const endpointFact = facts.find((f) => f.type === "endpoint");
    expect(endpointFact).toBeDefined();
    expect(endpointFact?.key).toBe("/api/pay");
  });

  it("should create edges for suspects", () => {
    const { edges } = distillFromResolution(mockThread, mockResolutionMessage);

    expect(edges.length).toBeGreaterThan(0);
    expect(edges[0].relation).toBe("depends_on");
  });
});

describe("CogneeClient", () => {
  let client: CogneeClient;

  beforeEach(() => {
    client = new CogneeClient({ enabled: true, local: true });
  });

  const mockFact: Fact = {
    fact_id: "fact_test123",
    repo: "repo-a",
    type: "endpoint",
    key: "/api/pay",
    value: "POST",
    confidence: 0.9,
    evidence: ["Found in code"],
    source_threads: ["th_1"],
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    rev: 1,
  };

  describe("addFact", () => {
    it("should add a new fact", async () => {
      const result = await client.addFact(mockFact);
      expect(result.fact_id).toBe("fact_test123");
    });

    it("should update existing fact", async () => {
      await client.addFact(mockFact);

      const updated = await client.addFact({
        ...mockFact,
        value: "PUT",
        confidence: 0.95,
      });

      expect(updated.value).toBe("PUT");
      expect(updated.confidence).toBe(0.95);
      expect(updated.rev).toBe(2);
    });

    it("should merge evidence arrays", async () => {
      await client.addFact(mockFact);

      const updated = await client.addFact({
        ...mockFact,
        evidence: ["New evidence"],
      });

      expect(updated.evidence).toContain("Found in code");
      expect(updated.evidence).toContain("New evidence");
    });
  });

  describe("addEdge", () => {
    it("should add a new edge", async () => {
      const edge: Edge = {
        edge_id: "edge_test123",
        from: "a:endpoint:/pay",
        to: "b:endpoint:/validate",
        relation: "calls",
        confidence: 0.8,
        source_threads: ["th_1"],
        created_at: "2025-01-01T00:00:00Z",
      };

      const result = await client.addEdge(edge);
      expect(result.edge_id).toBe("edge_test123");
    });
  });

  describe("search", () => {
    it("should find facts by query", async () => {
      await client.addFact(mockFact);
      await client.addFact({
        ...mockFact,
        fact_id: "fact_other",
        key: "/api/users",
      });

      const results = await client.search("pay");
      expect(results.length).toBe(1);
      expect(results[0].key).toBe("/api/pay");
    });

    it("should filter by repo", async () => {
      await client.addFact(mockFact);
      await client.addFact({
        ...mockFact,
        fact_id: "fact_other",
        repo: "repo-b",
      });

      const results = await client.search("api", { repos: ["repo-a"] });
      expect(results.length).toBe(1);
      expect(results[0].repo).toBe("repo-a");
    });

    it("should filter by type", async () => {
      await client.addFact(mockFact);
      await client.addFact({
        ...mockFact,
        fact_id: "fact_header",
        type: "header",
        key: "x-auth",
      });

      const results = await client.search("", { types: ["header"] });
      expect(results.length).toBe(1);
      expect(results[0].type).toBe("header");
    });

    it("should filter by confidence", async () => {
      await client.addFact(mockFact);
      await client.addFact({
        ...mockFact,
        fact_id: "fact_low",
        confidence: 0.3,
      });

      const results = await client.search("", { min_confidence: 0.5 });
      expect(results.length).toBe(1);
      expect(results[0].confidence).toBeGreaterThanOrEqual(0.5);
    });
  });

  describe("getEdges", () => {
    it("should return edges for an entity", async () => {
      const edge: Edge = {
        edge_id: "edge_test",
        from: "a:endpoint:/pay",
        to: "b:endpoint:/validate",
        relation: "calls",
        confidence: 0.8,
        source_threads: ["th_1"],
        created_at: "2025-01-01T00:00:00Z",
      };

      await client.addEdge(edge);

      const results = await client.getEdges("a:endpoint:/pay");
      expect(results.length).toBe(1);
    });
  });

  describe("getStats", () => {
    it("should return correct counts", async () => {
      await client.addFact(mockFact);
      await client.addEdge({
        edge_id: "edge_test",
        from: "a",
        to: "b",
        relation: "calls",
        confidence: 0.8,
        source_threads: [],
        created_at: "2025-01-01T00:00:00Z",
      });

      const stats = client.getStats();
      expect(stats.facts).toBe(1);
      expect(stats.edges).toBe(1);
    });
  });

  describe("healthCheck", () => {
    it("should return true when enabled", async () => {
      const result = await client.healthCheck();
      expect(result).toBe(true);
    });

    it("should return false when disabled", async () => {
      const disabledClient = new CogneeClient({ enabled: false });
      const result = await disabledClient.healthCheck();
      expect(result).toBe(false);
    });
  });
});

describe("formatFactsForPrompt", () => {
  it("should return empty string for no facts", () => {
    const result = formatFactsForPrompt([]);
    expect(result).toBe("");
  });

  it("should format facts grouped by repo", () => {
    const facts: Fact[] = [
      {
        fact_id: "fact_1",
        repo: "repo-a",
        type: "endpoint",
        key: "/api/pay",
        value: "POST",
        confidence: 0.9,
        evidence: [],
        source_threads: [],
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
        rev: 1,
      },
    ];

    const result = formatFactsForPrompt(facts);
    expect(result).toContain("=== FACTS FROM COGNEE ===");
    expect(result).toContain("repo-a");
    expect(result).toContain("[endpoint]");
    expect(result).toContain("/api/pay");
  });

  it("should show confidence for low confidence facts", () => {
    const facts: Fact[] = [
      {
        fact_id: "fact_1",
        repo: "repo-a",
        type: "endpoint",
        key: "/api/pay",
        value: "POST",
        confidence: 0.6,
        evidence: [],
        source_threads: [],
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
        rev: 1,
      },
    ];

    const result = formatFactsForPrompt(facts);
    expect(result).toContain("60% confidence");
  });
});
