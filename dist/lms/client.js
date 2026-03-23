/**
 * LM Studio CLI (lms) integration
 * Wraps lms commands for server/model management
 */
import { spawn, execSync } from 'child_process';
import { homedir } from 'os';
import { join } from 'path';
import { platform } from 'os';
// Try multiple paths for lms CLI
function getLmsPath() {
    const isWindows = platform() === 'win32';
    const lmsExe = isWindows ? 'lms.exe' : 'lms';
    const paths = isWindows
        ? [
            join(homedir(), '.lmstudio', 'bin', lmsExe),
            join(process.env.LOCALAPPDATA || '', 'LM Studio', 'bin', lmsExe),
            join(process.env.PROGRAMFILES || '', 'LM Studio', 'bin', lmsExe),
            'lms', // If in PATH
        ]
        : [
            join(homedir(), '.lmstudio', 'bin', lmsExe),
            '/usr/local/bin/lms',
            '/opt/homebrew/bin/lms',
            'lms', // If in PATH
        ];
    for (const p of paths) {
        try {
            execSync(`"${p}" --version`, { stdio: 'pipe' });
            return p;
        }
        catch {
            // Try next
        }
    }
    // Default fallback
    return isWindows
        ? join(homedir(), '.lmstudio', 'bin', lmsExe)
        : join(homedir(), '.lmstudio', 'bin', 'lms');
}
const LMS_PATH = getLmsPath();
/**
 * Check if lms CLI is installed
 */
