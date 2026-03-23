import chalk from 'chalk';
import { highlight } from 'cli-highlight';
import { marked } from 'marked';
import { markedTerminal } from 'marked-terminal';
// Configure marked with terminal renderer
marked.use(markedTerminal({
    code: (code, lang) => {
        try {
            return highlight(code, { language: lang || 'plaintext', ignoreIllegals: true });
        }
        catch {
            return code;
        }
    },
    codespan: (code) => chalk.cyan(code),
    strong: (text) => chalk.bold(text),
    em: (text) => chalk.italic(text),
    heading: (text, level) => {
        const prefix = '#'.repeat(level);
        return chalk.bold.blue(`${prefix} ${text}\n`);
    },
    listitem: (text) => `  ${chalk.yellow('•')} ${text}`,
    link: (href, _title, text) => `${text} ${chalk.dim(`(${href})`)}`,
    hr: () => chalk.dim('─'.repeat(50)),
    blockquote: (text) => text
        .split('\n')
        .map((line) => chalk.dim('│ ') + chalk.italic(line))
        .join('\n'),
}));
export function renderMarkdown(text) {
    try {
        return marked.parse(text);
    }
    catch {
        return text;
    }
}
export function renderCode(code, language) {
    try {
        return highlight(code, {
            language: language || 'plaintext',
            ignoreIllegals: true,
        });
    }
    catch {
        return code;
    }
}
export function renderToolCall(name, args) {
    return [
        chalk.dim('┌─') + chalk.yellow(` Tool: ${name} `),
        chalk.dim('│'),
        ...args.split('\n').map((line) => chalk.dim('│ ') + chalk.gray(line)),
        chalk.dim('└─'),
    ].join('\n');
}
export function renderToolResult(result, isError = false) {
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
export function renderTodo(todos) {
    if (todos.length === 0) {
        return chalk.dim('No tasks');
    }
    const statusIcon = (status) => {
        switch (status) {
            case 'completed':
                return chalk.green('✓');
            case 'in_progress':
                return chalk.yellow('→');
            default:
                return chalk.dim('○');
        }
    };
    const statusColor = (status, text) => {
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
        .map((t, i) => `${chalk.dim(`${i + 1}.`)} [${statusIcon(t.status)}] ${statusColor(t.status, t.content)}`)
        .join('\n');
}
export function renderError(error) {
    return chalk.red(`Error: ${error}`);
}
export function renderInfo(text) {
    return chalk.blue(`ℹ ${text}`);
}
export function renderSuccess(text) {
    return chalk.green(`✓ ${text}`);
}
export function renderWarning(text) {
    return chalk.yellow(`⚠ ${text}`);
}
export function renderPrompt() {
    return chalk.cyan('❯ ');
}
export function renderThinking() {
    return chalk.dim('Thinking...');
}
export function renderDivider() {
    return chalk.dim('─'.repeat(50));
}
//# sourceMappingURL=renderer.js.map