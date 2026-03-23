import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { homedir, totalmem, cpus, platform } from 'os';
import { execSync } from 'child_process';
import { join } from 'path';
import { detectSystemLanguage } from '../i18n/index.js';
/**
 * Detect Apple Silicon chip details
 */
function detectAppleSilicon(cpuModel, cpuCores, ramGB) {
    // Check if Apple Silicon (M1, M2, M3, M4, or future M5+)
    const match = cpuModel.match(/Apple\s+(M\d+)/i);
    if (!match)
        return undefined;
    // Support M1-M4 explicitly, treat M5+ as latest known (M4)
    const chipRaw = match[1].toUpperCase();
    const chipNum = parseInt(chipRaw.slice(1));
    const chip = (chipNum >= 1 && chipNum <= 4 ? chipRaw : 'M4');
    // Detect variant based on core count and RAM
    // M1: 8 cores, M1 Pro: 10, M1 Max: 10, M1 Ultra: 20
    // M2: 8 cores, M2 Pro: 12, M2 Max: 12, M2 Ultra: 24
    // M3: 8 cores, M3 Pro: 12, M3 Max: 16, M3 Ultra: ~32
    // M4: 10 cores, M4 Pro: 14, M4 Max: 16+
    let variant = 'base';
    let gpuCores = 8;
    let neuralEngineCores = 16;
    if (ramGB >= 128 || cpuCores >= 20) {
        variant = 'Ultra';
        gpuCores = chip === 'M1' ? 64 : chip === 'M2' ? 76 : 80;
        neuralEngineCores = 32;
    }
    else if (ramGB >= 64 || cpuCores >= 14) {
        variant = 'Max';
        gpuCores = chip === 'M1' ? 32 : chip === 'M2' ? 38 : chip === 'M3' ? 40 : 40;
        neuralEngineCores = 16;
    }
    else if (ramGB >= 32 || cpuCores >= 10) {
        variant = 'Pro';
        gpuCores = chip === 'M1' ? 16 : chip === 'M2' ? 19 : chip === 'M3' ? 18 : 20;
        neuralEngineCores = 16;
    }
    else {
        variant = 'base';
        gpuCores = chip === 'M1' ? 8 : chip === 'M2' ? 10 : chip === 'M3' ? 10 : 10;
        neuralEngineCores = 16;
    }
    return { chip, variant, gpuCores, neuralEngineCores };
}
/**
 * Detect GPU (NVIDIA, AMD, Intel)
 */
