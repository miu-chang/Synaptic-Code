import type { Message, LLMClient } from '../llm/types.js';
import type { Settings } from '../config/settings.js';
export interface Conversation {
    id: string;
    title: string;
    messages: Message[];
    createdAt: number;
    updatedAt: number;
    compressed: boolean;
    summary?: string;
}
export declare class ConversationManager {
    private settings;
    private currentConversation;
    private actualTokenCount;
    constructor(settings: Settings);
    /**
     * Update token count from actual LLM usage
     */
    updateTokenCount(promptTokens: number, _completionTokens?: number): void;
    /**
     * Reset token count (after compact, etc.)
     */
    resetTokenCount(): void;
    create(systemPrompt?: string): Conversation;
    getCurrent(): Conversation | null;
    addMessage(message: Message): void;
    getMessages(): Message[];
    getMessageCount(): number;
    truncateToCount(count: number): void;
    /**
     * Restore conversation from a full message snapshot
     * Used for fork functionality to restore pre-compact state
     */
    restoreFromSnapshot(messages: Message[]): void;
    updateSystemPrompt(newPrompt: string): void;
    getTokenCount(): number;
    getMaxTokens(): number;
    isCompressed(): boolean;
    /**
     * Manually compress the conversation using LLM summarization (Claude Code style)
     * Returns info about the compression
     */
    compactWithLLM(client: LLMClient, model: string, focus?: string): Promise<{
        before: number;
        after: number;
        removed: number;
        summary: string;
    }>;
    /**
     * Remove orphaned tool messages and ensure tool_call/tool pairs are complete
     */
    private cleanToolMessages;
    private buildConversationText;
    /**
     * Detect if text contains significant Japanese characters
     */
    private isJapanese;
    private generateSummaryWithLLM;
    private createFallbackSummary;
    /**
     * Simple synchronous compact (fallback, no LLM)
     */
    compact(): {
        before: number;
        after: number;
        removed: number;
    };
    getContextMessages(): Message[];
    private estimateTokens;
    private compressContext;
    private createSummary;
    save(): void;
    load(id: string): Conversation | null;
    list(): {
        id: string;
        title: string;
        updatedAt: number;
    }[];
}
//# sourceMappingURL=conversation.d.ts.map