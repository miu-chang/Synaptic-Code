import type { Message } from '../llm/types.js';
import type { LLMClient } from '../llm/types.js';
import { getTextContent } from '../llm/types.js';

export interface CompressionResult {
  summary: string;
  tokensSaved: number;
  originalTokens: number;
  compressedTokens: number;
}

export class ContextCompressor {
  private client: LLMClient;

  constructor(client: LLMClient) {
    this.client = client;
  }

  async compress(messages: Message[]): Promise<CompressionResult> {
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

  async smartCompress(
    messages: Message[],
    maxTokens: number
  ): Promise<Message[]> {
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

    const summaryMessage: Message = {
      role: 'system',
      content: `[Conversation History Summary]\n${compression.summary}`,
    };

    return [...systemMessages, summaryMessage, ...recentMessages];
  }

  private estimateTokens(messages: Message[]): number {
    return messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0);
  }

  shouldCompress(messages: Message[], threshold: number): boolean {
    return this.estimateTokens(messages) > threshold;
  }
}

// Sliding window compression for very long conversations
export class SlidingWindowCompressor {
  private windowSize: number;
  private overlapSize: number;
  private summaries: string[] = [];

  constructor(windowSize = 20, overlapSize = 5) {
    this.windowSize = windowSize;
    this.overlapSize = overlapSize;
  }

  addMessages(messages: Message[]): void {
    // Track message chunks for potential compression
  }

  getCompressedHistory(): string {
    return this.summaries.join('\n---\n');
  }
}
