import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { homedir, totalmem, cpus, platform } from 'os';
import { execSync } from 'child_process';
import { join } from 'path';
import { detectSystemLanguage, type Language } from '../i18n/index.js';

/**
 * System specs for performance tuning
 */
export interface SystemSpecs {
  ramGB: number;
  cpuCores: number;
  cpuModel: string;
  platform: 'mac' | 'windows' | 'linux';
  // Apple Silicon details
  appleSilicon?: {
    chip: 'M1' | 'M2' | 'M3' | 'M4';
    variant: 'base' | 'Pro' | 'Max' | 'Ultra';
    gpuCores: number;
    neuralEngineCores: number;
  };
  // GPU info for CUDA/ROCm
  gpu?: {
    name: string;
    vramGB: number;
  };
}

/**
 * Detect Apple Silicon chip details
 */
function detectAppleSilicon(cpuModel: string, cpuCores: number, ramGB: number): SystemSpecs['appleSilicon'] | undefined {
  const match = cpuModel.match(/Apple\s+(M\d+)/i);
  if (!match) return undefined;

  const chipRaw = match[1].toUpperCase();
  const chipNum = parseInt(chipRaw.slice(1));
  const chip = (chipNum >= 1 && chipNum <= 4 ? chipRaw : 'M4') as 'M1' | 'M2' | 'M3' | 'M4';

  let variant: 'base' | 'Pro' | 'Max' | 'Ultra' = 'base';
  let gpuCores = 8;
  let neuralEngineCores = 16;

  if (ramGB >= 128 || cpuCores >= 20) {
    variant = 'Ultra';
    gpuCores = chip === 'M1' ? 64 : chip === 'M2' ? 76 : 80;
    neuralEngineCores = 32;
  } else if (ramGB >= 64 || cpuCores >= 14) {
    variant = 'Max';
    gpuCores = chip === 'M1' ? 32 : chip === 'M2' ? 38 : chip === 'M3' ? 40 : 40;
    neuralEngineCores = 16;
  } else if (ramGB >= 32 || cpuCores >= 10) {
    variant = 'Pro';
    gpuCores = chip === 'M1' ? 16 : chip === 'M2' ? 19 : chip === 'M3' ? 18 : 20;
    neuralEngineCores = 16;
  } else {
    variant = 'base';
    gpuCores = chip === 'M1' ? 8 : chip === 'M2' ? 10 : chip === 'M3' ? 10 : 10;
    neuralEngineCores = 16;
  }

  return { chip, variant, gpuCores, neuralEngineCores };
}

/**
 * Detect GPU (NVIDIA, AMD, Intel)
 */
function detectGpu(): SystemSpecs['gpu'] | undefined {
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
  } catch {
    // nvidia-smi not available
  }

  // Try AMD ROCm
  try {
    const output = execSync('rocm-smi --showmeminfo vram --csv', {
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const lines = output.trim().split('\n');
    if (lines.length >= 2) {
      const vramMatch = output.match(/(\d+)\s*(?:MB|GB)/i);
      if (vramMatch) {
        const vram = parseInt(vramMatch[1]);
        const vramGB = vramMatch[0].toLowerCase().includes('gb') ? vram : Math.round(vram / 1024);
        return { name: 'AMD GPU (ROCm)', vramGB };
      }
    }
  } catch {
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
    } catch {
      // wmic not available
    }
  }

  return undefined;
}

/**
 * Detect system specifications
 */
export function detectSystemSpecs(): SystemSpecs {
  const ramGB = Math.round(totalmem() / (1024 * 1024 * 1024));
  const cpuInfo = cpus();
  const cpuCores = cpuInfo.length;
  const cpuModel = cpuInfo[0]?.model || 'Unknown';

  const os = platform();
  const plat: 'mac' | 'windows' | 'linux' =
    os === 'darwin' ? 'mac' : os === 'win32' ? 'windows' : 'linux';

  const specs: SystemSpecs = {
    ramGB,
    cpuCores,
    cpuModel,
    platform: plat,
  };

  if (plat === 'mac') {
    specs.appleSilicon = detectAppleSilicon(cpuModel, cpuCores, ramGB);
  }

  if (plat === 'windows' || plat === 'linux') {
    specs.gpu = detectGpu();
  }

  return specs;
}

