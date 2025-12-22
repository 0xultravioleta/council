import chalk from "chalk";
import { workspaceExists, initWorkspace, COUNCIL_DIR } from "../lib/workspace.js";

export async function initCommand(): Promise<void> {
  const cwd = process.cwd();

  if (await workspaceExists(cwd)) {
    console.log(chalk.yellow(`Workspace already exists at ${COUNCIL_DIR}/`));
    console.log(chalk.gray("Use existing workspace or delete it to reinitialize."));
    return;
  }

  try {
    await initWorkspace(cwd);
    console.log(chalk.green(`Initialized council workspace at ${COUNCIL_DIR}/`));
    console.log();
    console.log("Created:");
    console.log(chalk.gray(`  ${COUNCIL_DIR}/`));
    console.log(chalk.gray(`  ${COUNCIL_DIR}/threads/`));
    console.log(chalk.gray(`  ${COUNCIL_DIR}/scans/`));
    console.log(chalk.gray(`  ${COUNCIL_DIR}/runs/`));
    console.log(chalk.gray(`  ${COUNCIL_DIR}/registry.yaml`));
    console.log();
    console.log("Next steps:");
    console.log(chalk.cyan("  1. Edit registry.yaml to add your repos"));
    console.log(chalk.cyan("  2. Run: council thread new --title \"...\" --repos \"A,B\""));
  } catch (error) {
    console.error(chalk.red("Failed to initialize workspace:"), error);
    process.exit(1);
  }
}
