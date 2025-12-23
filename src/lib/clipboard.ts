/**
 * Clipboard and Auto-Paste Utilities
 *
 * Provides safe clipboard operations with user confirmation.
 * Supports cross-platform clipboard access.
 */

import { execSync, spawn } from "node:child_process";
import { createInterface } from "node:readline";

/**
 * Detect the platform's clipboard command
 */
export function getClipboardCommand(): {
  copy: string[];
  paste: string[];
} | null {
  const platform = process.platform;

  if (platform === "darwin") {
    return {
      copy: ["pbcopy"],
      paste: ["pbpaste"],
    };
  }

  if (platform === "linux") {
    // Try xclip first, then xsel
    try {
      execSync("which xclip", { stdio: "ignore" });
      return {
        copy: ["xclip", "-selection", "clipboard"],
        paste: ["xclip", "-selection", "clipboard", "-o"],
      };
    } catch {
      try {
        execSync("which xsel", { stdio: "ignore" });
        return {
          copy: ["xsel", "--clipboard", "--input"],
          paste: ["xsel", "--clipboard", "--output"],
        };
      } catch {
        // WSL fallback
        try {
          execSync("which clip.exe", { stdio: "ignore" });
          return {
            copy: ["clip.exe"],
            paste: ["powershell.exe", "-command", "Get-Clipboard"],
          };
        } catch {
          return null;
        }
      }
    }
  }

  if (platform === "win32") {
    return {
      copy: ["clip"],
      paste: ["powershell", "-command", "Get-Clipboard"],
    };
  }

  return null;
}

/**
 * Check if clipboard is available
 */
export function isClipboardAvailable(): boolean {
  return getClipboardCommand() !== null;
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  const cmd = getClipboardCommand();
  if (!cmd) {
    return false;
  }

  return new Promise((resolve) => {
    const [program, ...args] = cmd.copy;
    const proc = spawn(program, args, { stdio: ["pipe", "ignore", "ignore"] });

    proc.stdin?.write(text);
    proc.stdin?.end();

    proc.on("close", (code) => {
      resolve(code === 0);
    });

    proc.on("error", () => {
      resolve(false);
    });
  });
}

/**
 * Get text from clipboard
 */
export async function getFromClipboard(): Promise<string | null> {
  const cmd = getClipboardCommand();
  if (!cmd) {
    return null;
  }

  try {
    const [program, ...args] = cmd.paste;
    const result = execSync([program, ...args].join(" "), {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return result;
  } catch {
    return null;
  }
}

/**
 * Prompt user for confirmation
 */
export async function confirmPrompt(message: string): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} [y/N] `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}

/**
 * Copy prompt to clipboard with confirmation
 */
export async function copyPromptWithConfirmation(
  prompt: string,
  repoName: string
): Promise<boolean> {
  if (!isClipboardAvailable()) {
    console.log("Clipboard not available on this system");
    return false;
  }

  // Show preview
  const preview =
    prompt.length > 200
      ? prompt.substring(0, 200) + "\n... (truncated)"
      : prompt;

  console.log(`\n📋 Prompt for ${repoName}:`);
  console.log("─".repeat(40));
  console.log(preview);
  console.log("─".repeat(40));
  console.log(`Total length: ${prompt.length} characters`);

  const confirmed = await confirmPrompt("\nCopy to clipboard?");

  if (confirmed) {
    const success = await copyToClipboard(prompt);
    if (success) {
      console.log("✅ Copied to clipboard");
      return true;
    } else {
      console.log("❌ Failed to copy to clipboard");
      return false;
    }
  }

  return false;
}

/**
 * Interactive prompt selector for multiple repos
 */
export async function interactivePromptSelector(
  prompts: Array<{ repo: string; prompt: string }>
): Promise<void> {
  if (!isClipboardAvailable()) {
    console.log("Clipboard not available on this system");
    return;
  }

  console.log("\n📋 Available prompts:");
  for (let i = 0; i < prompts.length; i++) {
    const p = prompts[i];
    console.log(`  ${i + 1}. ${p.repo} (${p.prompt.length} chars)`);
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ask = (): Promise<string> =>
    new Promise((resolve) => {
      rl.question("\nEnter number to copy (or 'q' to quit): ", resolve);
    });

  let running = true;
  while (running) {
    const answer = await ask();

    if (answer.toLowerCase() === "q" || answer === "") {
      running = false;
      continue;
    }

    const index = parseInt(answer, 10) - 1;
    if (isNaN(index) || index < 0 || index >= prompts.length) {
      console.log("Invalid selection");
      continue;
    }

    const selected = prompts[index];
    const success = await copyToClipboard(selected.prompt);

    if (success) {
      console.log(`✅ Copied prompt for ${selected.repo}`);
    } else {
      console.log(`❌ Failed to copy prompt for ${selected.repo}`);
    }
  }

  rl.close();
  console.log("\nDone.");
}
