/**
 * Custom Commands - Load and execute custom slash commands from synaptic/ directory
 *
 * Usage:
 *   Create synaptic/review.md in your project:
 *     ```
 *     Review the following code for bugs and improvements:
 *     $ARGUMENTS
 *     ```
 *
 *   Then use: /review src/index.ts
 *
 * Variables:
 *   $ARGUMENTS - The arguments passed to the command
 *   $CWD - Current working directory
 *   $DATE - Today's date
 */

import * as fs from 'fs';
import * as path from 'path';

export interface CustomCommand {
  name: string;
  path: string;
  content: string;
}

const COMMANDS_DIR = 'synaptic';

/**
 * Load all custom commands from synaptic/ directory
 */
export function loadCustomCommands(cwd: string = process.cwd()): CustomCommand[] {
  const commandsPath = path.join(cwd, COMMANDS_DIR);

  if (!fs.existsSync(commandsPath)) {
    return [];
  }

  try {
    const files = fs.readdirSync(commandsPath);
    const commands: CustomCommand[] = [];

    for (const file of files) {
      if (!file.endsWith('.md')) continue;

      const filePath = path.join(commandsPath, file);
      const stat = fs.statSync(filePath);

      if (!stat.isFile()) continue;

      const name = file.replace(/\.md$/, '');
      const content = fs.readFileSync(filePath, 'utf-8');

      commands.push({ name, path: filePath, content });
    }

    return commands;
  } catch {
    return [];
  }
}

/**
 * Get a specific custom command by name
 */
export function getCustomCommand(name: string, cwd: string = process.cwd()): CustomCommand | null {
  const commandPath = path.join(cwd, COMMANDS_DIR, `${name}.md`);

  if (!fs.existsSync(commandPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(commandPath, 'utf-8');
    return { name, path: commandPath, content };
  } catch {
    return null;
  }
}

/**
 * Get all custom command names (for autocomplete)
 */
export function getCustomCommandNames(cwd: string = process.cwd()): string[] {
  return loadCustomCommands(cwd).map(cmd => cmd.name);
}

/**
 * Check if a command is a custom command
 */
export function isCustomCommand(name: string, cwd: string = process.cwd()): boolean {
  return getCustomCommand(name, cwd) !== null;
}

/**
 * Expand a custom command with arguments and variables
 */
export function expandCustomCommand(
  command: CustomCommand,
  args: string,
  variables?: Record<string, string>
): string {
  let content = command.content;

  // Replace $ARGUMENTS with the provided arguments
  content = content.replace(/\$ARGUMENTS/g, args || '');

  // Replace $CWD with current working directory
  content = content.replace(/\$CWD/g, process.cwd());

  // Replace $DATE with today's date
  const today = new Date().toISOString().split('T')[0];
  content = content.replace(/\$DATE/g, today);

  // Replace any custom variables
  if (variables) {
    for (const [key, value] of Object.entries(variables)) {
      content = content.replace(new RegExp(`\\$${key}`, 'g'), value);
    }
  }

  return content.trim();
}

/**
 * Execute a custom command - returns the expanded prompt to send to LLM
 */
export function executeCustomCommand(
  name: string,
  args: string,
  cwd: string = process.cwd()
): { success: true; prompt: string } | { success: false; error: string } {
  const command = getCustomCommand(name, cwd);

  if (!command) {
    return { success: false, error: `Custom command not found: ${name}` };
  }

  const prompt = expandCustomCommand(command, args);

  return { success: true, prompt };
}
