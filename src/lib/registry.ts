import { readFile } from "node:fs/promises";
import { join } from "node:path";
import yaml from "js-yaml";
import { z } from "zod";
import { WORKSPACE_STRUCTURE } from "./workspace.js";

// Schema definitions
const LogsConfigSchema = z.object({
  kind: z.enum(["cloudwatch", "file", "stdout"]),
  group: z.string().optional(),
  region: z.string().optional(),
  path: z.string().optional(),
});

const QuickCommandsSchema = z.record(z.string(), z.string());

const RepoConfigSchema = z.object({
  path: z.string(),
  tech_hints: z.array(z.string()).optional(),
  logs: LogsConfigSchema.optional(),
  quick_commands: QuickCommandsSchema.optional(),
});

const CouncilConfigSchema = z.object({
  parallelism: z.number().int().positive().optional(),
  max_turns: z.number().int().positive().optional(),
  stop_when: z.array(z.string()).optional(),
});

const HumanConfigSchema = z.object({
  allow_interrupt: z.boolean().optional(),
  default_mode: z.enum(["live", "batch"]).optional(),
});

const AcontextConfigSchema = z.object({
  base_url: z.string().url(),
  api_key: z.string(),
  space_name: z.string(),
});

const CogneeConfigSchema = z.object({
  enabled: z.boolean().optional(),
  local: z.boolean().optional(),
});

const MemoryConfigSchema = z.object({
  enabled: z.boolean().optional(),
  acontext: AcontextConfigSchema.optional(),
  cognee: CogneeConfigSchema.optional(),
});

export const RegistrySchema = z.object({
  repos: z.record(z.string(), RepoConfigSchema).optional(),
  council: CouncilConfigSchema.optional(),
  human: HumanConfigSchema.optional(),
  memory: MemoryConfigSchema.optional(),
});

// Type exports
export type LogsConfig = z.infer<typeof LogsConfigSchema>;
export type RepoConfig = z.infer<typeof RepoConfigSchema>;
export type CouncilConfig = z.infer<typeof CouncilConfigSchema>;
export type HumanConfig = z.infer<typeof HumanConfigSchema>;
export type MemoryConfig = z.infer<typeof MemoryConfigSchema>;
export type Registry = z.infer<typeof RegistrySchema>;

// Defaults
const DEFAULT_COUNCIL_CONFIG: Required<CouncilConfig> = {
  parallelism: 3,
  max_turns: 14,
  stop_when: ["resolution_confirmed", "action_plan_ready", "blocked_missing_evidence"],
};

// Error class
export class RegistryError extends Error {
  constructor(message: string, public readonly details?: unknown) {
    super(message);
    this.name = "RegistryError";
  }
}

// Normalized registry with defaults applied
export interface NormalizedRegistry {
  repos: Record<string, RepoConfig>;
  council: Required<CouncilConfig>;
  human: HumanConfig;
  memory: MemoryConfig;
}

// Parse and validate registry
export async function loadRegistry(basePath: string = process.cwd()): Promise<NormalizedRegistry> {
  const registryPath = join(basePath, WORKSPACE_STRUCTURE.registry);

  let content: string;
  try {
    content = await readFile(registryPath, "utf-8");
  } catch (error) {
    throw new RegistryError(
      `Cannot read registry at ${registryPath}. Did you run 'council init'?`,
      error
    );
  }

  let parsed: unknown;
  try {
    parsed = yaml.load(content);
  } catch (error) {
    throw new RegistryError("Invalid YAML in registry.yaml", error);
  }

  const result = RegistrySchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new RegistryError(`Invalid registry configuration:\n${issues}`);
  }

  // Apply defaults
  const data = result.data;
  return {
    repos: data.repos ?? {},
    council: {
      parallelism: data.council?.parallelism ?? DEFAULT_COUNCIL_CONFIG.parallelism,
      max_turns: data.council?.max_turns ?? DEFAULT_COUNCIL_CONFIG.max_turns,
      stop_when: data.council?.stop_when ?? DEFAULT_COUNCIL_CONFIG.stop_when,
    },
    human: data.human ?? { allow_interrupt: true, default_mode: "live" },
    memory: data.memory ?? { enabled: false },
  };
}

// Get a specific repo config
export function getRepoConfig(registry: NormalizedRegistry, repoName: string): RepoConfig {
  const repo = registry.repos[repoName];
  if (!repo) {
    const available = Object.keys(registry.repos);
    throw new RegistryError(
      `Repo "${repoName}" not found in registry. Available: ${available.join(", ") || "(none)"}`
    );
  }
  return repo;
}

// Validate repo names exist
export function validateRepos(registry: NormalizedRegistry, repoNames: string[]): void {
  const missing = repoNames.filter((name) => !registry.repos[name]);
  if (missing.length > 0) {
    const available = Object.keys(registry.repos);
    throw new RegistryError(
      `Repos not found: ${missing.join(", ")}. Available: ${available.join(", ") || "(none)"}`
    );
  }
}
