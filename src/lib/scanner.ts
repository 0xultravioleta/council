/**
 * Synergy Scanner
 *
 * Scans repositories for integration points, endpoints, and boundaries.
 * Used to identify synergy opportunities across multi-repo systems.
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { join, extname, relative } from "node:path";

export interface ScanResult {
  repo: string;
  path: string;
  endpoints: Endpoint[];
  dependencies: Dependency[];
  exports: Export[];
  imports: Import[];
  configFiles: ConfigFile[];
  boundaries: Boundary[];
}

export interface Endpoint {
  method: string;
  path: string;
  file: string;
  line: number;
}

export interface Dependency {
  name: string;
  version?: string;
  type: "runtime" | "dev";
  source: string;
}

export interface Export {
  name: string;
  type: "function" | "class" | "const" | "type" | "interface";
  file: string;
  line: number;
}

export interface Import {
  from: string;
  imports: string[];
  file: string;
  line: number;
  isExternal: boolean;
}

export interface ConfigFile {
  name: string;
  path: string;
  type: "json" | "yaml" | "env" | "toml" | "other";
}

export interface Boundary {
  type: "api" | "event" | "queue" | "database" | "file" | "config";
  description: string;
  file: string;
  line?: number;
}

export interface ScanOptions {
  maxDepth?: number;
  ignorePatterns?: string[];
}

const DEFAULT_IGNORE = [
  "node_modules",
  ".git",
  ".council",
  "dist",
  "build",
  "coverage",
  "__pycache__",
  ".pytest_cache",
  "target",
  "vendor",
];

/**
 * Scan a repository for integration points
 */
export async function scanRepo(
  repoPath: string,
  repoName: string,
  options?: ScanOptions
): Promise<ScanResult> {
  const result: ScanResult = {
    repo: repoName,
    path: repoPath,
    endpoints: [],
    dependencies: [],
    exports: [],
    imports: [],
    configFiles: [],
    boundaries: [],
  };

  const ignorePatterns = options?.ignorePatterns ?? DEFAULT_IGNORE;
  const maxDepth = options?.maxDepth ?? 10;

  // Scan for config files and dependencies
  await scanConfigFiles(repoPath, result);

  // Scan source files
  await scanDirectory(repoPath, repoPath, result, ignorePatterns, maxDepth, 0);

  return result;
}

async function scanConfigFiles(basePath: string, result: ScanResult): Promise<void> {
  const configPatterns = [
    { name: "package.json", type: "json" as const },
    { name: "tsconfig.json", type: "json" as const },
    { name: "pyproject.toml", type: "toml" as const },
    { name: "requirements.txt", type: "other" as const },
    { name: "go.mod", type: "other" as const },
    { name: "Cargo.toml", type: "toml" as const },
    { name: ".env", type: "env" as const },
    { name: ".env.example", type: "env" as const },
    { name: "docker-compose.yml", type: "yaml" as const },
    { name: "docker-compose.yaml", type: "yaml" as const },
  ];

  for (const config of configPatterns) {
    try {
      const fullPath = join(basePath, config.name);
      await stat(fullPath);
      result.configFiles.push({
        name: config.name,
        path: config.name,
        type: config.type,
      });

      // Parse package.json for dependencies
      if (config.name === "package.json") {
        try {
          const content = await readFile(fullPath, "utf-8");
          const pkg = JSON.parse(content);

          if (pkg.dependencies) {
            for (const [name, version] of Object.entries(pkg.dependencies)) {
              result.dependencies.push({
                name,
                version: version as string,
                type: "runtime",
                source: "package.json",
              });
            }
          }

          if (pkg.devDependencies) {
            for (const [name, version] of Object.entries(pkg.devDependencies)) {
              result.dependencies.push({
                name,
                version: version as string,
                type: "dev",
                source: "package.json",
              });
            }
          }
        } catch {
          // Ignore parse errors
        }
      }

      // Parse requirements.txt for Python dependencies
      if (config.name === "requirements.txt") {
        try {
          const content = await readFile(fullPath, "utf-8");
          const lines = content.split("\n");
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith("#")) {
              const match = trimmed.match(/^([a-zA-Z0-9_-]+)(?:[>=<]+(.+))?/);
              if (match) {
                result.dependencies.push({
                  name: match[1],
                  version: match[2],
                  type: "runtime",
                  source: "requirements.txt",
                });
              }
            }
          }
        } catch {
          // Ignore parse errors
        }
      }
    } catch {
      // File doesn't exist
    }
  }
}

