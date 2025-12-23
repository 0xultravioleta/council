import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "node:fs/promises";
import type { ScanResult } from "../lib/scanner.js";

// Mock fs/promises
vi.mock("node:fs/promises", () => ({
  readdir: vi.fn(),
  readFile: vi.fn(),
  stat: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

describe("scanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("scanRepo", () => {
    it("should scan a repository and return results", async () => {
      // Mock directory structure
      vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => false, isFile: () => true } as any);

      vi.mocked(fs.readdir).mockImplementation(async (path: any) => {
        if (path.endsWith("test-repo")) {
          return [
            { name: "package.json", isDirectory: () => false, isFile: () => true },
            { name: "src", isDirectory: () => true, isFile: () => false },
          ] as any;
        }
        if (path.endsWith("src")) {
          return [
            { name: "index.ts", isDirectory: () => false, isFile: () => true },
          ] as any;
        }
        return [];
      });

      vi.mocked(fs.readFile).mockImplementation(async (path: any) => {
        if (path.toString().endsWith("package.json")) {
          return JSON.stringify({
            dependencies: { express: "^4.0.0" },
            devDependencies: { typescript: "^5.0.0" },
          });
        }
        if (path.toString().endsWith("index.ts")) {
          return `
            import express from "express";
            const app = express();
            app.get("/api/users", (req, res) => {});
            app.post("/api/users", (req, res) => {});
            export function getUsers() {}
          `;
        }
        return "";
      });

      const { scanRepo } = await import("../lib/scanner.js");
      const result = await scanRepo("/test-repo", "test");

      expect(result.repo).toBe("test");
      expect(result.dependencies.length).toBeGreaterThan(0);
      expect(result.dependencies.some((d) => d.name === "express")).toBe(true);
    });

    it("should detect endpoints in TypeScript files", async () => {
      vi.mocked(fs.stat).mockRejectedValue(new Error("not found"));
      vi.mocked(fs.readdir).mockResolvedValue([
        { name: "routes.ts", isDirectory: () => false, isFile: () => true },
      ] as any);

      vi.mocked(fs.readFile).mockResolvedValue(`
        router.get("/api/items", handler);
        router.post("/api/items", handler);
        app.delete("/api/items/:id", handler);
      `);

      const { scanRepo } = await import("../lib/scanner.js");
      const result = await scanRepo("/test", "test");

      expect(result.endpoints.length).toBe(3);
      expect(result.endpoints.some((e) => e.path === "/api/items")).toBe(true);
    });

    it("should detect boundaries", async () => {
      vi.mocked(fs.stat).mockRejectedValue(new Error("not found"));
      vi.mocked(fs.readdir).mockResolvedValue([
        { name: "service.ts", isDirectory: () => false, isFile: () => true },
      ] as any);

      vi.mocked(fs.readFile).mockResolvedValue(`
        const db = await prisma.user.findMany();
        await fetch("https://api.example.com");
        const value = process.env.API_KEY;
      `);

      const { scanRepo } = await import("../lib/scanner.js");
      const result = await scanRepo("/test", "test");

      expect(result.boundaries.length).toBeGreaterThan(0);
      expect(result.boundaries.some((b) => b.type === "database")).toBe(true);
      expect(result.boundaries.some((b) => b.type === "api")).toBe(true);
      expect(result.boundaries.some((b) => b.type === "config")).toBe(true);
    });
  });

  describe("analyzeSynergy", () => {
    it("should find shared dependencies", async () => {
      const { analyzeSynergy } = await import("../lib/scanner.js");

      const results: ScanResult[] = [
        {
          repo: "repo-a",
          path: "/a",
          endpoints: [],
          dependencies: [
            { name: "express", version: "4.0.0", type: "runtime", source: "package.json" },
            { name: "lodash", version: "4.17.0", type: "runtime", source: "package.json" },
          ],
          exports: [],
          imports: [],
          configFiles: [],
          boundaries: [],
        },
        {
          repo: "repo-b",
          path: "/b",
          endpoints: [],
          dependencies: [
            { name: "express", version: "4.1.0", type: "runtime", source: "package.json" },
            { name: "axios", version: "1.0.0", type: "runtime", source: "package.json" },
          ],
          exports: [],
          imports: [],
          configFiles: [],
          boundaries: [],
        },
      ];

      const analysis = analyzeSynergy(results);

      expect(analysis.sharedDependencies.length).toBe(1);
      expect(analysis.sharedDependencies[0].name).toBe("express");
      expect(analysis.sharedDependencies[0].repos).toContain("repo-a");
      expect(analysis.sharedDependencies[0].repos).toContain("repo-b");
    });

    it("should find endpoint overlaps", async () => {
      const { analyzeSynergy } = await import("../lib/scanner.js");

      const results: ScanResult[] = [
        {
          repo: "repo-a",
          path: "/a",
          endpoints: [{ method: "GET", path: "/api/users", file: "a.ts", line: 1 }],
          dependencies: [],
          exports: [],
          imports: [],
          configFiles: [],
          boundaries: [],
        },
        {
          repo: "repo-b",
          path: "/b",
          endpoints: [{ method: "POST", path: "/api/users", file: "b.ts", line: 1 }],
          dependencies: [],
          exports: [],
          imports: [],
          configFiles: [],
          boundaries: [],
        },
      ];

      const analysis = analyzeSynergy(results);

      expect(analysis.endpointOverlap.length).toBe(1);
      expect(analysis.endpointOverlap[0].path).toBe("/api/users");
    });

    it("should find potential integrations", async () => {
      const { analyzeSynergy } = await import("../lib/scanner.js");

      const results: ScanResult[] = [
        {
          repo: "repo-a",
          path: "/a",
          endpoints: [],
          dependencies: [],
          exports: [],
          imports: [],
          configFiles: [],
          boundaries: [{ type: "database", description: "DB", file: "a.ts" }],
        },
        {
          repo: "repo-b",
          path: "/b",
          endpoints: [],
          dependencies: [],
          exports: [],
          imports: [],
          configFiles: [],
          boundaries: [{ type: "database", description: "DB", file: "b.ts" }],
        },
      ];

      const analysis = analyzeSynergy(results);

      expect(analysis.potentialIntegrations.length).toBe(1);
      expect(analysis.potentialIntegrations[0].type).toBe("database");
    });
  });
});
