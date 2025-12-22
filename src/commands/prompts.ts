import chalk from "chalk";

export interface PromptsOptions {
  thread: string;
}

export async function promptsCommand(options: PromptsOptions): Promise<void> {
  console.log(chalk.yellow("council prompts - not implemented yet"));
  console.log("Options:", options);
}
