import chalk from "chalk";

export interface AskOptions {
  thread: string;
  from: string;
  to: string;
  summary: string;
}

export async function askCommand(options: AskOptions): Promise<void> {
  console.log(chalk.yellow("council ask - not implemented yet"));
  console.log("Options:", options);
}