/**
 * Get recommended context limits based on system specs
 * v0.2.x: significantly raised limits to take advantage of modern KV-cache optimizations,
 * RAM offloading, and larger unified-memory ceilings.
 */
export function getRecommendedContextLimits(specs: SystemSpecs): {
  maxContext: number;
  autoCompactThreshold: number;
  description: string;
} {
  // Apple Silicon - Unified memory advantage
  if (specs.appleSilicon) {
    const { chip, variant } = specs.appleSilicon;
    const ram = specs.ramGB;

    if (variant === 'Ultra') {
      if (ram >= 192) {
        return { maxContext: 262000, autoCompactThreshold: 200000, description: `${chip} Ultra ${ram}GB - 最高性能` };
      } else if (ram >= 128) {
        return { maxContext: 262000, autoCompactThreshold: 200000, description: `${chip} Ultra ${ram}GB - 超高性能` };
      }
      return { maxContext: 196000, autoCompactThreshold: 150000, description: `${chip} Ultra - 超高性能` };
    }

    if (variant === 'Max') {
      if (ram >= 96) {
        return { maxContext: 196000, autoCompactThreshold: 150000, description: `${chip} Max ${ram}GB - 高性能` };
      } else if (ram >= 64) {
        return { maxContext: 128000, autoCompactThreshold: 100000, description: `${chip} Max ${ram}GB - 高性能` };
      } else if (ram >= 32) {
        return { maxContext: 64000, autoCompactThreshold: 50000, description: `${chip} Max ${ram}GB - 高速` };
      }
      return { maxContext: 48000, autoCompactThreshold: 38000, description: `${chip} Max - 高速` };
    }

    if (variant === 'Pro') {
      if (ram >= 36) {
        return { maxContext: 96000, autoCompactThreshold: 75000, description: `${chip} Pro ${ram}GB - 高速` };
      } else if (ram >= 18) {
        return { maxContext: 48000, autoCompactThreshold: 38000, description: `${chip} Pro ${ram}GB - 快適` };
      }
      return { maxContext: 32000, autoCompactThreshold: 24000, description: `${chip} Pro - 快適` };
    }

    // Base M-series
    if (ram >= 24) {
      return { maxContext: 64000, autoCompactThreshold: 50000, description: `${chip} ${ram}GB - 快適` };
    } else if (ram >= 16) {
      return { maxContext: 32000, autoCompactThreshold: 24000, description: `${chip} ${ram}GB - 標準` };
    } else {
      return { maxContext: 8000, autoCompactThreshold: 6000, description: `${chip} ${ram}GB - 軽量` };
    }
  }

  // NVIDIA/AMD GPU - VRAM constraint with RAM offload bonus
  if (specs.gpu) {
    const { vramGB, name } = specs.gpu;
    const ram = specs.ramGB;

    if (vramGB >= 48) {
      return { maxContext: 262000, autoCompactThreshold: 200000, description: `${name} ${vramGB}GB - プロ級` };
    } else if (vramGB >= 24) {
      if (ram >= 64) {
        return { maxContext: 196000, autoCompactThreshold: 150000, description: `${name} ${vramGB}GB + RAM ${ram}GB - 高性能` };
      } else if (ram >= 32) {
        return { maxContext: 128000, autoCompactThreshold: 100000, description: `${name} ${vramGB}GB + RAM ${ram}GB - 高性能` };
      }
      return { maxContext: 64000, autoCompactThreshold: 50000, description: `${name} ${vramGB}GB - 高性能` };
    } else if (vramGB >= 16) {
      if (ram >= 64) {
        return { maxContext: 128000, autoCompactThreshold: 100000, description: `${name} ${vramGB}GB + RAM ${ram}GB - 高速` };
      } else if (ram >= 32) {
        return { maxContext: 96000, autoCompactThreshold: 75000, description: `${name} ${vramGB}GB + RAM ${ram}GB - 高速` };
      }
      return { maxContext: 64000, autoCompactThreshold: 50000, description: `${name} ${vramGB}GB - 高速` };
    } else if (vramGB >= 12) {
      if (ram >= 32) {
        return { maxContext: 48000, autoCompactThreshold: 38000, description: `${name} ${vramGB}GB + RAM ${ram}GB - 快適` };
      } else if (ram >= 16) {
        return { maxContext: 32000, autoCompactThreshold: 24000, description: `${name} ${vramGB}GB + RAM ${ram}GB - 快適` };
      }
      return { maxContext: 16000, autoCompactThreshold: 12000, description: `${name} ${vramGB}GB - 標準` };
    } else if (vramGB >= 8) {
      if (ram >= 32) {
        return { maxContext: 32000, autoCompactThreshold: 24000, description: `${name} ${vramGB}GB + RAM ${ram}GB - 標準` };
      } else if (ram >= 16) {
        return { maxContext: 24000, autoCompactThreshold: 18000, description: `${name} ${vramGB}GB + RAM ${ram}GB - 標準` };
      }
      return { maxContext: 8000, autoCompactThreshold: 6000, description: `${name} ${vramGB}GB - 軽量` };
    } else {
      if (ram >= 16) {
        return { maxContext: 16000, autoCompactThreshold: 12000, description: `${name} ${vramGB}GB + RAM ${ram}GB - 軽量` };
      }
      return { maxContext: 8000, autoCompactThreshold: 6000, description: `${name} ${vramGB}GB - 軽量` };
    }
  }

  // CPU only
  if (specs.ramGB >= 64) {
    return { maxContext: 64000, autoCompactThreshold: 50000, description: `CPU ${specs.ramGB}GB - 大容量` };
  } else if (specs.ramGB >= 32) {
    return { maxContext: 32000, autoCompactThreshold: 24000, description: `CPU ${specs.ramGB}GB - 標準` };
  } else if (specs.ramGB >= 16) {
    return { maxContext: 16000, autoCompactThreshold: 12000, description: `CPU ${specs.ramGB}GB - 軽量` };
  } else {
    return { maxContext: 4000, autoCompactThreshold: 3000, description: `CPU ${specs.ramGB}GB - 最小構成` };
  }
}

