import chalk from "chalk";
import { resolve } from "node:path";
import { writeFile, mkdir } from "node:fs/promises";
import { workspaceExists } from "../lib/workspace.js";
import { loadRegistry, validateRepos } from "../lib/registry.js";
import { scanRepo, analyzeSynergy, type ScanResult } from "../lib/scanner.js";

export interface ScanOptions {
  repos: string;
  output?: "summary" | "full" | "json";
  save?: boolean;
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

  console.log(chalk.bold("\n🔍 Synergy Scan\n"));

  // Scan each repo
  const results: ScanResult[] = [];

  for (const repo of repos) {
    const config = registry.repos[repo];
    const repoPath = resolve(cwd, config.path);

    console.log(chalk.cyan(`Scanning ${repo}...`));

    try {
      const result = await scanRepo(repoPath, repo);
      results.push(result);

      console.log(chalk.green(`  ✓ Found:`));
      console.log(chalk.gray(`    ${result.endpoints.length} endpoints`));
      console.log(chalk.gray(`    ${result.dependencies.length} dependencies`));
      console.log(chalk.gray(`    ${result.exports.length} exports`));
      console.log(chalk.gray(`    ${result.boundaries.length} boundaries`));
    } catch (error) {
      console.log(chalk.red(`  ✗ Error: ${(error as Error).message}`));
    }
  }

  // Output format handling
  if (options.output === "json") {
    const analysis = analyzeSynergy(results);
    console.log(JSON.stringify({ results, analysis }, null, 2));
    return;
  }

  // Print detailed results
  console.log(chalk.bold("\n📊 Scan Results\n"));

  for (const result of results) {
    console.log(chalk.cyan(`\n═══ ${result.repo} ═══`));

    if (result.endpoints.length > 0) {
      console.log(chalk.white("\n  Endpoints:"));
      for (const ep of result.endpoints.slice(0, 10)) {
        console.log(chalk.gray(`    ${ep.method.padEnd(6)} ${ep.path}`));
        console.log(chalk.gray(`           ${ep.file}:${ep.line}`));
      }
      if (result.endpoints.length > 10) {
        console.log(chalk.gray(`    ... and ${result.endpoints.length - 10} more`));
      }
    }

    if (result.boundaries.length > 0 && options.output !== "summary") {
      console.log(chalk.white("\n  Boundaries:"));
      const boundaryGroups = new Map<string, typeof result.boundaries>();
      for (const b of result.boundaries) {
        const existing = boundaryGroups.get(b.type) ?? [];
        existing.push(b);
        boundaryGroups.set(b.type, existing);
      }
      for (const [type, boundaries] of boundaryGroups) {
        console.log(chalk.gray(`    ${type}: ${boundaries.length} occurrences`));
      }
    }

    if (result.configFiles.length > 0) {
      console.log(chalk.white("\n  Config Files:"));
      for (const cf of result.configFiles) {
        console.log(chalk.gray(`    ${cf.name}`));
      }
    }
  }

  // Analyze synergy
  if (results.length > 1) {
    console.log(chalk.bold("\n🔗 Synergy Analysis\n"));

    const analysis = analyzeSynergy(results);

    if (analysis.sharedDependencies.length > 0) {
      console.log(chalk.white("  Shared Dependencies:"));
      for (const dep of analysis.sharedDependencies.slice(0, 15)) {
        console.log(chalk.gray(`    ${dep.name}`));
        console.log(chalk.gray(`      Used by: ${dep.repos.join(", ")}`));
        if (Object.keys(dep.versions).length > 0) {
          const versions = Object.entries(dep.versions)
            .map(([r, v]) => `${r}:${v}`)
            .join(", ");
          console.log(chalk.gray(`      Versions: ${versions}`));
        }
      }
      if (analysis.sharedDependencies.length > 15) {
        console.log(chalk.gray(`    ... and ${analysis.sharedDependencies.length - 15} more`));
      }
    }

    if (analysis.potentialIntegrations.length > 0) {
      console.log(chalk.white("\n  Potential Integration Points:"));
      for (const int of analysis.potentialIntegrations) {
        console.log(chalk.gray(`    ${int.type}: ${int.repos.join(", ")}`));
      }
    }

    if (analysis.endpointOverlap.length > 0) {
      console.log(chalk.yellow("\n  ⚠️  Endpoint Overlaps:"));
      for (const overlap of analysis.endpointOverlap) {
        console.log(chalk.yellow(`    ${overlap.path}: ${overlap.repos.join(", ")}`));
      }
    }
  }

  // Save results if requested
  if (options.save) {
    const scansDir = resolve(cwd, ".council", "scans");
    await mkdir(scansDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `scan_${timestamp}.json`;
    const filepath = resolve(scansDir, filename);

    const analysis = analyzeSynergy(results);
    await writeFile(filepath, JSON.stringify({ results, analysis }, null, 2), "utf-8");

    console.log(chalk.green(`\n✅ Results saved to ${filepath}`));
  }

  console.log();
}
