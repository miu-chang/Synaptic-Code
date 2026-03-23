import chalk from 'chalk';
import * as readline from 'readline';

export interface Command {
  name: string;
  description: string;
  aliases?: string[];
}

export const COMMANDS: Command[] = [
  { name: 'help', description: 'Show available commands', aliases: ['h', '?'] },
  { name: 'quit', description: 'Exit the application', aliases: ['q', 'exit'] },
  { name: 'clear', description: 'Clear the screen', aliases: ['cls'] },
  { name: 'new', description: 'Start a new conversation' },
  { name: 'save', description: 'Save current conversation' },
  { name: 'todo', description: 'Show todo list' },
  { name: 'history', description: 'Show saved conversations' },
  { name: 'model', description: 'Select model (interactive)' },
  { name: 'models', description: 'List available models' },
  { name: 'provider', description: 'Switch provider' },
  { name: 'tools', description: 'List available tools' },
  { name: 'config', description: 'Show current configuration' },
];

export function filterCommands(input: string): Command[] {
  const query = input.toLowerCase().replace(/^\//, '');

  if (!query) {
    return COMMANDS;
  }

  return COMMANDS.filter((cmd) => {
    if (cmd.name.startsWith(query)) return true;
    if (cmd.aliases?.some((a) => a.startsWith(query))) return true;
    return false;
  });
}

export function formatCommandList(commands: Command[], selectedIndex: number): string {
  if (commands.length === 0) {
    return chalk.dim('  No matching commands');
  }

  return commands
    .map((cmd, i) => {
      const isSelected = i === selectedIndex;
      const prefix = isSelected ? chalk.cyan('❯ ') : '  ';
      const name = isSelected ? chalk.bold.cyan(`/${cmd.name}`) : chalk.cyan(`/${cmd.name}`);
      const desc = chalk.dim(` - ${cmd.description}`);
      return `${prefix}${name}${desc}`;
    })
    .join('\n');
}

export class CommandAutocomplete {
  private selectedIndex = 0;
  private commands: Command[] = [];
  private input = '/';
  private displayedLines = 0;

  async select(): Promise<string | null> {
    this.input = '/';
    this.selectedIndex = 0;
    this.commands = filterCommands(this.input);

    // Show initial list
    this.render();

    return new Promise((resolve) => {
      // Enable raw mode
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }
      readline.emitKeypressEvents(process.stdin);

      const onKeypress = (str: string | undefined, key: readline.Key) => {
        if (!key) return;

        // Up arrow
        if (key.name === 'up') {
          this.selectedIndex = (this.selectedIndex - 1 + this.commands.length) % this.commands.length;
          this.render();
        }
        // Down arrow
        else if (key.name === 'down') {
          this.selectedIndex = (this.selectedIndex + 1) % this.commands.length;
          this.render();
        }
        // Tab - complete
        else if (key.name === 'tab') {
          if (this.commands.length > 0) {
            this.input = '/' + this.commands[this.selectedIndex].name;
            this.render();
          }
        }
        // Enter - select
        else if (key.name === 'return') {
          cleanup();
          this.clearRender();
          if (this.commands.length > 0) {
            resolve('/' + this.commands[this.selectedIndex].name);
          } else {
            resolve(null);
          }
        }
        // Escape - cancel
        else if (key.name === 'escape') {
          cleanup();
          this.clearRender();
          resolve(null);
        }
        // Ctrl+C
        else if (key.ctrl && key.name === 'c') {
          cleanup();
          this.clearRender();
          resolve(null);
        }
        // Backspace
        else if (key.name === 'backspace') {
          if (this.input.length > 1) {
            this.input = this.input.slice(0, -1);
            this.selectedIndex = 0;
            this.commands = filterCommands(this.input);
            this.render();
          } else {
            cleanup();
            this.clearRender();
            resolve(null);
          }
        }
        // Regular character
        else if (str && str.length === 1 && str >= ' ' && str <= '~') {
          this.input += str;
          this.selectedIndex = 0;
          this.commands = filterCommands(this.input);
          this.render();
        }
      };

      const cleanup = () => {
        process.stdin.removeListener('keypress', onKeypress);
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(false);
        }
      };

      process.stdin.on('keypress', onKeypress);
    });
  }

  private render(): void {
    this.clearRender();

    const commandListStr = formatCommandList(this.commands, this.selectedIndex);
    const commandListLines = commandListStr.split('\n').length;

    const lines = [
      '',
      chalk.dim('  ↑↓ navigate • Enter select • Esc cancel'),
      '',
      commandListStr,
      '',
      chalk.dim('  Input: ') + chalk.cyan(this.input),
    ];

    const output = lines.join('\n');
    console.log(output);
    // 5 fixed lines + command list lines
    this.displayedLines = 5 + commandListLines;
  }

  private clearRender(): void {
    if (this.displayedLines > 0) {
      // Move cursor up and clear lines
      process.stdout.write(`\x1B[${this.displayedLines}A`);
      for (let i = 0; i < this.displayedLines; i++) {
        process.stdout.write('\x1B[2K\n');
      }
      process.stdout.write(`\x1B[${this.displayedLines}A`);
      this.displayedLines = 0;
    }
  }
}
