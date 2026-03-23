import { type Language } from '../i18n/index.js';
/**
 * System specs for performance tuning
 */
export interface SystemSpecs {
    ramGB: number;
    cpuCores: number;
    cpuModel: string;
    platform: 'mac' | 'windows' | 'linux';
    appleSilicon?: {
        chip: 'M1' | 'M2' | 'M3' | 'M4';
        variant: 'base' | 'Pro' | 'Max' | 'Ultra';
        gpuCores: number;
        neuralEngineCores: number;
    };
    gpu?: {
        name: string;
        vramGB: number;
    };
}
/**
 * Detect system specifications
 */
export declare function detectSystemSpecs(): SystemSpecs;
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
export declare function getRecommendedContextLimits(specs: SystemSpecs): {
    maxContext: number;
    autoCompactThreshold: number;
    description: string;
};
export interface LLMProvider {
    name: string;
    baseUrl: string;
    model: string;
}
export interface CloudProvider {
    name: string;
    apiKey?: string;
    model: string;
    baseUrl?: string;
}
export interface RemoteConfig {
    /** Remote server URL (e.g., https://my-server.local:8080) */
    url: string;
    /** API key for authentication */
    apiKey: string;
    /** Optional: override model name */
    model?: string;
}
export type ProviderType = 'ollama' | 'lmstudio' | 'openai-local' | 'openai' | 'anthropic' | 'google';
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
}
export declare function ensureConfigDir(): void;
export declare function loadSettings(): Settings;
export declare function saveSettings(settings: Settings): void;
export declare function isCloudProvider(provider: ProviderType): boolean;
export declare function getActiveProvider(settings: Settings): LLMProvider | CloudProvider;
export declare function getCloudProviderApiKey(settings: Settings, provider: 'openai' | 'anthropic' | 'google'): string | undefined;
export declare function setCloudProviderApiKey(settings: Settings, provider: 'openai' | 'anthropic' | 'google', apiKey: string): void;
export type LocalProviderType = 'ollama' | 'lmstudio' | 'openai-local';
export type CloudProviderType = 'openai' | 'anthropic' | 'google';
export declare function isLocalProvider(provider: ProviderType): provider is LocalProviderType;
export declare function getProviderBaseUrl(settings: Settings): string;
export declare function getProviderModel(settings: Settings): string;
export declare function setProviderModel(settings: Settings, model: string): void;
export declare function getProviderName(settings: Settings): string;
export declare function getProviderApiKey(settings: Settings): string | undefined;
export declare function getClientArgs(settings: Settings): {
    baseUrlOrApiKey: string;
    model: string;
};
/**
 * Check if running in remote mode
 */
export declare function isRemoteMode(settings: Settings): boolean;
/**
 * Get remote config
 */
export declare function getRemoteConfig(settings: Settings): RemoteConfig | undefined;
/**
 * Set remote config
 */
export declare function setRemoteConfig(settings: Settings, config: RemoteConfig): void;
/**
 * Clear remote config and switch to local
 */
export declare function clearRemoteConfig(settings: Settings): void;
//# sourceMappingURL=settings.d.ts.map