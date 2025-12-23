import chalk from "chalk";
import { workspaceExists } from "../lib/workspace.js";
import { createMcpServer, mcpTools } from "../lib/mcp.js";

export interface McpServerOptions {
  port?: number;
}

export async function mcpServerCommand(options: McpServerOptions): Promise<void> {
  const cwd = process.cwd();

  // Check workspace exists
  if (!(await workspaceExists(cwd))) {
    console.error(chalk.red("No council workspace found. Run 'council init' first."));
    process.exit(1);
  }

  const port = options.port ?? 3456;

  console.log(chalk.cyan("\n🔌 Starting Council MCP Server\n"));
  console.log(chalk.gray(`   Base path: ${cwd}`));
  console.log(chalk.gray(`   Port: ${port}`));

  console.log(chalk.cyan("\n📋 Available tools:\n"));
  for (const tool of mcpTools) {
    console.log(chalk.white(`   ${tool.name}`));
    console.log(chalk.gray(`      ${tool.description}`));
  }

  console.log(chalk.cyan("\n📡 Endpoints:\n"));
  console.log(chalk.gray(`   POST http://localhost:${port}/initialize`));
  console.log(chalk.gray(`   POST http://localhost:${port}/tools/list`));
  console.log(chalk.gray(`   POST http://localhost:${port}/tools/call`));

  const server = createMcpServer(cwd);

  try {
    await server.start(port);

    console.log(chalk.green(`\n✅ MCP server running on port ${port}`));
    console.log(chalk.gray("   Press Ctrl+C to stop\n"));

    // Handle graceful shutdown
    const shutdown = async () => {
      console.log(chalk.yellow("\n\n🛑 Stopping MCP server..."));
      await server.stop();
      console.log(chalk.green("   Server stopped"));
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    // Keep the process running
    await new Promise(() => {});
  } catch (error) {
    console.error(chalk.red(`\n❌ Failed to start server: ${(error as Error).message}`));
    process.exit(1);
  }
}

export function listMcpToolsCommand(): void {
  console.log(chalk.cyan("\n📋 Council MCP Tools\n"));

  for (const tool of mcpTools) {
    console.log(chalk.white(`${tool.name}`));
    console.log(chalk.gray(`  ${tool.description}`));

    const props = tool.inputSchema.properties;
    const required = tool.inputSchema.required ?? [];

    if (Object.keys(props).length > 0) {
      console.log(chalk.gray("  Parameters:"));
      for (const [name, schema] of Object.entries(props)) {
        const isRequired = required.includes(name);
        const schemaObj = schema as { type: string; description?: string };
        console.log(
          chalk.gray(`    ${name}${isRequired ? " (required)" : ""}: ${schemaObj.type}`)
        );
        if (schemaObj.description) {
          console.log(chalk.gray(`      ${schemaObj.description}`));
        }
      }
    }
    console.log("");
  }
}
