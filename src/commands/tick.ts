import chalk from "chalk";

export interface TickOptions {
  thread: string;
}

export async function tickCommand(options: TickOptions): Promise<void> {
  console.log(chalk.yellow("council tick - not implemented yet"));
  console.log("Options:", options);
}
