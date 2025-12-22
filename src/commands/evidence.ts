import chalk from "chalk";

export interface AddEvidenceOptions {
  thread: string;
  file: string;
}

export async function addEvidenceCommand(options: AddEvidenceOptions): Promise<void> {
  console.log(chalk.yellow("council add-evidence - not implemented yet"));
  console.log("Options:", options);
}