export function isLmsInstalled() {
    try {
        execSync(`${LMS_PATH} --version`, { stdio: 'pipe' });
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Check if LM Studio server is running
 */
export async function isServerRunning() {
    try {
        const response = await fetch('http://localhost:1234/v1/models', {
            method: 'GET',
            signal: AbortSignal.timeout(2000),
        });
        return response.ok;
    }
    catch {
        return false;
    }
}
/**
 * Start LM Studio server
 */
export async function startServer() {
    return new Promise((resolve) => {
        const proc = spawn(LMS_PATH, ['server', 'start'], {
            stdio: 'pipe',
            detached: true,
        });
        let output = '';
        proc.stdout?.on('data', (data) => {
            output += data.toString();
        });
        proc.stderr?.on('data', (data) => {
            output += data.toString();
        });
        proc.on('close', (code) => {
            if (code === 0) {
                resolve({ success: true, message: 'Server started' });
            }
            else {
                resolve({ success: false, message: output || 'Failed to start server' });
            }
        });
        proc.on('error', (err) => {
            resolve({ success: false, message: err.message });
        });
        // Detach the process so it keeps running
        proc.unref();
        // Give it a moment to start
        setTimeout(() => {
            resolve({ success: true, message: 'Server starting...' });
        }, 1000);
    });
}
/**
 * Stop LM Studio server
 */
export async function stopServer() {
    return new Promise((resolve) => {
        const proc = spawn(LMS_PATH, ['server', 'stop'], {
            stdio: 'pipe',
        });
        let output = '';
        proc.stdout?.on('data', (data) => {
            output += data.toString();
        });
        proc.on('close', (code) => {
            resolve({
                success: code === 0,
                message: code === 0 ? 'Server stopped' : output,
            });
        });
        proc.on('error', (err) => {
            resolve({ success: false, message: err.message });
        });
    });
}
/**
 * List installed models (lms ls)
 */
export function listModels() {
    try {
        const output = execSync(`${LMS_PATH} ls`, { encoding: 'utf-8' });
        return parseModelList(output);
    }
    catch {
        return [];
    }
}
/**
 * List loaded models (lms ps)
 */
export function listLoadedModels() {
    try {
        const output = execSync(`${LMS_PATH} ps`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
        return parseLoadedModels(output);
    }
    catch {
        return [];
    }
}
/**
 * Get detailed info about loaded models including context length
 */
export function getLoadedModelsInfo() {
    try {
        const output = execSync(`${LMS_PATH} ps`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
        return parseLoadedModelsInfo(output);
    }
    catch {
        return [];
    }
}
/**
 * Parse lms ps output to get model info with context
 */
function parseLoadedModelsInfo(output) {
    const models = [];
    const lines = output.split('\n');
    for (const line of lines) {
        // Skip header and empty lines
        if (line.includes('IDENTIFIER') || !line.trim())
            continue;
        // Parse columns: IDENTIFIER MODEL STATUS SIZE CONTEXT PARALLEL DEVICE TTL
        const parts = line.trim().split(/\s{2,}/);
        if (parts.length >= 5) {
            const context = parseInt(parts[4]);
            if (!isNaN(context)) {
                models.push({
                    identifier: parts[0],
                    model: parts[1],
                    context,
                });
            }
        }
    }
    return models;
}
/**
 * Load a model
 */
export async function loadModel(modelName, options) {
    return new Promise((resolve) => {
        const args = ['load', modelName, '-y'];
        if (options?.contextLength) {
            args.push('-c', String(options.contextLength));
        }
        if (options?.gpu !== undefined) {
            args.push('--gpu', String(options.gpu));
        }
        const proc = spawn(LMS_PATH, args, {
            stdio: 'pipe',
        });
        let output = '';
        proc.stdout?.on('data', (data) => {
            output += data.toString();
        });
        proc.stderr?.on('data', (data) => {
            output += data.toString();
        });
        proc.on('close', (code) => {
            const ctxInfo = options?.contextLength ? ` (ctx: ${options.contextLength})` : '';
            resolve({
                success: code === 0,
                message: code === 0 ? `Model ${modelName} loaded${ctxInfo}` : output,
            });
        });
        proc.on('error', (err) => {
            resolve({ success: false, message: err.message });
        });
    });
}
/**
 * Unload current model (or all models)
 */
export async function unloadModel(all = true) {
    return new Promise((resolve) => {
        // Use --all to unload all models without interactive prompt
        const args = all ? ['unload', '--all'] : ['unload'];
        const proc = spawn(LMS_PATH, args, {
            stdio: 'pipe',
        });
        let output = '';
        proc.stdout?.on('data', (data) => {
            output += data.toString();
        });
        proc.stderr?.on('data', (data) => {
            output += data.toString();
        });
        proc.on('close', (code) => {
            resolve({
                success: code === 0,
                message: code === 0 ? 'Model unloaded' : output || 'Failed to unload',
            });
        });
        proc.on('error', (err) => {
            resolve({ success: false, message: err.message });
        });
    });
}
/**
 * Download a model using lms get
 * @param modelName - Model identifier (e.g., "qwen3.5-35b-a3b")
 * @param onProgress - Optional callback for progress updates
 */
export async function downloadModel(modelName, onProgress) {
    return new Promise((resolve) => {
        const proc = spawn(LMS_PATH, ['get', modelName, '-y'], {
            stdio: 'pipe',
        });
        let output = '';
        let lastLine = '';
        proc.stdout?.on('data', (data) => {
            const text = data.toString();
            output += text;
            // Get last non-empty line for progress
            const lines = text.split('\n').filter((l) => l.trim());
            if (lines.length > 0) {
                lastLine = lines[lines.length - 1];
                onProgress?.(lastLine);
            }
        });
        proc.stderr?.on('data', (data) => {
            output += data.toString();
        });
        proc.on('close', (code) => {
            resolve({
                success: code === 0,
                message: code === 0 ? `Downloaded: ${modelName}` : output || 'Download failed',
            });
        });
        proc.on('error', (err) => {
            resolve({ success: false, message: err.message });
        });
    });
}
/**
 * Search for models - Note: lms get is interactive, so we just validate the query format
 * The actual search happens during download with -y flag
 */
export function searchModels(query, _limit = 5) {
    // lms get is interactive, can't easily get search results
    // Return the query as a "search result" - actual model selection happens with -y flag
    if (query.trim()) {
        return [query.trim()];
    }
    return [];
}
/**
 * Get full status
 */
export async function getStatus() {
    const serverRunning = await isServerRunning();
    const loadedModels = serverRunning ? listLoadedModels() : [];
    return {
        serverRunning,
        loadedModels,
    };
}
/**
 * Ensure server is running and model is loaded
 */
export async function ensureReady(defaultModel, options) {
    const actions = [];
    // Check if lms is installed
    if (!isLmsInstalled()) {
        return {
            success: false,
            message: 'LM Studio CLI (lms) not found. Install LM Studio from https://lmstudio.ai',
            actions: [],
        };
    }
    // Check server
    let serverRunning = await isServerRunning();
    if (!serverRunning) {
        actions.push('Starting LM Studio server...');
        const result = await startServer();
        if (!result.success) {
            return {
                success: false,
                message: `Failed to start server: ${result.message}`,
                actions,
            };
        }
        // Wait for server to be ready
        for (let i = 0; i < 10; i++) {
            await new Promise((r) => setTimeout(r, 500));
            serverRunning = await isServerRunning();
            if (serverRunning)
                break;
        }
        if (!serverRunning) {
            return {
                success: false,
                message: 'Server started but not responding',
                actions,
            };
        }
        actions.push('Server started');
    }
    // Check loaded models
    const loadedModels = listLoadedModels();
    if (loadedModels.length === 0 && defaultModel) {
        actions.push(`Loading model: ${defaultModel}...`);
        const result = await loadModel(defaultModel, options);
        if (!result.success) {
            return {
                success: false,
                message: `Failed to load model: ${result.message}`,
                actions,
            };
        }
        actions.push(`Model loaded (ctx: ${options?.contextLength || 'default'})`);
    }
    return {
        success: true,
        message: 'Ready',
        actions,
    };
}
/**
 * Check if loaded model has sufficient context, reload if needed
 * @param requiredContext - minimum context length required
 * @param targetModel - optional model name to check (from settings)
 * @returns info about what happened
 */
export async function ensureContextLength(requiredContext, targetModel) {
    const loadedModels = getLoadedModelsInfo();
    if (loadedModels.length === 0) {
        return { ok: true, reloaded: false, message: 'No models loaded' };
    }
    // Find the target model, or use first loaded if not specified
    let target = loadedModels[0];
    if (targetModel) {
        // Match by model name (partial match for flexibility)
        const found = loadedModels.find(m => m.model.includes(targetModel) || targetModel.includes(m.model) ||
            m.identifier.includes(targetModel) || targetModel.includes(m.identifier));
        if (found) {
            target = found;
        }
    }
    // Find the instance with highest context for this model
    const sameModelInstances = loadedModels.filter(m => m.model === target.model);
    const bestInstance = sameModelInstances.reduce((best, curr) => curr.context > best.context ? curr : best, sameModelInstances[0]);
    if (bestInstance.context >= requiredContext) {
        return {
            ok: true,
            reloaded: false,
            model: bestInstance.model,
            context: bestInstance.context,
            message: `Context OK: ${bestInstance.context}`,
        };
    }
    // Context too low, need to reload with model name (not identifier)
    const result = await loadModel(target.model, { contextLength: requiredContext });
    if (result.success) {
        // Wait a moment for model to finish loading
        await new Promise(r => setTimeout(r, 1000));
        // Verify the new context length
        const reloaded = getLoadedModelsInfo();
        const newModel = reloaded.find(m => m.model === target.model);
        const newContext = newModel?.context ?? requiredContext;
        return {
            ok: true,
            reloaded: true,
            model: target.model,
            context: newContext,
            message: `Reloaded with context: ${newContext}`,
        };
    }
    return {
        ok: false,
        reloaded: false,
        model: target.model,
        context: target.context,
        message: `Failed to reload: ${result.message}`,
    };
}
// Parser helpers
function parseModelList(output) {
    const models = [];
    const lines = output.split('\n');
    let inLLMSection = false;
    for (const line of lines) {
        if (line.includes('LLM') && line.includes('PARAMS')) {
            inLLMSection = true;
            continue;
        }
        if (line.includes('EMBEDDING')) {
            inLLMSection = false;
            continue;
        }
        if (inLLMSection && line.trim()) {
            // Parse model line: name params arch size device [loaded]
            const parts = line.trim().split(/\s{2,}/);
            if (parts.length >= 4) {
                models.push({
                    name: parts[0],
                    params: parts[1],
                    arch: parts[2],
                    size: parts[3],
                    loaded: line.includes('LOADED'),
                });
            }
        }
    }
    return models;
}
function parseLoadedModels(output) {
    const models = [];
    const lines = output.split('\n');
    for (const line of lines) {
        // Look for model identifiers in the output
        const match = line.match(/^([a-zA-Z0-9\/_.-]+)\s/);
        if (match && !line.includes('IDENTIFIER') && line.trim()) {
            models.push(match[1]);
        }
    }
    return models;
}
//# sourceMappingURL=client.js.map