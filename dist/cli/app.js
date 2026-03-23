import * as readline from 'readline';
import chalk from 'chalk';
import ora from 'ora';
import { getTextContent } from '../llm/types.js';
import { ConversationManager } from '../core/conversation.js';
import { TodoManager } from '../core/todo.js';
import { setTodoManager } from '../tools/todo.js';
import { getProviderModel, setProviderModel, getProviderBaseUrl, getClientArgs, isCloudProvider, } from '../config/settings.js';
import { renderMarkdown, renderToolCall, renderToolResult, renderTodo, renderError, renderSuccess, renderPrompt, renderDivider, } from './renderer.js';
import { selectOption, selectProvider } from './selector.js';
import { createClient } from '../llm/client.js';
import { CommandAutocomplete } from './autocomplete.js';
import { printBanner, printStartupInfo } from './banner.js';
export class App {
    settings;
    client;
    tools;
    conversation;
    todoManager;
    systemPrompt;
    rl;
    running = false;
    constructor(config) {
        this.settings = config.settings;
        this.client = config.client;
        this.tools = config.tools;
        this.conversation = new ConversationManager(config.settings);
        this.todoManager = new TodoManager();
        setTodoManager(this.todoManager);
        this.systemPrompt =
            config.systemPrompt ||
                `You are a helpful coding assistant running locally. You have access to tools for:
- Reading, writing, and editing files
- Running bash commands
- Searching files with glob and grep
- Web search and fetching URLs
- Managing a todo list to track tasks

When working on tasks:
1. Use the todo list to track progress
2. Read files before editing them
3. Run tests after making changes
4. Be concise but thorough

Current working directory: ${process.cwd()}`;
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        this.conversation.create(this.systemPrompt);
    }
    async start() {
        this.running = true;
        printBanner('default');
        printStartupInfo(this.settings.provider, getProviderModel(this.settings), this.tools.list().length);
        console.log(renderDivider());
        this.promptLoop();
    }
    promptLoop() {
        if (!this.running)
            return;
        this.rl.question(renderPrompt(), async (input) => {
            if (!this.running)
                return;
            const trimmed = input.trim();
            if (!trimmed) {
                this.promptLoop();
                return;
            }
            // Handle slash command with autocomplete
            if (trimmed === '/') {
                await this.showCommandSelector();
                this.promptLoop();
                return;
            }
            // Handle commands
            if (trimmed.startsWith('/')) {
                await this.handleCommand(trimmed);
                this.promptLoop();
                return;
            }
            // Process user message
            await this.processMessage(trimmed);
            this.promptLoop();
        });
    }
    async showCommandSelector() {
        this.rl.pause();
        const autocomplete = new CommandAutocomplete();
        const selected = await autocomplete.select();
        this.rl.resume();
        if (selected) {
            await this.handleCommand(selected);
        }
    }
    async handleCommand(input) {
        const [cmd, ...args] = input.slice(1).split(' ');
        switch (cmd.toLowerCase()) {
            case 'help':
                this.showHelp();
                break;
            case 'quit':
            case 'exit':
            case 'q':
                this.quit();
                break;
            case 'clear':
                console.clear();
                break;
            case 'new':
                this.conversation.create(this.systemPrompt);
                console.log(renderSuccess('Started new conversation'));
                break;
            case 'save':
                this.conversation.save();
                console.log(renderSuccess('Conversation saved'));
                break;
            case 'todo':
                console.log('\n' + renderTodo(this.todoManager.getAll()) + '\n');
                break;
            case 'history':
                const convs = this.conversation.list();
                if (convs.length === 0) {
                    console.log(chalk.dim('No saved conversations'));
                }
                else {
                    console.log(chalk.bold('\nSaved conversations:\n'));
                    convs.slice(0, 10).forEach((c, i) => {
                        console.log(`${chalk.dim(`${i + 1}.`)} ${c.title} ${chalk.dim(`(${new Date(c.updatedAt).toLocaleDateString()})`)}`);
                    });
                    console.log();
                }
                break;
            case 'model':
                if (args.length > 0) {
                    setProviderModel(this.settings, args.join(' '));
                    console.log(renderSuccess(`Model set to: ${args.join(' ')}`));
                }
                else {
                    await this.selectModel();
                }
                break;
            case 'models':
                const spinner = ora('Fetching models...').start();
                try {
                    const models = await this.client.listModels();
                    spinner.stop();
                    console.log(chalk.bold('\nAvailable models:\n'));
                    models.forEach((m) => console.log(`  ${m}`));
                    console.log();
                }
                catch (error) {
                    spinner.fail('Failed to fetch models');
                }
                break;
            case 'provider':
                await this.selectProvider();
                break;
            case 'tools':
                console.log(chalk.bold('\nAvailable tools:\n'));
                this.tools.list().forEach((t) => console.log(`  ${t}`));
                console.log();
                break;
            case 'config':
                console.log(chalk.bold('\nCurrent Configuration:\n'));
                console.log(`  Provider: ${chalk.cyan(this.settings.provider)}`);
                console.log(`  Model: ${chalk.cyan(getProviderModel(this.settings))}`);
                if (!isCloudProvider(this.settings.provider)) {
                    console.log(`  Base URL: ${chalk.dim(getProviderBaseUrl(this.settings))}`);
                }
                console.log(`  Max Context: ${this.settings.maxContextTokens} tokens`);
                console.log(`  Streaming: ${this.settings.streamingEnabled ? chalk.green('enabled') : chalk.red('disabled')}`);
                console.log();
                break;
            default:
                console.log(renderError(`Unknown command: ${cmd}`));
                console.log(chalk.dim('Type /help for available commands'));
        }
    }
    showHelp() {
        console.log(`
${chalk.bold('Commands:')}
  ${chalk.cyan('/help')}      Show this help
  ${chalk.cyan('/quit')}      Exit the application
  ${chalk.cyan('/clear')}     Clear the screen
  ${chalk.cyan('/new')}       Start a new conversation
  ${chalk.cyan('/save')}      Save current conversation
  ${chalk.cyan('/todo')}      Show todo list
  ${chalk.cyan('/history')}   Show saved conversations
  ${chalk.cyan('/model')}     Select model (interactive GUI)
  ${chalk.cyan('/models')}    List available models
  ${chalk.cyan('/provider')}  Switch provider (Ollama/LM Studio)
  ${chalk.cyan('/tools')}     List available tools
`);
    }
    async processMessage(input) {
        this.conversation.addMessage({ role: 'user', content: input });
        const spinner = ora({ text: 'Thinking...', color: 'cyan' }).start();
        try {
            // Get context (potentially compressed)
            const messages = this.conversation.getContextMessages();
            if (this.settings.streamingEnabled) {
                spinner.stop();
                await this.streamResponse(messages);
            }
            else {
                const response = await this.client.chat({
                    model: '',
                    messages,
                    tools: this.tools.getDefinitions(),
                    tool_choice: 'auto',
                });
                spinner.stop();
                await this.handleResponse(response.choices[0]?.message);
            }
        }
        catch (error) {
            spinner.fail('Error');
            console.log(renderError(error instanceof Error ? error.message : String(error)));
        }
    }
    async streamResponse(messages) {
        process.stdout.write('\n');
        let fullContent = '';
        const response = await this.client.chatStream({
            model: '',
            messages,
            tools: this.tools.getDefinitions(),
            tool_choice: 'auto',
        }, (chunk) => {
            process.stdout.write(chunk);
            fullContent += chunk;
        });
        process.stdout.write('\n\n');
        const { message } = response;
        // Handle tool calls if any
        if (message.tool_calls && message.tool_calls.length > 0) {
            this.conversation.addMessage(message);
            await this.executeToolCalls(message.tool_calls);
        }
        else {
            this.conversation.addMessage({ role: 'assistant', content: fullContent });
        }
    }
    async handleResponse(message) {
        if (!message) {
            console.log(renderError('No response from model'));
            return;
        }
        this.conversation.addMessage(message);
        // Handle tool calls
        if (message.tool_calls && message.tool_calls.length > 0) {
            await this.executeToolCalls(message.tool_calls);
            return;
        }
        // Display response
        if (message.content) {
            console.log('\n' + renderMarkdown(getTextContent(message.content)) + '\n');
        }
    }
    async executeToolCalls(toolCalls) {
        for (const tc of toolCalls) {
            console.log(renderToolCall(tc.function.name, tc.function.arguments));
            const spinner = ora({ text: 'Executing...', color: 'yellow' }).start();
            try {
                const result = await this.tools.execute(tc);
                spinner.stop();
                const parsed = JSON.parse(result);
                const isError = 'error' in parsed;
                console.log(renderToolResult(result, isError));
                this.conversation.addMessage({
                    role: 'tool',
                    tool_call_id: tc.id,
                    content: result,
                });
            }
            catch (error) {
                spinner.fail('Tool failed');
                const errorResult = JSON.stringify({
                    error: error instanceof Error ? error.message : String(error),
                });
                this.conversation.addMessage({
                    role: 'tool',
                    tool_call_id: tc.id,
                    content: errorResult,
                });
            }
        }
        // Continue conversation after tool execution
        await this.processMessage('');
    }
    async selectModel() {
        const spinner = ora('Fetching models...').start();
        try {
            const models = await this.client.listModels();
            spinner.stop();
            if (models.length === 0) {
                console.log(renderError('No models available'));
                return;
            }
            const currentModel = getProviderModel(this.settings);
            const options = models.map((m) => ({
                label: m,
                value: m,
            }));
            // Temporarily close readline for raw mode
            this.rl.pause();
            const selected = await selectOption('Select Model', options, currentModel);
            this.rl.resume();
            if (selected) {
                setProviderModel(this.settings, selected);
                // Recreate client with new model
                const { baseUrlOrApiKey, model } = getClientArgs(this.settings);
                this.client = createClient(this.settings.provider, baseUrlOrApiKey, model);
                console.log(renderSuccess(`Model changed to: ${selected}`));
            }
            else {
                console.log(chalk.dim('Model selection cancelled'));
            }
        }
        catch (error) {
            spinner.fail('Failed to fetch models');
        }
    }
    async selectProvider() {
        this.rl.pause();
        const selected = await selectProvider();
        this.rl.resume();
        if (selected) {
            this.settings.provider = selected;
            const { baseUrlOrApiKey, model } = getClientArgs(this.settings);
            this.client = createClient(this.settings.provider, baseUrlOrApiKey, model);
            console.log(renderSuccess(`Provider changed to: ${selected}`));
            console.log(chalk.dim(`  Model: ${model}`));
            if (!isCloudProvider(this.settings.provider)) {
                console.log(chalk.dim(`  URL: ${baseUrlOrApiKey}`));
            }
        }
        else {
            console.log(chalk.dim('Provider selection cancelled'));
        }
    }
    quit() {
        this.running = false;
        console.log(chalk.dim('\nGoodbye!\n'));
        this.rl.close();
        process.exit(0);
    }
}
//# sourceMappingURL=app.js.map