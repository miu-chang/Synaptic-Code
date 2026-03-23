#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { loadSettings, saveSettings, getClientArgs, getProviderModel, setProviderModel, getProviderName, getProviderBaseUrl, isCloudProvider, isRemoteMode, } from './config/settings.js';
import { createClient, createRemoteClient } from './llm/client.js';
import { ToolRegistry } from './tools/registry.js';
import { fileTools } from './tools/file.js';
import { bashTools } from './tools/bash.js';
import { webTools } from './tools/web.js';
import { todoTools } from './tools/todo.js';
import { startInkApp } from './cli/ink-app.js';
import * as lms from './lms/client.js';
import { runSetupWizard, isFirstRun } from './cli/setup.js';
import * as apiServer from './server/index.js';
import { getLicenseStatus, startTrial, activateLicense } from './license/index.js';
import { t, format, setLanguage, detectSystemLanguage } from './i18n/index.js';
import * as readline from 'readline';
const program = new Command();
program
    .name('synaptic')
    .description('Synaptic Code - Local LLM-powered coding assistant')
    .version('0.1.0');
/**
 * Ensure LM Studio server is ready before starting chat
 * Note: Model loading is handled in App.tsx after banner display
 */
async function ensureLmsReady(settings) {
    // Only check for lmstudio provider
    if (settings.provider !== 'lmstudio') {
        return true;
    }
    // Check if lms CLI is available
    if (!lms.isLmsInstalled()) {
        // Will try direct connection in App.tsx
        return true;
    }
    // Check server status
    const serverRunning = await lms.isServerRunning();
    if (!serverRunning) {
        console.log(chalk.cyan('\n  [*] LM Studio server not running'));
        console.log(chalk.dim('  Starting server...'));
        const result = await lms.startServer();
        if (!result.success) {
            console.log(chalk.red(`  Failed: ${result.message}`));
            return false;
        }
        // Wait for server to be ready
        process.stdout.write(chalk.dim('  Waiting for server'));
        for (let i = 0; i < 15; i++) {
            await new Promise((r) => setTimeout(r, 500));
            process.stdout.write(chalk.dim('.'));
            if (await lms.isServerRunning()) {
                console.log(chalk.green(' Ready!\n'));
                break;
            }
        }
        if (!(await lms.isServerRunning())) {
            console.log(chalk.red('\n  Server failed to start'));
            return false;
        }
    }
    // Model loading is now handled in App.tsx after banner display
    return true;
}
const VALID_PROVIDERS = ['ollama', 'lmstudio', 'openai-local', 'openai', 'anthropic', 'google'];
/**
 * Simple prompt for user input
 */
function prompt(question) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer);
        });
    });
}
/**
 * Check license and prompt for activation if needed
 */