async function scanDirectory(
  basePath: string,
  currentPath: string,
  result: ScanResult,
  ignorePatterns: string[],
  maxDepth: number,
  currentDepth: number
): Promise<void> {
  if (currentDepth > maxDepth) return;

  try {
    const entries = await readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      if (ignorePatterns.includes(entry.name)) continue;
      if (entry.name.startsWith(".")) continue;

      const fullPath = join(currentPath, entry.name);

      if (entry.isDirectory()) {
        await scanDirectory(
          basePath,
          fullPath,
          result,
          ignorePatterns,
          maxDepth,
          currentDepth + 1
        );
      } else if (entry.isFile()) {
        const ext = extname(entry.name).toLowerCase();
        const relativePath = relative(basePath, fullPath);

        if ([".ts", ".tsx", ".js", ".jsx", ".mjs"].includes(ext)) {
          await scanJavaScriptFile(fullPath, relativePath, result);
        } else if (ext === ".py") {
          await scanPythonFile(fullPath, relativePath, result);
        } else if (ext === ".go") {
          await scanGoFile(fullPath, relativePath, result);
        }
      }
    }
  } catch {
    // Ignore directory read errors
  }
}

async function scanJavaScriptFile(
  filePath: string,
  relativePath: string,
  result: ScanResult
): Promise<void> {
  try {
    const content = await readFile(filePath, "utf-8");
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Detect HTTP endpoints
      const routePatterns = [
        /\.(get|post|put|delete|patch)\s*\(\s*['"](\/[^'"]*)['"]/i,
        /router\.(get|post|put|delete|patch)\s*\(\s*['"](\/[^'"]*)['"]/i,
        /@(Get|Post|Put|Delete|Patch)\s*\(\s*['"](\/[^'"]*)['"]\)/,
        /app\.(get|post|put|delete|patch)\s*\(\s*['"](\/[^'"]*)['"]/i,
      ];

      for (const pattern of routePatterns) {
        const match = line.match(pattern);
        if (match) {
          result.endpoints.push({
            method: match[1].toUpperCase(),
            path: match[2],
            file: relativePath,
            line: lineNum,
          });
          break; // Only match one pattern per line
        }
      }

      // Detect exports
      const exportMatch = line.match(
        /export\s+(async\s+)?(function|class|const|interface|type)\s+(\w+)/
      );
      if (exportMatch) {
        result.exports.push({
          name: exportMatch[3],
          type: exportMatch[2] as Export["type"],
          file: relativePath,
          line: lineNum,
        });
      }

      // Detect imports
      const importMatch = line.match(/import\s+(?:{([^}]+)}|(\w+))\s+from\s+['"]([^'"]+)['"]/);
      if (importMatch) {
        const imports = importMatch[1]
          ? importMatch[1].split(",").map((s) => s.trim())
          : importMatch[2]
            ? [importMatch[2]]
            : [];
        const from = importMatch[3];

        result.imports.push({
          from,
          imports,
          file: relativePath,
          line: lineNum,
          isExternal: !from.startsWith(".") && !from.startsWith("/"),
        });
      }

      // Detect boundaries
      detectBoundaries(line, relativePath, lineNum, result);
    }
  } catch {
    // Ignore file read errors
  }
}

async function scanPythonFile(
  filePath: string,
  relativePath: string,
  result: ScanResult
): Promise<void> {
  try {
    const content = await readFile(filePath, "utf-8");
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Detect Flask/FastAPI endpoints
      const routePatterns = [
        /@app\.(get|post|put|delete|patch)\s*\(\s*['"](\/[^'"]*)['"]/i,
        /@router\.(get|post|put|delete|patch)\s*\(\s*['"](\/[^'"]*)['"]/i,
        /@(app|router)\.route\s*\(\s*['"](\/[^'"]*)['"]/i,
      ];

      for (const pattern of routePatterns) {
        const match = line.match(pattern);
        if (match) {
          result.endpoints.push({
            method: match[1]?.toUpperCase() || "GET",
            path: match[2],
            file: relativePath,
            line: lineNum,
          });
          break; // Only match one pattern per line
        }
      }

      // Detect exports (def/class at module level)
      if (!line.startsWith(" ") && !line.startsWith("\t")) {
        const defMatch = line.match(/^(def|class)\s+(\w+)/);
        if (defMatch) {
          result.exports.push({
            name: defMatch[2],
            type: defMatch[1] === "class" ? "class" : "function",
            file: relativePath,
            line: lineNum,
          });
        }
      }

      // Detect imports
      const importMatch = line.match(/^from\s+(\S+)\s+import\s+(.+)$/);
      if (importMatch) {
        const imports = importMatch[2].split(",").map((s) => s.trim());
        result.imports.push({
          from: importMatch[1],
          imports,
          file: relativePath,
          line: lineNum,
          isExternal: !importMatch[1].startsWith("."),
        });
      }

      detectBoundaries(line, relativePath, lineNum, result);
    }
  } catch {
    // Ignore file read errors
  }
}

async function scanGoFile(
  filePath: string,
  relativePath: string,
  result: ScanResult
): Promise<void> {
  try {
    const content = await readFile(filePath, "utf-8");
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Detect HTTP handlers
      const routePatterns = [
        /HandleFunc\s*\(\s*['"](\/[^'"]*)['"]/,
        /\.Handle\s*\(\s*['"](\/[^'"]*)['"]/,
        /r\.(Get|Post|Put|Delete|Patch)\s*\(\s*['"](\/[^'"]*)['"]/i,
      ];

      for (const pattern of routePatterns) {
        const match = line.match(pattern);
        if (match) {
          result.endpoints.push({
            method: match[1]?.toUpperCase() || "ANY",
            path: match[2] || match[1],
            file: relativePath,
            line: lineNum,
          });
          break; // Only match one pattern per line
        }
      }

      // Detect exported functions (capitalized)
      const funcMatch = line.match(/^func\s+(?:\([^)]+\)\s+)?([A-Z]\w+)/);
      if (funcMatch) {
        result.exports.push({
          name: funcMatch[1],
          type: "function",
          file: relativePath,
          line: lineNum,
        });
      }

      detectBoundaries(line, relativePath, lineNum, result);
    }
  } catch {
    // Ignore file read errors
  }
}

function detectBoundaries(
  line: string,
  file: string,
  lineNum: number,
  result: ScanResult
): void {
  const patterns = [
    { regex: /fetch\s*\(|axios\.|http\.request|requests\./i, type: "api" as const, desc: "HTTP client call" },
    { regex: /kafka|rabbitmq|amqp|pubsub|eventbridge/i, type: "event" as const, desc: "Message queue/event" },
    { regex: /redis|memcache|sqs|queue/i, type: "queue" as const, desc: "Queue/cache" },
    { regex: /mongodb|postgres|mysql|sqlite|prisma|sequelize|typeorm/i, type: "database" as const, desc: "Database" },
    { regex: /process\.env\.|os\.environ|getenv/i, type: "config" as const, desc: "Environment config" },
    { regex: /fs\.(read|write)|open\(|io\.open/i, type: "file" as const, desc: "File I/O" },
  ];

  for (const { regex, type, desc } of patterns) {
    if (regex.test(line)) {
      // Avoid duplicates
      const exists = result.boundaries.some(
        (b) => b.type === type && b.file === file && b.line === lineNum
      );
      if (!exists) {
        result.boundaries.push({
          type,
          description: desc,
          file,
          line: lineNum,
        });
      }
    }
  }
}

/**
 * Analyze synergy between multiple repos
 */
export interface SynergyAnalysis {
  sharedDependencies: Array<{
    name: string;
    repos: string[];
    versions: Record<string, string>;
  }>;
  potentialIntegrations: Array<{
    type: string;
    description: string;
    repos: string[];
  }>;
  endpointOverlap: Array<{
    path: string;
    repos: string[];
  }>;
}

export function analyzeSynergy(results: ScanResult[]): SynergyAnalysis {
  const analysis: SynergyAnalysis = {
    sharedDependencies: [],
    potentialIntegrations: [],
    endpointOverlap: [],
  };

  // Find shared dependencies
  const depMap = new Map<string, { repos: string[]; versions: Record<string, string> }>();

  for (const result of results) {
    for (const dep of result.dependencies) {
      const existing = depMap.get(dep.name);
      if (existing) {
        if (!existing.repos.includes(result.repo)) {
          existing.repos.push(result.repo);
        }
        if (dep.version) {
          existing.versions[result.repo] = dep.version;
        }
      } else {
        depMap.set(dep.name, {
          repos: [result.repo],
          versions: dep.version ? { [result.repo]: dep.version } : {},
        });
      }
    }
  }

  for (const [name, data] of depMap) {
    if (data.repos.length > 1) {
      analysis.sharedDependencies.push({
        name,
        repos: data.repos,
        versions: data.versions,
      });
    }
  }

  // Find potential integrations based on boundaries
  const boundaryTypes = new Map<string, string[]>();

  for (const result of results) {
    for (const boundary of result.boundaries) {
      const key = boundary.type;
      const existing = boundaryTypes.get(key);
      if (existing) {
        if (!existing.includes(result.repo)) {
          existing.push(result.repo);
        }
      } else {
        boundaryTypes.set(key, [result.repo]);
      }
    }
  }

  for (const [type, repos] of boundaryTypes) {
    if (repos.length > 1) {
      analysis.potentialIntegrations.push({
        type,
        description: `Multiple repos use ${type} boundaries`,
        repos,
      });
    }
  }

  // Find endpoint overlaps
  const endpointMap = new Map<string, string[]>();

  for (const result of results) {
    for (const endpoint of result.endpoints) {
      const key = endpoint.path;
      const existing = endpointMap.get(key);
      if (existing) {
        if (!existing.includes(result.repo)) {
          existing.push(result.repo);
        }
      } else {
        endpointMap.set(key, [result.repo]);
      }
    }
  }

  for (const [path, repos] of endpointMap) {
    if (repos.length > 1) {
      analysis.endpointOverlap.push({ path, repos });
    }
  }

  return analysis;
}
