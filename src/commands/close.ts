import chalk from "chalk";

export interface CloseOptions {
  thread: string;
  status: string;
  summary?: string;
}

export async function closeCommand(options: CloseOptions): Promise<void> {
  console.log(chalk.yellow("council close - not implemented yet"));
  console.log("Options:", options);
}