function detectGpu() {
    // Try NVIDIA first (most common for LLM)
    try {
        const output = execSync('nvidia-smi --query-gpu=name,memory.total --format=csv,noheader,nounits', {
            encoding: 'utf-8',
            timeout: 5000,
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        const [name, vram] = output.trim().split(', ');
        if (name && vram) {
            return { name: name.trim(), vramGB: Math.round(parseInt(vram) / 1024) };
        }
    }
    catch {
        // nvidia-smi not available
    }
    // Try AMD ROCm
    try {
        const output = execSync('rocm-smi --showmeminfo vram --csv', {
            encoding: 'utf-8',
            timeout: 5000,
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        // Parse ROCm output for VRAM
        const lines = output.trim().split('\n');
        if (lines.length >= 2) {
            const vramMatch = output.match(/(\d+)\s*(?:MB|GB)/i);
            if (vramMatch) {
                const vram = parseInt(vramMatch[1]);
                const vramGB = vramMatch[0].toLowerCase().includes('gb') ? vram : Math.round(vram / 1024);
                return { name: 'AMD GPU (ROCm)', vramGB };
            }
        }
    }
    catch {
        // rocm-smi not available
    }
    // Try AMD on Windows (wmic)
    if (platform() === 'win32') {
        try {
            const output = execSync('wmic path win32_videocontroller get name,adapterram /format:csv', {
                encoding: 'utf-8',
                timeout: 5000,
                stdio: ['pipe', 'pipe', 'pipe'],
            });
            const lines = output.trim().split('\n').filter(l => l.includes(','));
            for (const line of lines) {
                const parts = line.split(',');
                if (parts.length >= 3) {
                    const name = parts[1]?.trim();
                    const ram = parseInt(parts[2]) || 0;
                    // Skip integrated graphics
                    if (name && ram > 1024 * 1024 * 1024 && !name.toLowerCase().includes('intel')) {
                        return { name, vramGB: Math.round(ram / (1024 * 1024 * 1024)) };
                    }
                }
            }
        }
        catch {
            // wmic not available
        }
    }
    return undefined;
}
/**
 * Detect system specifications
 */
export function detectSystemSpecs() {
    const ramGB = Math.round(totalmem() / (1024 * 1024 * 1024));
    const cpuInfo = cpus();
    const cpuCores = cpuInfo.length;
    const cpuModel = cpuInfo[0]?.model || 'Unknown';
    const os = platform();
    const plat = os === 'darwin' ? 'mac' : os === 'win32' ? 'windows' : 'linux';
    const specs = {
        ramGB,
        cpuCores,
        cpuModel,
        platform: plat,
    };
    // Detect Apple Silicon
    if (plat === 'mac') {
        specs.appleSilicon = detectAppleSilicon(cpuModel, cpuCores, ramGB);
    }
    // Detect GPU (NVIDIA, AMD, Intel) on Windows/Linux
    if (plat === 'windows' || plat === 'linux') {
        specs.gpu = detectGpu();
    }
    return specs;
}
/**
 * Get recommended context limits based on system specs
 * Returns { maxContext, autoCompactThreshold, description }
 *
 * Based on 2025-2026 benchmarks:
 * - Apple Silicon: Unified memory allows larger contexts, bandwidth is key
 *   - M3 Max 400GB/s > M4 Pro 273GB/s for LLM inference
 *   - 64GB+ can run 70B Q4 models with 32k+ context
 * - NVIDIA: VRAM is the hard limit
 *   - 24GB (4090/3090): 64k context comfortable for 8B models
 *   - 12GB (4070/3060): 32k max, 8k-16k safe
 *   - 8GB (3070/4060): 8k-16k max
 * - CPU-only: Very slow (1-10 tok/s), keep context small
 *
 * Sources:
 * - https://local-ai-zone.github.io/guides/context-length-optimization-ultimate-guide-2025.html
 * - https://localllm.in/blog/llamacpp-vram-requirements-for-local-llms
 * - https://apxml.com/posts/best-local-llm-apple-silicon-mac
 */
export function getRecommendedContextLimits(specs) {
    // Apple Silicon - Unified memory advantage
    // Memory can be shared between CPU/GPU, larger contexts possible
    if (specs.appleSilicon) {
        const { chip, variant } = specs.appleSilicon;
        const ram = specs.ramGB;
        // Ultra variants (192GB possible, 800GB/s bandwidth)
        if (variant === 'Ultra') {
            if (ram >= 192) {
                return { maxContext: 128000, autoCompactThreshold: 100000, description: `${chip} Ultra ${ram}GB - 最高性能` };
            }
            else if (ram >= 128) {
                return { maxContext: 100000, autoCompactThreshold: 80000, description: `${chip} Ultra ${ram}GB - 超高性能` };
            }
            return { maxContext: 64000, autoCompactThreshold: 50000, description: `${chip} Ultra - 超高性能` };
        }
        // Max variants (up to 128GB, ~400-550GB/s bandwidth)
        if (variant === 'Max') {
            if (ram >= 96) {
                return { maxContext: 64000, autoCompactThreshold: 50000, description: `${chip} Max ${ram}GB - 高性能` };
            }
            else if (ram >= 64) {
                // M3 Max 64GB: Can handle 70B Q4 + 32k context comfortably
                return { maxContext: 48000, autoCompactThreshold: 38000, description: `${chip} Max ${ram}GB - 高性能` };
            }
            else if (ram >= 32) {
                return { maxContext: 32000, autoCompactThreshold: 24000, description: `${chip} Max ${ram}GB - 高速` };
            }
            return { maxContext: 24000, autoCompactThreshold: 18000, description: `${chip} Max - 高速` };
        }
        // Pro variants (up to 48GB, ~200-273GB/s bandwidth)
        if (variant === 'Pro') {
            if (ram >= 36) {
                return { maxContext: 32000, autoCompactThreshold: 24000, description: `${chip} Pro ${ram}GB - 高速` };
            }
            else if (ram >= 18) {
                return { maxContext: 16000, autoCompactThreshold: 12000, description: `${chip} Pro ${ram}GB - 快適` };
            }
            return { maxContext: 12000, autoCompactThreshold: 9000, description: `${chip} Pro - 快適` };
        }
        // Base M-series (8-24GB, ~100-150GB/s bandwidth)
        // Limited by both RAM and bandwidth
        if (ram >= 24) {
            return { maxContext: 16000, autoCompactThreshold: 12000, description: `${chip} ${ram}GB - 快適` };
        }
        else if (ram >= 16) {
            // 16GB: 7-8B models comfortable, limited context
            return { maxContext: 8000, autoCompactThreshold: 6000, description: `${chip} ${ram}GB - 標準` };
        }
        else {
            // 8GB: Only small models (1-3B), minimal context
            return { maxContext: 4000, autoCompactThreshold: 3000, description: `${chip} ${ram}GB - 軽量` };
        }
    }
    // NVIDIA GPU - VRAM is the hard constraint
    // Context length limited by KV cache memory usage
    if (specs.gpu) {
        const { vramGB, name } = specs.gpu;
        if (vramGB >= 48) {
            // A6000, dual GPU setups
            return { maxContext: 100000, autoCompactThreshold: 80000, description: `${name} ${vramGB}GB - プロ級` };
        }
        else if (vramGB >= 24) {
            // RTX 4090, 3090, A5000
            // 24GB: 8B model + 64k context comfortable
            return { maxContext: 64000, autoCompactThreshold: 50000, description: `${name} ${vramGB}GB - 高性能` };
        }
        else if (vramGB >= 16) {
            // RTX 4080, 4070 Ti Super, A4000
            // 16GB: 8B model + 32k context, or 14B + 16k
            return { maxContext: 32000, autoCompactThreshold: 24000, description: `${name} ${vramGB}GB - 高速` };
        }
        else if (vramGB >= 12) {
            // RTX 4070, 3060 12GB
            // 12GB: 8B model + 16-32k context safe
            return { maxContext: 24000, autoCompactThreshold: 18000, description: `${name} ${vramGB}GB - 快適` };
        }
        else if (vramGB >= 8) {
            // RTX 4060, 3070, 3060 Ti
            // 8GB: 8B Q4 model + 8-16k context max (32k crashes)
            return { maxContext: 12000, autoCompactThreshold: 9000, description: `${name} ${vramGB}GB - 標準` };
        }
        else {
            // 6GB or less: Very limited
            return { maxContext: 6000, autoCompactThreshold: 4000, description: `${name} ${vramGB}GB - 軽量` };
        }
    }
    // CPU only (Windows/Linux without dedicated GPU)
    // Very slow inference (1-10 tok/s), minimize context for responsiveness
    // DDR5 helps but still much slower than GPU
    if (specs.ramGB >= 64) {
        // Can load large models but slow, keep context moderate
        return { maxContext: 16000, autoCompactThreshold: 12000, description: `CPU ${specs.ramGB}GB - 大容量(低速)` };
    }
    else if (specs.ramGB >= 32) {
        // 32GB: Can run 7-13B models, modest context
        return { maxContext: 8000, autoCompactThreshold: 6000, description: `CPU ${specs.ramGB}GB - 標準(低速)` };
    }
    else if (specs.ramGB >= 16) {
        // 16GB: Minimum practical, small models only
        return { maxContext: 4000, autoCompactThreshold: 3000, description: `CPU ${specs.ramGB}GB - 最小構成` };
    }
    else {
        // <16GB: Not recommended for local LLMs
        return { maxContext: 2000, autoCompactThreshold: 1500, description: `CPU ${specs.ramGB}GB - 非推奨` };
    }
}
const CONFIG_DIR = join(homedir(), '.synaptic');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');
// Detect system specs and set appropriate limits
const detectedSpecs = detectSystemSpecs();
const recommendedLimits = getRecommendedContextLimits(detectedSpecs);
const DEFAULT_SETTINGS = {
    provider: 'lmstudio',
    mode: 'local',
    providers: {
        ollama: {
            name: 'Ollama',
            baseUrl: 'http://localhost:11434',
            model: 'llama3',
        },
        lmstudio: {
            name: 'LM Studio',
            baseUrl: 'http://localhost:1234/v1',
            model: 'qwen/qwen3.5-35b-a3b',
        },
        'openai-local': {
            name: 'OpenAI Compatible (Local)',
            baseUrl: 'http://localhost:8080/v1',
            model: 'gpt-4',
        },
    },
    cloudProviders: {
        openai: {
            name: 'OpenAI',
            model: 'gpt-5.4',
            // Available: gpt-5.4, gpt-5.4-pro, gpt-5.4-mini, gpt-5.3-codex
        },
        anthropic: {
            name: 'Anthropic',
            model: 'claude-sonnet-4-6',
            // Available: claude-opus-4-6, claude-sonnet-4-6, claude-opus-4-5, claude-sonnet-4-5, claude-haiku-4-5
        },
        google: {
            name: 'Google Gemini',
            model: 'gemini-3.1-pro',
            // Available: gemini-3.1-pro, gemini-3.1-flash, gemini-3.1-flash-lite
        },
    },
    maxContextTokens: recommendedLimits.maxContext,
    compressionThreshold: 0.8,
    autoCompactThreshold: recommendedLimits.autoCompactThreshold,
    streamingEnabled: true,
    historyDir: join(CONFIG_DIR, 'history'),
    language: detectSystemLanguage(),
    firstRun: true,
    systemSpecs: detectedSpecs,
};
export function ensureConfigDir() {
    if (!existsSync(CONFIG_DIR)) {
        mkdirSync(CONFIG_DIR, { recursive: true });
    }
    if (!existsSync(DEFAULT_SETTINGS.historyDir)) {
        mkdirSync(DEFAULT_SETTINGS.historyDir, { recursive: true });
    }
}
export function loadSettings() {
    ensureConfigDir();
    if (!existsSync(CONFIG_FILE)) {
        saveSettings(DEFAULT_SETTINGS);
        return DEFAULT_SETTINGS;
    }
    try {
        const data = readFileSync(CONFIG_FILE, 'utf-8');
        const saved = JSON.parse(data);
        // Always re-detect system specs
        const specs = detectSystemSpecs();
        const limits = getRecommendedContextLimits(specs);
        // Use saved value only if it's >= system recommended, otherwise use system value
        const maxContextTokens = (saved.maxContextTokens && saved.maxContextTokens >= limits.maxContext)
            ? saved.maxContextTokens
            : limits.maxContext;
        const autoCompactThreshold = (saved.autoCompactThreshold && saved.autoCompactThreshold >= limits.autoCompactThreshold)
            ? saved.autoCompactThreshold
            : limits.autoCompactThreshold;
        // Merge with defaults
        const merged = {
            ...DEFAULT_SETTINGS,
            ...saved,
            systemSpecs: specs,
            maxContextTokens,
            autoCompactThreshold,
        };
        return merged;
    }
    catch {
        return DEFAULT_SETTINGS;
    }
}
export function saveSettings(settings) {
    ensureConfigDir();
    writeFileSync(CONFIG_FILE, JSON.stringify(settings, null, 2));
}
export function isCloudProvider(provider) {
    return provider === 'openai' || provider === 'anthropic' || provider === 'google';
}
export function getActiveProvider(settings) {
    if (isCloudProvider(settings.provider)) {
        return settings.cloudProviders[settings.provider];
    }
    return settings.providers[settings.provider];
}
export function getCloudProviderApiKey(settings, provider) {
    return settings.cloudProviders[provider]?.apiKey;
}
export function setCloudProviderApiKey(settings, provider, apiKey) {
    if (!settings.cloudProviders[provider]) {
        settings.cloudProviders[provider] = { name: provider, model: '', apiKey };
    }
    else {
        settings.cloudProviders[provider].apiKey = apiKey;
    }
}
export function isLocalProvider(provider) {
    return provider === 'ollama' || provider === 'lmstudio' || provider === 'openai-local';
}
export function getProviderBaseUrl(settings) {
    if (isCloudProvider(settings.provider)) {
        // Cloud providers don't need baseUrl (handled by client)
        return '';
    }
    return settings.providers[settings.provider].baseUrl;
}
export function getProviderModel(settings) {
    if (isCloudProvider(settings.provider)) {
        return settings.cloudProviders[settings.provider].model;
    }
    return settings.providers[settings.provider].model;
}
export function setProviderModel(settings, model) {
    if (isCloudProvider(settings.provider)) {
        settings.cloudProviders[settings.provider].model = model;
    }
    else {
        settings.providers[settings.provider].model = model;
    }
}
export function getProviderName(settings) {
    if (isCloudProvider(settings.provider)) {
        return settings.cloudProviders[settings.provider].name;
    }
    return settings.providers[settings.provider].name;
}
export function getProviderApiKey(settings) {
    if (isCloudProvider(settings.provider)) {
        return settings.cloudProviders[settings.provider].apiKey;
    }
    return undefined;
}
export function getClientArgs(settings) {
    // Remote mode: use remote server config
    if (settings.mode === 'remote' && settings.remote) {
        return {
            baseUrlOrApiKey: settings.remote.url,
            model: settings.remote.model || 'default',
        };
    }
    if (isCloudProvider(settings.provider)) {
        const cloud = settings.cloudProviders[settings.provider];
        return {
            baseUrlOrApiKey: cloud.apiKey || '',
            model: cloud.model,
        };
    }
    const local = settings.providers[settings.provider];
    return {
        baseUrlOrApiKey: local.baseUrl,
        model: local.model,
    };
}
/**
 * Check if running in remote mode
 */
export function isRemoteMode(settings) {
    return settings.mode === 'remote' && !!settings.remote?.url;
}
/**
 * Get remote config
 */
export function getRemoteConfig(settings) {
    return settings.remote;
}
/**
 * Set remote config
 */
export function setRemoteConfig(settings, config) {
    settings.remote = config;
    settings.mode = 'remote';
}
/**
 * Clear remote config and switch to local
 */
export function clearRemoteConfig(settings) {
    settings.mode = 'local';
}
//# sourceMappingURL=settings.js.map