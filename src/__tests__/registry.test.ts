import { describe, it, expect } from "vitest";
import { RegistrySchema } from "../lib/registry.js";

describe("RegistrySchema", () => {
  it("should parse empty registry", () => {
    const result = RegistrySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("should parse registry with repos", () => {
    const input = {
      repos: {
        "my-app": {
          path: "../my-app",
          tech_hints: ["typescript", "web"],
          quick_commands: {
            dev: "pnpm dev",
            test: "pnpm test",
          },
        },
      },
      council: {
        parallelism: 2,
        max_turns: 10,
      },
    };

    const result = RegistrySchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.repos?.["my-app"]?.path).toBe("../my-app");
      expect(result.data.council?.parallelism).toBe(2);
    }
  });

  it("should reject invalid repo config", () => {
    const input = {
      repos: {
        "bad-repo": {
          // missing required 'path'
          tech_hints: ["typescript"],
        },
      },
    };

    const result = RegistrySchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("should accept logs config", () => {
    const input = {
      repos: {
        server: {
          path: "../server",
          logs: {
            kind: "cloudwatch",
            group: "/ecs/my-service",
            region: "us-east-1",
          },
        },
      },
    };

    const result = RegistrySchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.repos?.["server"]?.logs?.kind).toBe("cloudwatch");
    }
  });

  it("should reject invalid logs kind", () => {
    const input = {
      repos: {
        server: {
          path: "../server",
          logs: {
            kind: "invalid-kind",
          },
        },
      },
    };

    const result = RegistrySchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});