async function checkLicenseOnStartup() {
    // Set language from system
    setLanguage(detectSystemLanguage());
    const L = t().license;
    const status = getLicenseStatus();
    if (status.status === 'valid') {
        return status;
    }
    if (status.status === 'offline') {
        return status;
    }
    // Trial or no license - show license screen
    const isTrial = status.status === 'trial';
    // Show ASCII banner
    const BORDER = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    console.log('');
    console.log(chalk.cyan(` ${BORDER}`));
    console.log('');
    console.log(chalk.magenta('   ███████╗██╗   ██╗███╗   ██╗ █████╗ ██████╗ ████████╗██╗ ██████╗'));
    console.log(chalk.magenta('   ██╔════╝╚██╗ ██╔╝████╗  ██║██╔══██╗██╔══██╗╚══██╔══╝██║██╔════╝'));
    console.log(chalk.blueBright('   ███████╗ ╚████╔╝ ██╔██╗ ██║███████║██████╔╝   ██║   ██║██║     '));
    console.log(chalk.blueBright('   ╚════██║  ╚██╔╝  ██║╚██╗██║██╔══██║██╔═══╝    ██║   ██║██║     '));
    console.log(chalk.magenta('   ███████║   ██║   ██║ ╚████║██║  ██║██║        ██║   ██║╚██████╗'));
    console.log(chalk.magenta('   ╚══════╝   ╚═╝   ╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝        ╚═╝   ╚═╝ ╚═════╝'));
    console.log('');
    console.log(chalk.cyan('    ██████╗ ██████╗ ██████╗ ███████╗'));
    console.log(chalk.cyan('   ██╔════╝██╔═══██╗██╔══██╗██╔════╝'));
    console.log(chalk.blueBright('   ██║     ██║   ██║██║  ██║█████╗  '));
    console.log(chalk.blueBright('   ██║     ██║   ██║██║  ██║██╔══╝  '));
    console.log(chalk.cyan('   ╚██████╗╚██████╔╝██████╔╝███████╗'));
    console.log(chalk.cyan('    ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝'));
    console.log('');
    console.log(chalk.cyan(` ${BORDER}`));
    console.log('');
    console.log(chalk.dim(' v0.1.0 • Local LLM Coding Assistant'));
    console.log('');
    const PURCHASE_URL = 'https://synaptic-ai.net';
    if (isTrial) {
        console.log(chalk.yellow(` ⏳ ${format(L.trialDaysRemaining, { days: String(status.trialDays) })}\n`));
        console.log(chalk.dim(`   ${L.continueTrial}\n`));
    }
    else if (status.status === 'expired') {
        console.log(chalk.red(` ✗ ${L.trialExpired}\n`));
    }
    else {
        console.log(chalk.yellow(` ⚠ ${L.statusNone}\n`));
    }
    // Show purchase hint
    console.log(chalk.dim(`   ${L.needLicense} ${chalk.cyan('b')} → ${PURCHASE_URL}\n`));
    // Different prompt for trial vs new user
    const promptText = isTrial
        ? chalk.cyan(' [Y/c/b/n] ') + chalk.dim('Enter=activate, c=continue, b=buy, n=exit: ')
        : chalk.cyan(' [Y/t/b/n] ') + chalk.dim('Enter=activate, t=trial, b=buy, n=exit: ');
    const answer = await prompt(promptText);
    const choice = answer.toLowerCase().trim();
    // Enter (empty) or 'y' = activate license
    if (choice === '' || choice === 'y' || choice === 'yes') {
        // Prompt for license key
        console.log(chalk.dim(`\n  ${L.enterKey}`));
        const key = await prompt(chalk.cyan('  License key: '));
        if (!key.trim()) {
            console.log(chalk.red('\n  Exiting.\n'));
            return null;
        }
        console.log(chalk.dim(`  ${L.activating}`));
        const result = await activateLicense(key.trim());
        if (result.success) {
            console.log(chalk.green(`\n  ✓ ${L.activationSuccess}\n`));
            return result.info;
        }
        else {
            console.log(chalk.red(`\n  ✗ ${format(L.activationFailed, { error: result.message || 'Unknown error' })}\n`));
            return null;
        }
    }
    // Continue trial (for existing trial users)
    if (isTrial && (choice === 'c' || choice === 'continue')) {
        console.log(chalk.green(`\n  ✓ ${format(L.trialDaysRemaining, { days: String(status.trialDays) })}\n`));
        return status;
    }
    // Open purchase page in browser
    if (choice === 'b' || choice === 'buy') {
        const { exec } = await import('child_process');
        const { platform } = await import('os');
        const os = platform();
        // Open URL in default browser
        const openCommand = os === 'darwin' ? 'open' : os === 'win32' ? 'start' : 'xdg-open';
        exec(`${openCommand} ${PURCHASE_URL}`);
        console.log(chalk.green(`\n  ✓ ${format(L.purchaseUrl, { url: PURCHASE_URL })}\n`));
        return null;
    }
    // Start new trial (for new users - requires online registration)
    if (!isTrial && (choice === 't' || choice === 'trial')) {
        console.log(chalk.dim(`  ${L.registering}`));
        const trialInfo = await startTrial();
        if (trialInfo.status === 'trial') {
            console.log(chalk.green(`\n  ✓ ${format(L.trialStarted, { days: String(trialInfo.trialDays) })}\n`));
            return trialInfo;
        }
        else if (trialInfo.status === 'expired') {
            console.log(chalk.red(`\n  ${L.trialExpired}\n`));
            return null;
        }
        else if (trialInfo.status === 'none') {
            console.log(chalk.red(`\n  ✗ ${L.networkRequired}\n`));
            return null;
        }
        else {
            // invalid or other status
            console.log(chalk.red(`\n  ✗ ${L.trialExpired}\n`));
            return null;
        }
    }
    console.log(chalk.dim('\n  Exiting.\n'));
    return null;
}
program
    .command('chat')
    .description('Start interactive chat session')
    .option('-m, --model <model>', 'Override the model')
    .option('-p, --provider <provider>', 'Use specific provider (ollama, lmstudio, openai-local, openai, anthropic, google)')
    .option('-r, --remote <url>', 'Connect to remote Synaptic server (e.g., http://server:8080)')
    .option('-k, --api-key <key>', 'API key for remote server')
    .option('--skip-license', 'Skip license check (development only)')
    .action(async (options) => {
    // Check license first (unless skipped)
    let licenseStatus;
    if (!options.skipLicense) {
        const result = await checkLicenseOnStartup();
        if (!result) {
            process.exit(1);
        }
        licenseStatus = result;
    }
    const settings = loadSettings();
    // Check if current directory is a git repo (sync, before Ink)
    const { existsSync } = await import('fs');
    const isGitRepo = existsSync('.git');
    // Initialize Synaptic ecosystem before Ink (to avoid re-render)
    const synaptic = await import('./synaptic/index.js');
    const { message: synapticStatus, tools: synapticTools } = await synaptic.initSynaptic();
    // Handle --remote option (temporary override)
    if (options.remote) {
        const apiKey = options.apiKey || settings.remote?.apiKey;
        if (!apiKey) {
            console.error(chalk.red('\n  API key required for remote connection'));
            console.error(chalk.dim('  Use: synaptic chat --remote <url> --api-key <key>'));
            console.error(chalk.dim('  Or configure: synaptic config set remote.url <url> && synaptic config set remote.apiKey <key>\n'));
            process.exit(1);
        }
        console.log(chalk.dim(`\n  Connecting to remote: ${options.remote}\n`));
        const client = createRemoteClient({ url: options.remote, apiKey, model: options.model });
        const tools = new ToolRegistry();
        tools.registerMultiple(fileTools);
        tools.registerMultiple(bashTools);
        tools.registerMultiple(webTools);
        tools.registerMultiple(todoTools);
        if (synapticTools.length > 0)
            tools.registerMultiple(synapticTools);
        await startInkApp({ settings, client, tools, licenseStatus, isGitRepo, synapticStatus });
        return;
    }
    // Check if running in configured remote mode
    if (isRemoteMode(settings)) {
        console.log(chalk.dim(`\n  Connecting to remote: ${settings.remote.url}\n`));
        const client = createRemoteClient(settings.remote);
        const tools = new ToolRegistry();
        tools.registerMultiple(fileTools);
        tools.registerMultiple(bashTools);
        tools.registerMultiple(webTools);
        tools.registerMultiple(todoTools);
        if (synapticTools.length > 0)
            tools.registerMultiple(synapticTools);
        await startInkApp({ settings, client, tools, licenseStatus, isGitRepo, synapticStatus });
        return;
    }
    if (options.provider) {
        if (!VALID_PROVIDERS.includes(options.provider)) {
            console.error(chalk.red(`Invalid provider: ${options.provider}`));
            console.error(chalk.dim(`Valid providers: ${VALID_PROVIDERS.join(', ')}`));
            process.exit(1);
        }
        settings.provider = options.provider;
    }
    if (options.model) {
        setProviderModel(settings, options.model);
    }
    // Check API key for cloud providers
    if (isCloudProvider(settings.provider)) {
        const { baseUrlOrApiKey } = getClientArgs(settings);
        if (!baseUrlOrApiKey) {
            console.error(chalk.red(`\n  No API key configured for ${getProviderName(settings)}`));
            console.error(chalk.dim('  Run: synaptic setup\n'));
            process.exit(1);
        }
    }
    // Ensure LM Studio is ready (only for local providers)
    const ready = await ensureLmsReady(settings);
    if (!ready) {
        process.exit(1);
    }
    // Pre-load model for lmstudio provider (before Ink to avoid re-render)
    const initialMessages = [];
    if (settings.provider === 'lmstudio') {
        const lms = await import('./lms/client.js');
        const loadedModels = lms.listLoadedModels();
        if (loadedModels.length === 0) {
            const defaultModel = settings.providers.lmstudio.model;
            if (defaultModel) {
                const contextLength = Math.round(settings.maxContextTokens * 1.1);
                // Spinner animation during model load
                const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
                let spinnerIndex = 0;
                const spinnerInterval = setInterval(() => {
                    process.stdout.write(`\r${chalk.cyan(spinnerFrames[spinnerIndex])} ${chalk.dim(`Loading model: ${defaultModel}...`)}`);
                    spinnerIndex = (spinnerIndex + 1) % spinnerFrames.length;
                }, 80);
                const result = await lms.loadModel(defaultModel, { contextLength });
                clearInterval(spinnerInterval);
                process.stdout.write('\r' + ' '.repeat(60) + '\r'); // Clear spinner line
                if (result.success) {
                    initialMessages.push({ type: 'info', content: `Model loaded: ${defaultModel} (ctx: ${contextLength})` });
                }
                else {
                    initialMessages.push({ type: 'error', content: `Failed to load model: ${result.message}` });
                }
            }
        }
    }
    // Check for updates (non-blocking)
    const { checkForUpdates } = await import('./version/index.js');
    const versionInfo = await checkForUpdates();
    if (versionInfo?.updateAvailable) {
        initialMessages.push({
            type: 'info',
            content: `Update available: v${versionInfo.latestVersion} (current: v${versionInfo.currentVersion})${versionInfo.downloadUrl ? ` - ${versionInfo.downloadUrl}` : ''}`
        });
    }
    const { baseUrlOrApiKey, model } = getClientArgs(settings);
    const client = createClient(settings.provider, baseUrlOrApiKey, model);
    // Register all tools
    const tools = new ToolRegistry();
    tools.registerMultiple(fileTools);
    tools.registerMultiple(bashTools);
    tools.registerMultiple(webTools);
    tools.registerMultiple(todoTools);
    if (synapticTools.length > 0)
        tools.registerMultiple(synapticTools);
    await startInkApp({ settings, client, tools, licenseStatus, isGitRepo, synapticStatus, initialMessages });
});
program
    .command('config')
    .description('Show or update configuration')
    .argument('[key]', 'Config key to set (e.g., mode, remote.url, remote.apiKey)')
    .argument('[value]', 'Value to set')
    .option('--provider <provider>', 'Set default provider')
    .option('--model <model>', 'Set default model for current provider')
    .option('--show', 'Show current configuration')
    .action((key, value, options) => {
    const settings = loadSettings();
    // Handle key=value style config
    if (key && value) {
        switch (key) {
            case 'mode':
                if (value !== 'local' && value !== 'remote') {
                    console.error(chalk.red('Mode must be "local" or "remote"'));
                    process.exit(1);
                }
                settings.mode = value;
                console.log(chalk.green(`Mode set to: ${value}`));
                if (value === 'remote' && !settings.remote?.url) {
                    console.log(chalk.yellow('  Note: Configure remote URL with: synaptic config remote.url <url>'));
                }
                break;
            case 'remote.url':
                if (!settings.remote)
                    settings.remote = { url: '', apiKey: '' };
                settings.remote.url = value;
                console.log(chalk.green(`Remote URL set to: ${value}`));
                break;
            case 'remote.apiKey':
                if (!settings.remote)
                    settings.remote = { url: '', apiKey: '' };
                settings.remote.apiKey = value;
                console.log(chalk.green('Remote API key configured'));
                break;
            case 'remote.model':
                if (!settings.remote)
                    settings.remote = { url: '', apiKey: '' };
                settings.remote.model = value;
                console.log(chalk.green(`Remote model set to: ${value}`));
                break;
            default:
                console.error(chalk.red(`Unknown config key: ${key}`));
                console.log(chalk.dim('Available keys: mode, remote.url, remote.apiKey, remote.model'));
                process.exit(1);
        }
        saveSettings(settings);
        return;
    }
    if (options.show || (!key && Object.keys(options).length === 0)) {
        console.log(chalk.bold('\nCurrent Configuration:\n'));
        console.log(`  Mode: ${chalk.cyan(settings.mode || 'local')}`);
        if (settings.mode === 'remote' && settings.remote) {
            console.log(`  Remote URL: ${chalk.cyan(settings.remote.url)}`);
            console.log(`  Remote API Key: ${chalk.dim(settings.remote.apiKey ? '****' + settings.remote.apiKey.slice(-4) : 'not set')}`);
            if (settings.remote.model) {
                console.log(`  Remote Model: ${chalk.cyan(settings.remote.model)}`);
            }
        }
        else {
            console.log(`  Provider: ${chalk.cyan(settings.provider)}`);
            console.log(`  Model: ${chalk.cyan(getProviderModel(settings))}`);
            if (!isCloudProvider(settings.provider)) {
                console.log(`  Base URL: ${chalk.dim(getProviderBaseUrl(settings))}`);
            }
        }
        console.log(`  Max Context: ${settings.maxContextTokens} tokens`);
        console.log(`  Streaming: ${settings.streamingEnabled ? 'enabled' : 'disabled'}`);
        console.log();
        return;
    }
    if (options.provider) {
        if (!VALID_PROVIDERS.includes(options.provider)) {
            console.error(chalk.red(`Invalid provider: ${options.provider}`));
            console.error(chalk.dim(`Valid providers: ${VALID_PROVIDERS.join(', ')}`));
            process.exit(1);
        }
        settings.provider = options.provider;
        console.log(chalk.green(`Provider set to: ${options.provider}`));
    }
    if (options.model) {
        setProviderModel(settings, options.model);
        console.log(chalk.green(`Model set to: ${options.model}`));
    }
    saveSettings(settings);
});
program
    .command('models')
    .description('List available models')
    .option('--installed', 'Show installed models (via lms)')
    .option('--loaded', 'Show currently loaded models')
    .action(async (options) => {
    if (options.installed) {
        // Use lms ls
        if (!lms.isLmsInstalled()) {
            console.error(chalk.red('LM Studio CLI not installed'));
            process.exit(1);
        }
        console.log(chalk.bold('\nInstalled Models:\n'));
        const models = lms.listModels();
        if (models.length === 0) {
            console.log(chalk.dim('  No models installed'));
        }
        else {
            models.forEach((m) => {
                const status = m.loaded ? chalk.green(' [LOADED]') : '';
                console.log(`  ${m.name} ${chalk.dim(`(${m.params}, ${m.size})`)}${status}`);
            });
        }
        console.log();
        return;
    }
    if (options.loaded) {
        // Use lms ps
        if (!lms.isLmsInstalled()) {
            console.error(chalk.red('LM Studio CLI not installed'));
            process.exit(1);
        }
        console.log(chalk.bold('\nLoaded Models:\n'));
        const models = lms.listLoadedModels();
        if (models.length === 0) {
            console.log(chalk.dim('  No models loaded'));
        }
        else {
            models.forEach((m) => console.log(`  ${chalk.green(m)}`));
        }
        console.log();
        return;
    }
    // Default: fetch from API
    const settings = loadSettings();
    const { baseUrlOrApiKey, model } = getClientArgs(settings);
    const client = createClient(settings.provider, baseUrlOrApiKey, model);
    try {
        console.log(chalk.dim(`\nFetching models from ${settings.provider}...\n`));
        const models = await client.listModels();
        if (models.length === 0) {
            console.log(chalk.yellow('No models found'));
        }
        else {
            console.log(chalk.bold('Available models:\n'));
            models.forEach((m) => console.log(`  ${m}`));
        }
        console.log();
    }
    catch (error) {
        console.error(chalk.red(`Failed to fetch models: ${error instanceof Error ? error.message : error}`));
        process.exit(1);
    }
});
program
    .command('server')
    .description('Manage LM Studio server')
    .argument('<action>', 'start, stop, or status')
    .action(async (action) => {
    if (!lms.isLmsInstalled()) {
        console.error(chalk.red('LM Studio CLI not installed'));
        console.log(chalk.dim('Install LM Studio from https://lmstudio.ai'));
        process.exit(1);
    }
    switch (action) {
        case 'start': {
            console.log(chalk.dim('Starting LM Studio server...'));
            const result = await lms.startServer();
            if (result.success) {
                console.log(chalk.green('Server started'));
            }
            else {
                console.error(chalk.red(`Failed: ${result.message}`));
                process.exit(1);
            }
            break;
        }
        case 'stop': {
            console.log(chalk.dim('Stopping LM Studio server...'));
            const result = await lms.stopServer();
            if (result.success) {
                console.log(chalk.green('Server stopped'));
            }
            else {
                console.error(chalk.red(`Failed: ${result.message}`));
                process.exit(1);
            }
            break;
        }
        case 'status': {
            const running = await lms.isServerRunning();
            if (running) {
                console.log(chalk.green('\nServer: Running'));
                const loaded = lms.listLoadedModels();
                if (loaded.length > 0) {
                    console.log(chalk.dim('Loaded models:'));
                    loaded.forEach((m) => console.log(`  ${m}`));
                }
                else {
                    console.log(chalk.dim('No models loaded'));
                }
            }
            else {
                console.log(chalk.yellow('\nServer: Not running'));
            }
            console.log();
            break;
        }
        default:
            console.error(chalk.red(`Unknown action: ${action}`));
            console.log(chalk.dim('Use: start, stop, or status'));
            process.exit(1);
    }
});
program
    .command('load <model>')
    .description('Load a model')
    .option('-c, --context <length>', 'Context length in tokens')
    .action(async (model, options) => {
    if (!lms.isLmsInstalled()) {
        console.error(chalk.red('LM Studio CLI not installed'));
        process.exit(1);
    }
    // Use provided context or settings default with 10% buffer
    const settings = loadSettings();
    const contextLength = options.context
        ? parseInt(options.context)
        : Math.round(settings.maxContextTokens * 1.1);
    console.log(chalk.dim(`Loading model: ${model} (ctx: ${contextLength})...`));
    const result = await lms.loadModel(model, { contextLength });
    if (result.success) {
        console.log(chalk.green(`Model loaded: ${model}`));
    }
    else {
        console.error(chalk.red(`Failed: ${result.message}`));
        process.exit(1);
    }
});
program
    .command('ask <question>')
    .description('Ask a single question (non-interactive)')
    .option('-m, --model <model>', 'Override the model')
    .action(async (question, options) => {
    const settings = loadSettings();
    if (options.model) {
        setProviderModel(settings, options.model);
    }
    // Ensure ready (for local providers)
    await ensureLmsReady(settings);
    const { baseUrlOrApiKey, model } = getClientArgs(settings);
    const client = createClient(settings.provider, baseUrlOrApiKey, model);
    try {
        console.log(chalk.dim('\nThinking...\n'));
        await client.chatStream({
            model,
            messages: [{ role: 'user', content: question }],
        }, (chunk) => {
            process.stdout.write(chunk);
        });
        console.log('\n');
    }
    catch (error) {
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : error}`));
        process.exit(1);
    }
});
// Setup command
program
    .command('setup')
    .description('Run the setup wizard')
    .action(async () => {
    await runSetupWizard();
});
// Serve command - API server mode
program
    .command('serve')
    .description('Start API server for remote access')
    .option('-p, --port <port>', 'Port to listen on', '8080')
    .option('-H, --host <host>', 'Host to bind to', '0.0.0.0')
    .option('--lmstudio-url <url>', 'LM Studio URL', 'http://localhost:1234')
    .action(async (options) => {
    const port = parseInt(options.port) || 8080;
    const host = options.host || '0.0.0.0';
    const lmStudioUrl = options.lmstudioUrl || 'http://localhost:1234';
    console.log(chalk.bold('\n  Synaptic API Server\n'));
    // Check LM Studio connection
    try {
        const response = await fetch(`${lmStudioUrl}/v1/models`, { signal: AbortSignal.timeout(3000) });
        if (!response.ok)
            throw new Error('LM Studio not responding');
        console.log(chalk.green(`  ✓ LM Studio connected: ${lmStudioUrl}`));
    }
    catch {
        console.log(chalk.yellow(`  ⚠ LM Studio not detected at ${lmStudioUrl}`));
        console.log(chalk.dim('    Server will start anyway, ensure LM Studio is running'));
    }
    // Check for API keys
    const keys = apiServer.listApiKeys();
    if (keys.length === 0) {
        console.log(chalk.yellow('\n  No API keys found. Creating one...'));
        const newKey = apiServer.generateApiKey('default');
        console.log(chalk.green(`\n  ✓ API Key created: ${chalk.bold(newKey.key)}`));
        console.log(chalk.dim('    Save this key - it won\'t be shown again!\n'));
    }
    else {
        console.log(chalk.dim(`  ${keys.length} API key(s) configured`));
    }
    // Start server
    try {
        const { address } = await apiServer.startServer({ port, host, lmStudioUrl });
        console.log(chalk.green(`\n  ✓ Server running at ${chalk.bold(address)}`));
        console.log(chalk.dim('\n  Endpoints:'));
        console.log(chalk.dim('    GET  /health              - Health check'));
        console.log(chalk.dim('    GET  /v1/models           - List models'));
        console.log(chalk.dim('    POST /v1/chat/completions - Chat completion'));
        console.log(chalk.dim('\n  Usage:'));
        console.log(chalk.dim(`    curl ${address}/v1/models -H "Authorization: Bearer sk-syn-..."`));
        console.log(chalk.dim('\n  Press Ctrl+C to stop\n'));
    }
    catch (error) {
        console.error(chalk.red(`\n  Failed to start server: ${error instanceof Error ? error.message : error}`));
        process.exit(1);
    }
});
// API key management
program
    .command('apikey')
    .description('Manage API keys for serve mode')
    .argument('<action>', 'create, list, or revoke')
    .option('-n, --name <name>', 'Name for the key', 'default')
    .action(async (action, options) => {
    switch (action) {
        case 'create': {
            const key = apiServer.generateApiKey(options.name);
            console.log(chalk.green(`\n  API Key created: ${chalk.bold(key.key)}`));
            console.log(chalk.dim('  Save this key - it won\'t be shown again!\n'));
            break;
        }
        case 'list': {
            const keys = apiServer.listApiKeys();
            if (keys.length === 0) {
                console.log(chalk.dim('\n  No API keys configured'));
                console.log(chalk.dim('  Run: synaptic apikey create\n'));
            }
            else {
                console.log(chalk.bold('\n  API Keys:\n'));
                keys.forEach(k => {
                    console.log(`  ${chalk.cyan(k.keyPreview)} - ${k.name}`);
                    console.log(chalk.dim(`    Created: ${k.created}`));
                    if (k.lastUsed)
                        console.log(chalk.dim(`    Last used: ${k.lastUsed}`));
                    console.log(chalk.dim(`    Usage: ${k.usageTokens} tokens`));
                    console.log();
                });
            }
            break;
        }
        case 'revoke': {
            console.log(chalk.dim('\n  Enter key preview to revoke (e.g., sk-syn-xxxxx...yyyy):'));
            // For now, just show instructions
            const keys = apiServer.listApiKeys();
            keys.forEach(k => console.log(`    ${k.keyPreview} (${k.name})`));
            console.log(chalk.dim('\n  Use: synaptic apikey revoke --name <keyPreview>\n'));
            break;
        }
        default:
            console.error(chalk.red(`Unknown action: ${action}`));
            console.log(chalk.dim('Use: create, list, or revoke'));
            process.exit(1);
    }
});
// Default to chat if no command specified (or setup if first run)
program.action(async () => {
    // Check for first run
    if (isFirstRun()) {
        console.log(chalk.dim('\n  First time setup detected...\n'));
        const success = await runSetupWizard();
        if (!success) {
            return;
        }
    }
    const chatCmd = program.commands.find((c) => c.name() === 'chat');
    if (chatCmd) {
        await chatCmd.parseAsync(['node', 'synaptic', 'chat']);
    }
});
program.parse();
//# sourceMappingURL=index.js.map