/**
 * Get recommended GPU offload (number of layers, "max", or "off")
 * - Apple Silicon: undefined (unified memory, no offload concept)
 * - No GPU: 'off'
 * - GPU with enough VRAM for whole model: 'max'
 * - Partial fit: estimate layer count to offload
 */
export function getRecommendedGpuOffload(
  specs: SystemSpecs,
  modelName: string
): number | 'max' | 'off' | undefined {
  if (specs.appleSilicon) return undefined;
  if (!specs.gpu) return 'off';

  const vramGB = specs.gpu.vramGB;
  const modelSizeGB = estimateModelSizeGB(modelName);
  const availableVram = Math.max(0, vramGB - 1.5); // reserve 1.5GB for KV cache/overhead

  if (modelSizeGB <= availableVram) {
    return 'max';
  }

  const ratio = availableVram / modelSizeGB;
  const totalLayers = estimateLayerCount(modelName);
  const gpuLayers = Math.round(totalLayers * ratio);
  return Math.max(0, gpuLayers);
}

function estimateModelSizeGB(modelName: string): number {
  const lower = modelName.toLowerCase();
  if (lower.includes('70b') || lower.includes('72b')) return 40;
  if (lower.includes('35b') || lower.includes('34b') || lower.includes('32b')) return 20;
  if (lower.includes('26b') || lower.includes('27b')) return 15;
  if (lower.includes('14b') || lower.includes('13b')) return 8;
  if (lower.includes('9b') || lower.includes('8b') || lower.includes('7b')) return 5.5;
  if (lower.includes('4b') || lower.includes('3b')) return 3;
  if (lower.includes('1b') || lower.includes('2b')) return 1.5;
  return 10;
}

