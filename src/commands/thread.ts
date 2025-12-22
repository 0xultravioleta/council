import chalk from "chalk";

export interface ThreadNewOptions {
  title: string;
  repos: string;
}

export async function threadNewCommand(options: ThreadNewOptions): Promise<void> {
  console.log(chalk.yellow("council thread new - not implemented yet"));
  console.log("Options:", options);
}

export async function threadListCommand(): Promise<void> {
  console.log(chalk.yellow("council thread list - not implemented yet"));
}
