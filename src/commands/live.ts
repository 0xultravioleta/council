import chalk from "chalk";

export interface LiveOptions {
  thread: string;
}

export async function liveCommand(options: LiveOptions): Promise<void> {
  console.log(chalk.yellow("council live - not implemented yet"));
  console.log("Options:", options);
}
