import chalk from "chalk";
import { workspaceExists } from "../lib/workspace.js";
import { loadRegistry } from "../lib/registry.js";
import { createMemoryManager } from "../lib/memory.js";

export interface MemoryQueryOptions {
  query: string;
  source?: "acontext" | "cognee" | "all";
  limit?: number;
}

export async function memoryQueryCommand(options: MemoryQueryOptions): Promise<void> {
  const cwd = process.cwd();

  // Check workspace exists
  if (!(await workspaceExists(cwd))) {
    console.error(chalk.red("No council workspace found. Run 'council init' first."));
    process.exit(1);
  }

  // Load registry
  let registry;
  try {
    registry = await loadRegistry(cwd);
  } catch (error) {
    console.error(chalk.red((error as Error).message));
    process.exit(1);
  }

  // Create memory manager
  const memoryManager = createMemoryManager(registry);
  const status = await memoryManager.initialize();

  if (!memoryManager.isAvailable()) {
    console.error(chalk.red("No memory systems available."));
    if (status.acontext.lastError) {
      console.error(chalk.gray(`  Acontext: ${status.acontext.lastError}`));
    }
    if (status.cognee.lastError) {
      console.error(chalk.gray(`  Cognee: ${status.cognee.lastError}`));
    }
    process.exit(1);
  }

  console.log(chalk.bold("\n🧠 Memory Query\n"));
  console.log(chalk.gray(`Query: "${options.query}"`));
  console.log(chalk.gray(`Source: ${options.source || "all"}\n`));

  // Get context (searches both memory systems)
  const context = await memoryManager.getContextForThread(options.query, []);
  const limit = options.limit || 10;

  // Display Acontext results (SOPs)
  if (options.source !== "cognee" && status.acontext.available) {
    console.log(chalk.cyan("═══ From Acontext (Procedures) ═══\n"));

    if (context.sops.length === 0) {
      console.log(chalk.gray("  No matching SOPs found.\n"));
    } else {
      const sopsToShow = context.sops.slice(0, limit);
      for (let i = 0; i < sopsToShow.length; i++) {
        const sop = sopsToShow[i];
        console.log(chalk.white(`  ${i + 1}. ${sop.title}`));
        if (sop.description) {
          console.log(chalk.gray(`     ${sop.description.slice(0, 100)}${sop.description.length > 100 ? "..." : ""}`));
        }
        if (sop.trigger_pattern) {
          console.log(chalk.gray(`     Trigger: ${sop.trigger_pattern}`));
        }
        console.log();
      }

      if (context.sops.length > limit) {
        console.log(chalk.gray(`  ... and ${context.sops.length - limit} more\n`));
      }
    }
  }

  // Display Cognee results (Facts)
  if (options.source !== "acontext" && status.cognee.available) {
    console.log(chalk.cyan("═══ From Cognee (Facts) ═══\n"));

    if (context.facts.length === 0) {
      console.log(chalk.gray("  No matching facts found.\n"));
    } else {
      const factsToShow = context.facts.slice(0, limit);
      for (let i = 0; i < factsToShow.length; i++) {
        const fact = factsToShow[i];
        console.log(chalk.white(`  ${i + 1}. [${fact.repo}] ${fact.type}: ${fact.key}`));
        console.log(chalk.gray(`     ${fact.value}`));
        if (fact.confidence) {
          console.log(chalk.gray(`     Confidence: ${(fact.confidence * 100).toFixed(0)}%`));
        }
        console.log();
      }

      if (context.facts.length > limit) {
        console.log(chalk.gray(`  ... and ${context.facts.length - limit} more\n`));
      }
    }
  }

  // Status summary
  console.log(chalk.bold("─────────────────────────────────"));
  console.log(chalk.gray(`Acontext: ${status.acontext.available ? chalk.green("✓") : chalk.red("✗")} | Cognee: ${status.cognee.available ? chalk.green("✓") : chalk.red("✗")}`));
  console.log();
}

export interface MemoryStatusOptions {}

export async function memoryStatusCommand(_options: MemoryStatusOptions): Promise<void> {
  const cwd = process.cwd();

  // Check workspace exists
  if (!(await workspaceExists(cwd))) {
    console.error(chalk.red("No council workspace found. Run 'council init' first."));
    process.exit(1);
  }

  // Load registry
  let registry;
  try {
    registry = await loadRegistry(cwd);
  } catch (error) {
    console.error(chalk.red((error as Error).message));
    process.exit(1);
  }

  // Create memory manager
  const memoryManager = createMemoryManager(registry);
  const status = await memoryManager.initialize();

  console.log(chalk.bold("\n🧠 Memory Status\n"));

  console.log(chalk.white("  Acontext (Procedural Memory):"));
  if (status.acontext.available) {
    console.log(chalk.green("    ✓ Available"));
    if (registry.memory.acontext?.base_url) {
      console.log(chalk.gray(`      URL: ${registry.memory.acontext.base_url}`));
    }
  } else {
    console.log(chalk.red("    ✗ Unavailable"));
    if (status.acontext.lastError) {
      console.log(chalk.gray(`      Error: ${status.acontext.lastError}`));
    }
  }

  console.log();

  console.log(chalk.white("  Cognee (Semantic Memory):"));
  if (status.cognee.available) {
    console.log(chalk.green("    ✓ Available"));
    console.log(chalk.gray(`      Mode: ${registry.memory.cognee?.local ? "local" : "remote"}`));
  } else {
    console.log(chalk.red("    ✗ Unavailable"));
    if (status.cognee.lastError) {
      console.log(chalk.gray(`      Error: ${status.cognee.lastError}`));
    }
  }

  console.log();
}
