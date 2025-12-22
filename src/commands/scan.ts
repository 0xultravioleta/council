import chalk from "chalk";

export interface ScanOptions {
  repos: string;
}

export async function scanCommand(options: ScanOptions): Promise<void> {
  console.log(chalk.yellow("council scan - not implemented yet"));
  console.log("Options:", options);
}