function estimateLayerCount(modelName: string): number {
  const lower = modelName.toLowerCase();
  if (lower.includes('70b') || lower.includes('72b')) return 80;
  if (lower.includes('35b') || lower.includes('34b') || lower.includes('32b')) return 40;
  if (lower.includes('26b') || lower.includes('27b')) return 36;
  if (lower.includes('14b') || lower.includes('13b')) return 32;
  if (lower.includes('9b') || lower.includes('8b') || lower.includes('7b')) return 28;
  if (lower.includes('4b') || lower.includes('3b')) return 24;
  if (lower.includes('1b') || lower.includes('2b')) return 16;
  return 32;
}

export interface LLMProvider {
  name: string;
  baseUrl: string;
  model: string;
}

export interface CloudProvider {
  name: string;
  apiKey?: string;
  model: string;
  baseUrl?: string; // For custom endpoints
}

export interface RemoteConfig {
  /** Remote server URL (e.g., https://my-server.local:8080) */
  url: string;
  /** API key for authentication */
  apiKey: string;
  /** Optional: override model name */
  model?: string;
}

export type ProviderType = 'ollama' | 'lmstudio' | 'openai-local' | 'openai' | 'anthropic' | 'google' | 'xai';

export interface Settings {
  provider: ProviderType;
  providers: {
    ollama: LLMProvider;
    lmstudio: LLMProvider;
    'openai-local': LLMProvider;
  };
  cloudProviders: {
    openai: CloudProvider;
    anthropic: CloudProvider;
    google: CloudProvider;
    xai: CloudProvider;
  };
  /** Connection mode: local (default) or remote */
  mode: 'local' | 'remote';
  /** Remote server configuration */
  remote?: RemoteConfig;
  maxContextTokens: number;
  compressionThreshold: number;
  /** Auto-compact when tokens exceed this (for local LLMs) */
  autoCompactThreshold: number;
  streamingEnabled: boolean;
  historyDir: string;
  /** UI and system prompt language */
  language: Language;
  /** False after initial setup is complete */
  firstRun?: boolean;
  /** Detected system specs */
  systemSpecs?: SystemSpecs;
  /** Reasoning effort for capable models (low/medium/high). undefined = off */
  reasoningEffort?: 'low' | 'medium' | 'high';
}

const CONFIG_DIR = join(homedir(), '.synaptic');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

// Detect system specs and set appropriate limits
const detectedSpecs = detectSystemSpecs();
const recommendedLimits = getRecommendedContextLimits(detectedSpecs);

