import { getTextContent } from '../llm/types.js';
export class ContextCompressor {
    client;
    constructor(client) {
        this.client = client;
    }
    async compress(messages) {
        const originalTokens = this.estimateTokens(messages);
        // Create summarization prompt
        const conversationText = messages
            .filter((m) => m.role !== 'system')
            .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
            .join('\n\n');
        const summaryPrompt = `Summarize the following conversation concisely, preserving:
1. Key decisions made
2. Important code changes or file modifications
3. Current task status and next steps
4. Any errors or issues encountered

Keep the summary under 500 words.

CONVERSATION:
${conversationText}

SUMMARY:`;
        const response = await this.client.chat({
            model: '',
            messages: [{ role: 'user', content: summaryPrompt }],
            max_tokens: 800,
        });
        const summary = getTextContent(response.choices[0]?.message?.content || '');
        const compressedTokens = this.estimateTokens([
            { role: 'system', content: summary },
        ]);
        return {
            summary,
            tokensSaved: originalTokens - compressedTokens,
            originalTokens,
            compressedTokens,
        };
    }
    async smartCompress(messages, maxTokens) {
        const systemMessages = messages.filter((m) => m.role === 'system');
        const chatMessages = messages.filter((m) => m.role !== 'system');
        // Always keep recent messages
        const recentCount = Math.min(10, chatMessages.length);
        const recentMessages = chatMessages.slice(-recentCount);
        const olderMessages = chatMessages.slice(0, -recentCount);
        if (olderMessages.length === 0) {
            return messages;
        }
        // Compress older messages
        const compression = await this.compress(olderMessages);
        const summaryMessage = {
            role: 'system',
            content: `[Conversation History Summary]\n${compression.summary}`,
        };
        return [...systemMessages, summaryMessage, ...recentMessages];
    }
    estimateTokens(messages) {
        return messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0);
    }
    shouldCompress(messages, threshold) {
        return this.estimateTokens(messages) > threshold;
    }
}
// Sliding window compression for very long conversations
export class SlidingWindowCompressor {
    windowSize;
    overlapSize;
    summaries = [];
    constructor(windowSize = 20, overlapSize = 5) {
        this.windowSize = windowSize;
        this.overlapSize = overlapSize;
    }
    addMessages(messages) {
        // Track message chunks for potential compression
    }
    getCompressedHistory() {
        return this.summaries.join('\n---\n');
    }
}
//# sourceMappingURL=compression.js.map