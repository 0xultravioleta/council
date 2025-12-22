import { mkdir, writeFile, access } from "node:fs/promises";
import { join } from "node:path";

export const COUNCIL_DIR = ".council";

export const WORKSPACE_STRUCTURE = {
  root: COUNCIL_DIR,
  threads: join(COUNCIL_DIR, "threads"),
  scans: join(COUNCIL_DIR, "scans"),
  runs: join(COUNCIL_DIR, "runs"),
  registry: join(COUNCIL_DIR, "registry.yaml"),
} as const;

export async function workspaceExists(basePath: string = process.cwd()): Promise<boolean> {
  try {
    await access(join(basePath, COUNCIL_DIR));
    return true;
  } catch {
    return false;
  }
}

export async function createWorkspace(basePath: string = process.cwd()): Promise<void> {
  const dirs = [
    WORKSPACE_STRUCTURE.root,
    WORKSPACE_STRUCTURE.threads,
    WORKSPACE_STRUCTURE.scans,
    WORKSPACE_STRUCTURE.runs,
  ];

  for (const dir of dirs) {
    await mkdir(join(basePath, dir), { recursive: true });
  }
}

export function getDefaultRegistry(): string {
  return `# Council Registry
# Configure your repos and council settings here

repos:
  # Example repo configuration:
  # "my-app":
  #   path: "../my-app"
  #   tech_hints: ["typescript", "web"]
  #   quick_commands:
  #     dev: "pnpm dev"
  #     test: "pnpm test"
  #
  # "my-server":
  #   path: "../my-server"
  #   tech_hints: ["typescript", "server"]
  #   logs:
  #     kind: "cloudwatch"
  #     group: "/ecs/my-service"
  #     region: "us-east-1"
  #   quick_commands:
  #     run: "make dev"
  #     test: "make test"

council:
  parallelism: 3
  max_turns: 14
  stop_when:
    - "resolution_confirmed"
    - "action_plan_ready"
    - "blocked_missing_evidence"
`;
}

export async function writeRegistry(basePath: string = process.cwd()): Promise<void> {
  const registryPath = join(basePath, WORKSPACE_STRUCTURE.registry);
  await writeFile(registryPath, getDefaultRegistry(), "utf-8");
}

export async function initWorkspace(basePath: string = process.cwd()): Promise<void> {
  await createWorkspace(basePath);
  await writeRegistry(basePath);
}