const DEFAULT_SETTINGS: Settings = {
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
      model: 'qwen/qwen3.6-35b-a3b',
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
    xai: {
      name: 'xAI Grok',
      model: 'grok-4-1-fast-non-reasoning',
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

export function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  if (!existsSync(DEFAULT_SETTINGS.historyDir)) {
    mkdirSync(DEFAULT_SETTINGS.historyDir, { recursive: true });
  }
}

export function loadSettings(): Settings {
  ensureConfigDir();

  if (!existsSync(CONFIG_FILE)) {
    saveSettings(DEFAULT_SETTINGS);
    return DEFAULT_SETTINGS;
  }

  try {
    const data = readFileSync(CONFIG_FILE, 'utf-8');
    const saved = JSON.parse(data) as Partial<Settings>;

    const specs = detectSystemSpecs();
    const limits = getRecommendedContextLimits(specs);

    const maxContextTokens = (saved.maxContextTokens && saved.maxContextTokens >= limits.maxContext)
      ? saved.maxContextTokens
      : limits.maxContext;
    const autoCompactThreshold = (saved.autoCompactThreshold && saved.autoCompactThreshold >= limits.autoCompactThreshold)
      ? saved.autoCompactThreshold
      : limits.autoCompactThreshold;

    const merged: Settings = {
      ...DEFAULT_SETTINGS,
      ...saved,
      systemSpecs: specs,
      maxContextTokens,
      autoCompactThreshold,
    };

    return merged;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Settings): void {
  ensureConfigDir();
  writeFileSync(CONFIG_FILE, JSON.stringify(settings, null, 2));
}

export function isCloudProvider(provider: ProviderType): boolean {
  return provider === 'openai' || provider === 'anthropic' || provider === 'google' || provider === 'xai';
}

export function getActiveProvider(settings: Settings): LLMProvider | CloudProvider {
  if (isCloudProvider(settings.provider)) {
    return settings.cloudProviders[settings.provider as CloudProviderType];
  }
  return settings.providers[settings.provider as LocalProviderType];
}

export function getCloudProviderApiKey(settings: Settings, provider: CloudProviderType): string | undefined {
  return settings.cloudProviders[provider]?.apiKey;
}

export function setCloudProviderApiKey(settings: Settings, provider: CloudProviderType, apiKey: string): void {
  if (!settings.cloudProviders[provider]) {
    settings.cloudProviders[provider] = { name: provider, model: '', apiKey };
  } else {
    settings.cloudProviders[provider].apiKey = apiKey;
  }
}

export type LocalProviderType = 'ollama' | 'lmstudio' | 'openai-local';
export type CloudProviderType = 'openai' | 'anthropic' | 'google' | 'xai';

export function isLocalProvider(provider: ProviderType): provider is LocalProviderType {
  return provider === 'ollama' || provider === 'lmstudio' || provider === 'openai-local';
}

export function getProviderBaseUrl(settings: Settings): string {
  if (isCloudProvider(settings.provider)) {
    return '';
  }
  return settings.providers[settings.provider as LocalProviderType].baseUrl;
}

export function getProviderModel(settings: Settings): string {
  if (isCloudProvider(settings.provider)) {
    return settings.cloudProviders[settings.provider as CloudProviderType].model;
  }
  return settings.providers[settings.provider as LocalProviderType].model;
}

export function setProviderModel(settings: Settings, model: string): void {
  if (isCloudProvider(settings.provider)) {
    settings.cloudProviders[settings.provider as CloudProviderType].model = model;
  } else {
    settings.providers[settings.provider as LocalProviderType].model = model;
  }
}

export function getProviderName(settings: Settings): string {
  if (isCloudProvider(settings.provider)) {
    return settings.cloudProviders[settings.provider as CloudProviderType].name;
  }
  return settings.providers[settings.provider as LocalProviderType].name;
}

export function getProviderApiKey(settings: Settings): string | undefined {
  if (isCloudProvider(settings.provider)) {
    return settings.cloudProviders[settings.provider as CloudProviderType].apiKey;
  }
  return undefined;
}

export function getClientArgs(settings: Settings): { baseUrlOrApiKey: string; model: string } {
  if (settings.mode === 'remote' && settings.remote) {
    return {
      baseUrlOrApiKey: settings.remote.url,
      model: settings.remote.model || 'default',
    };
  }

  if (isCloudProvider(settings.provider)) {
    const cloud = settings.cloudProviders[settings.provider as CloudProviderType];
    return {
      baseUrlOrApiKey: cloud.apiKey || '',
      model: cloud.model,
    };
  }
  const local = settings.providers[settings.provider as LocalProviderType];
  return {
    baseUrlOrApiKey: local.baseUrl,
    model: local.model,
  };
}

/**
 * Check if running in remote mode
 */
export function isRemoteMode(settings: Settings): boolean {
  return settings.mode === 'remote' && !!settings.remote?.url;
}

/**
 * Get remote config
 */
export function getRemoteConfig(settings: Settings): RemoteConfig | undefined {
  return settings.remote;
}

/**
 * Set remote config
 */
export function setRemoteConfig(settings: Settings, config: RemoteConfig): void {
  settings.remote = config;
  settings.mode = 'remote';
}

/**
 * Clear remote config and switch to local
 */
export function clearRemoteConfig(settings: Settings): void {
  settings.mode = 'local';
}
