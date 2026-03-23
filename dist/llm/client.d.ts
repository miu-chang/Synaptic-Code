import type { LLMClient, ChatCompletionRequest, ChatCompletionResponse, StreamResponse } from './types.js';
export declare class OpenAICompatibleClient implements LLMClient {
    private baseUrl;
    private defaultModel;
    constructor(baseUrl: string, defaultModel: string);
    chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
    chatStream(request: ChatCompletionRequest, onChunk: (chunk: string) => void, signal?: AbortSignal): Promise<StreamResponse>;
    listModels(): Promise<string[]>;
}
export declare class OllamaClient implements LLMClient {
    private baseUrl;
    private defaultModel;
    constructor(baseUrl: string, defaultModel: string);
    chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
    chatStream(request: ChatCompletionRequest, onChunk: (chunk: string) => void, signal?: AbortSignal): Promise<StreamResponse>;
    listModels(): Promise<string[]>;
}
export declare class OpenAICloudClient implements LLMClient {
    private apiKey;
    private defaultModel;
    private baseUrl;
    constructor(apiKey: string, defaultModel: string);
    chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
    chatStream(request: ChatCompletionRequest, onChunk: (chunk: string) => void, signal?: AbortSignal): Promise<StreamResponse>;
    listModels(): Promise<string[]>;
}
export declare class AnthropicClient implements LLMClient {
    private apiKey;
    private defaultModel;
    private baseUrl;
    constructor(apiKey: string, defaultModel: string);
    private convertToAnthropicMessages;
    private convertToolsToAnthropic;
    chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
    chatStream(request: ChatCompletionRequest, onChunk: (chunk: string) => void, signal?: AbortSignal): Promise<StreamResponse>;
    listModels(): Promise<string[]>;
}
export declare class GeminiClient implements LLMClient {
    private apiKey;
    private defaultModel;
    private baseUrl;
    constructor(apiKey: string, defaultModel: string);
    private convertToGeminiMessages;
    private convertToolsToGemini;
    chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
    chatStream(request: ChatCompletionRequest, onChunk: (chunk: string) => void, signal?: AbortSignal): Promise<StreamResponse>;
    listModels(): Promise<string[]>;
}
export declare class RemoteClient implements LLMClient {
    private baseUrl;
    private apiKey;
    private defaultModel;
    constructor(baseUrl: string, apiKey: string, defaultModel?: string);
    chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
    chatStream(request: ChatCompletionRequest, onChunk: (chunk: string) => void, signal?: AbortSignal): Promise<StreamResponse>;
    listModels(): Promise<string[]>;
}
import type { ProviderType, RemoteConfig } from '../config/settings.js';
export declare function createClient(provider: ProviderType, baseUrlOrApiKey: string, model: string): LLMClient;
/**
 * Create a remote client for Synaptic server
 */
export declare function createRemoteClient(config: RemoteConfig): LLMClient;
//# sourceMappingURL=client.d.ts.map