import chalk from "chalk";
import { workspaceExists } from "../lib/workspace.js";
import { loadRegistry, validateRepos } from "../lib/registry.js";

export interface ScanOptions {
  repos: string;
}

export async function scanCommand(options: ScanOptions): Promise<void> {
  const cwd = process.cwd();

  // Check workspace exists
  if (!(await workspaceExists(cwd))) {
    console.error(chalk.red("No council workspace found. Run 'council init' first."));
    process.exit(1);
  }

  // Parse repos
  const repos = options.repos.split(",").map((r) => r.trim());

  // Validate repos exist in registry
  let registry;
  try {
    registry = await loadRegistry(cwd);
    validateRepos(registry, repos);
  } catch (error) {
    if (error instanceof Error) {
      console.error(chalk.red(error.message));
    }
    process.exit(1);
  }

  console.log(chalk.bold("\nScan Configuration\n"));
  console.log(chalk.gray("Repos to scan:"));
  for (const repo of repos) {
    const config = registry.repos[repo];
    console.log(chalk.cyan(`  ${repo}`));
    console.log(chalk.gray(`    Path: ${config.path}`));
    if (config.tech_hints && config.tech_hints.length > 0) {
      console.log(chalk.gray(`    Tech: ${config.tech_hints.join(", ")}`));
    }
  }

  console.log();
  console.log(chalk.yellow("Scan feature is planned for M2."));
  console.log(chalk.gray("This will analyze repos for:"));
  console.log(chalk.gray("  - Integration points"));
  console.log(chalk.gray("  - Shared dependencies"));
  console.log(chalk.gray("  - API contracts"));
  console.log(chalk.gray("  - Synergy opportunities"));
}
