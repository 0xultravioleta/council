import chalk from "chalk";
import { stat, access, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { workspaceExists, WORKSPACE_STRUCTURE } from "../lib/workspace.js";
import { loadRegistry, type NormalizedRegistry } from "../lib/registry.js";
import * as yaml from "yaml";

export interface RegistryAddOptions {
  name: string;
  path: string;
  description: string;
  tech?: string;
}

export interface RegistryVerifyOptions {
  repo?: string;
}

export interface RegistryListOptions {}

async function loadRawRegistry(cwd: string): Promise<{ content: string; data: any }> {
  const registryPath = join(cwd, WORKSPACE_STRUCTURE.registry);
  const content = await readFile(registryPath, "utf-8");
  const data = yaml.parse(content);
  return { content, data };
}

async function saveRegistry(cwd: string, data: any): Promise<void> {
  const registryPath = join(cwd, WORKSPACE_STRUCTURE.registry);
  const content = yaml.stringify(data, { indent: 2 });
  await writeFile(registryPath, content, "utf-8");
}

export async function registryAddCommand(options: RegistryAddOptions): Promise<void> {
  const cwd = process.cwd();

  // Check workspace exists
  if (!(await workspaceExists(cwd))) {
    console.error(chalk.red("No council workspace found. Run 'council init' first."));
    process.exit(1);
  }

  // Validate repo name
  if (!/^[a-z0-9-_]+$/i.test(options.name)) {
    console.error(chalk.red("Repo name must contain only letters, numbers, hyphens, and underscores."));
    process.exit(1);
  }

  // Load current registry
  let rawRegistry;
  try {
    rawRegistry = await loadRawRegistry(cwd);
  } catch (error) {
    console.error(chalk.red("Failed to load registry:"), (error as Error).message);
    process.exit(1);
  }

  // Check if repo already exists
  if (rawRegistry.data.repos && rawRegistry.data.repos[options.name]) {
    console.error(chalk.red(`Repo "${options.name}" already exists in registry.`));
    process.exit(1);
  }

  // Verify path exists
  const repoPath = resolve(cwd, options.path);
  try {
    const stats = await stat(repoPath);
    if (!stats.isDirectory()) {
      console.error(chalk.red(`Path is not a directory: ${options.path}`));
      process.exit(1);
    }
  } catch {
    console.error(chalk.red(`Path does not exist: ${options.path}`));
    process.exit(1);
  }

  // Add to registry
  if (!rawRegistry.data.repos) {
    rawRegistry.data.repos = {};
  }

  const repoConfig: any = {
    path: options.path,
    description: options.description,
  };

  if (options.tech) {
    repoConfig.tech = options.tech.split(",").map((t) => t.trim());
  }

  rawRegistry.data.repos[options.name] = repoConfig;

  // Save registry
  try {
    await saveRegistry(cwd, rawRegistry.data);
    console.log(chalk.green(`\n✅ Added repo "${options.name}" to registry.\n`));

    console.log(chalk.white("Configuration:"));
    console.log(chalk.gray(`  Path: ${options.path}`));
    console.log(chalk.gray(`  Description: ${options.description}`));
    if (options.tech) {
      console.log(chalk.gray(`  Tech: ${options.tech}`));
    }

    console.log(chalk.yellow("\nNext steps:"));
    console.log(chalk.gray("  1. Create a CLAUDE.md in the repo to help agents understand it"));
    console.log(chalk.gray(`  2. Run: council registry verify --repo ${options.name}`));
    console.log();
  } catch (error) {
    console.error(chalk.red("Failed to save registry:"), (error as Error).message);
    process.exit(1);
  }
}

export async function registryVerifyCommand(options: RegistryVerifyOptions): Promise<void> {
  const cwd = process.cwd();

  // Check workspace exists
  if (!(await workspaceExists(cwd))) {
    console.error(chalk.red("No council workspace found. Run 'council init' first."));
    process.exit(1);
  }

  // Load registry
  let registry: NormalizedRegistry;
  try {
    registry = await loadRegistry(cwd);
  } catch (error) {
    console.error(chalk.red("Failed to load registry:"), (error as Error).message);
    process.exit(1);
  }

  const reposToVerify = options.repo
    ? [options.repo]
    : Object.keys(registry.repos);

  if (options.repo && !registry.repos[options.repo]) {
    console.error(chalk.red(`Repo "${options.repo}" not found in registry.`));
    process.exit(1);
  }

  console.log(chalk.bold("\n🔍 Verifying Repositories\n"));

  let allPassed = true;

  for (const repoName of reposToVerify) {
    const config = registry.repos[repoName];
    const repoPath = resolve(cwd, config.path);

    console.log(chalk.cyan(`${repoName}:`));

    // Check path exists
    try {
      const stats = await stat(repoPath);
      if (stats.isDirectory()) {
        console.log(chalk.green("  ✓ Path exists"));
      } else {
        console.log(chalk.red("  ✗ Path is not a directory"));
        allPassed = false;
        continue;
      }
    } catch {
      console.log(chalk.red(`  ✗ Path not found: ${config.path}`));
      allPassed = false;
      continue;
    }

    // Check if git repo
    const gitPath = join(repoPath, ".git");
    try {
      await access(gitPath);
      console.log(chalk.green("  ✓ Git repository detected"));
    } catch {
      console.log(chalk.yellow("  ⚠ Not a git repository"));
    }

    // Check for CLAUDE.md
    const claudeMdPath = join(repoPath, "CLAUDE.md");
    try {
      await access(claudeMdPath);
      console.log(chalk.green("  ✓ CLAUDE.md found"));
    } catch {
      console.log(chalk.yellow("  ⚠ CLAUDE.md not found (recommended)"));
    }

    // Check for README
    const readmePath = join(repoPath, "README.md");
    try {
      await access(readmePath);
      console.log(chalk.green("  ✓ README.md found"));
    } catch {
      console.log(chalk.gray("  - README.md not found"));
    }

    console.log(chalk.green("  ✓ Ready for Council sessions"));
    console.log();
  }

  if (allPassed) {
    console.log(chalk.green("✅ All repositories verified successfully.\n"));
  } else {
    console.log(chalk.yellow("⚠️  Some repositories have issues. Please fix and re-verify.\n"));
    process.exit(1);
  }
}

export async function registryListCommand(_options: RegistryListOptions): Promise<void> {
  const cwd = process.cwd();

  // Check workspace exists
  if (!(await workspaceExists(cwd))) {
    console.error(chalk.red("No council workspace found. Run 'council init' first."));
    process.exit(1);
  }

  // Load registry
  let registry: NormalizedRegistry;
  try {
    registry = await loadRegistry(cwd);
  } catch (error) {
    console.error(chalk.red("Failed to load registry:"), (error as Error).message);
    process.exit(1);
  }

  const repoNames = Object.keys(registry.repos);

  if (repoNames.length === 0) {
    console.log(chalk.yellow("\nNo repositories registered."));
    console.log(chalk.gray("Use: council registry add --name <name> --path <path> --description <desc>\n"));
    return;
  }

  console.log(chalk.bold("\n📦 Registered Repositories\n"));

  for (const name of repoNames) {
    const config = registry.repos[name];
    console.log(chalk.cyan(`  ${name}`));
    console.log(chalk.gray(`    Path: ${config.path}`));
    if (config.tech_hints?.length) {
      console.log(chalk.gray(`    Tech: ${config.tech_hints.join(", ")}`));
    }
    console.log();
  }

  console.log(chalk.gray(`Total: ${repoNames.length} repositories\n`));
}
