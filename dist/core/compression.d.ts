import type { Message } from '../llm/types.js';
import type { LLMClient } from '../llm/types.js';
export interface CompressionResult {
    summary: string;
    tokensSaved: number;
    originalTokens: number;
    compressedTokens: number;
}
export declare class ContextCompressor {
    private client;
    constructor(client: LLMClient);
    compress(messages: Message[]): Promise<CompressionResult>;
    smartCompress(messages: Message[], maxTokens: number): Promise<Message[]>;
    private estimateTokens;
    shouldCompress(messages: Message[], threshold: number): boolean;
}
export declare class SlidingWindowCompressor {
    private windowSize;
    private overlapSize;
    private summaries;
    constructor(windowSize?: number, overlapSize?: number);
    addMessages(messages: Message[]): void;
    getCompressedHistory(): string;
}
//# sourceMappingURL=compression.d.ts.map