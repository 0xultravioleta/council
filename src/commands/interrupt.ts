import chalk from "chalk";

export interface InterruptOptions {
  thread: string;
  note: string;
}

export async function interruptCommand(options: InterruptOptions): Promise<void> {
  console.log(chalk.yellow("council interrupt - not implemented yet"));
  console.log("Options:", options);
}
