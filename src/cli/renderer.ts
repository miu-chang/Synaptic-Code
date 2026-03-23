import chalk from 'chalk';
import { highlight } from 'cli-highlight';
import { marked } from 'marked';
import { markedTerminal } from 'marked-terminal';

// Configure marked with terminal renderer
marked.use(
  markedTerminal({
    code: (code: string, lang?: string) => {
      try {
        return highlight(code, { language: lang || 'plaintext', ignoreIllegals: true });
      } catch {
        return code;
      }
    },
    codespan: (code: string) => chalk.cyan(code),
    strong: (text: string) => chalk.bold(text),
    em: (text: string) => chalk.italic(text),
    heading: (text: string, level: number) => {
      const prefix = '#'.repeat(level);
      return chalk.bold.blue(`${prefix} ${text}\n`);
    },
    listitem: (text: string) => `  ${chalk.yellow('•')} ${text}`,
    link: (href: string, _title: string | null, text: string) =>
      `${text} ${chalk.dim(`(${href})`)}`,
    hr: () => chalk.dim('─'.repeat(50)),
    blockquote: (text: string) =>
      text
        .split('\n')
        .map((line) => chalk.dim('│ ') + chalk.italic(line))
        .join('\n'),
  })
);

export function renderMarkdown(text: string): string {
  try {
    return marked.parse(text) as string;
  } catch {
    return text;
  }
}

export function renderCode(code: string, language?: string): string {
  try {
    return highlight(code, {
      language: language || 'plaintext',
      ignoreIllegals: true,
    });
  } catch {
    return code;
  }
}

export function renderToolCall(name: string, args: string): string {
  return [
    chalk.dim('┌─') + chalk.yellow(` Tool: ${name} `),
    chalk.dim('│'),
    ...args.split('\n').map((line) => chalk.dim('│ ') + chalk.gray(line)),
    chalk.dim('└─'),
  ].join('\n');
}

export function renderToolResult(result: string, isError = false): string {
  const color = isError ? chalk.red : chalk.green;
  const icon = isError ? '✗' : '✓';

  const lines = result.split('\n');
  const truncated = lines.length > 20;
  const displayLines = truncated ? lines.slice(0, 20) : lines;

  return [
    chalk.dim('┌─') + color(` ${icon} Result `),
    chalk.dim('│'),
    ...displayLines.map((line) => chalk.dim('│ ') + line),
    ...(truncated ? [chalk.dim('│ ') + chalk.yellow(`... ${lines.length - 20} more lines`)] : []),
    chalk.dim('└─'),
  ].join('\n');
}

export function renderTodo(
  todos: { content: string; status: 'pending' | 'in_progress' | 'completed' }[]
): string {
  if (todos.length === 0) {
    return chalk.dim('No tasks');
  }

  const statusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return chalk.green('✓');
      case 'in_progress':
        return chalk.yellow('→');
      default:
        return chalk.dim('○');
    }
  };

  const statusColor = (status: string, text: string) => {
    switch (status) {
      case 'completed':
        return chalk.strikethrough.dim(text);
      case 'in_progress':
        return chalk.yellow(text);
      default:
        return text;
    }
  };

  return todos
    .map(
      (t, i) =>
        `${chalk.dim(`${i + 1}.`)} [${statusIcon(t.status)}] ${statusColor(t.status, t.content)}`
    )
    .join('\n');
}

export function renderError(error: string): string {
  return chalk.red(`Error: ${error}`);
}

export function renderInfo(text: string): string {
  return chalk.blue(`ℹ ${text}`);
}

export function renderSuccess(text: string): string {
  return chalk.green(`✓ ${text}`);
}

export function renderWarning(text: string): string {
  return chalk.yellow(`⚠ ${text}`);
}

export function renderPrompt(): string {
  return chalk.cyan('❯ ');
}

export function renderThinking(): string {
  return chalk.dim('Thinking...');
}

export function renderDivider(): string {
  return chalk.dim('─'.repeat(50));
}
