import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import type { Message, LLMClient } from '../llm/types.js';
import { getTextContent, isContentEmpty } from '../llm/types.js';
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

export class ConversationManager {
  private settings: Settings;
  private currentConversation: Conversation | null = null;
  private actualTokenCount: number = 0; // Accumulated from LLM responses

  constructor(settings: Settings) {
    this.settings = settings;
  }

  /**
   * Update token count from actual LLM usage
   */
  updateTokenCount(promptTokens: number, _completionTokens?: number): void {
    // Use prompt tokens as context size (what was sent to LLM)
    this.actualTokenCount = promptTokens;
  }

  /**
   * Reset token count (after compact, etc.)
   */
  resetTokenCount(): void {
    this.actualTokenCount = 0;
  }

  create(systemPrompt?: string): Conversation {
    const id = `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const messages: Message[] = [];

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    this.currentConversation = {
      id,
      title: 'New Conversation',
      messages,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      compressed: false,
    };

    return this.currentConversation;
  }

  getCurrent(): Conversation | null {
    return this.currentConversation;
  }

  addMessage(message: Message): void {
    if (!this.currentConversation) {
      this.create();
    }
    this.currentConversation!.messages.push(message);
    this.currentConversation!.updatedAt = Date.now();

    // Auto-title from first user message
    if (
      message.role === 'user' &&
      this.currentConversation!.title === 'New Conversation'
    ) {
      this.currentConversation!.title = message.content.slice(0, 50) + '...';
    }
  }

  getMessages(): Message[] {
    return this.currentConversation?.messages || [];
  }

  getMessageCount(): number {
    return this.currentConversation?.messages.length || 0;
  }

  truncateToCount(count: number): void {
    if (!this.currentConversation) return;
    this.currentConversation.messages = this.currentConversation.messages.slice(0, count);
    this.currentConversation.updatedAt = Date.now();
  }

  /**
   * Restore conversation from a full message snapshot
   * Used for fork functionality to restore pre-compact state
   */
  restoreFromSnapshot(messages: Message[]): void {
    if (!this.currentConversation) {
      this.create();
    }
    this.currentConversation!.messages = [...messages];
    this.currentConversation!.compressed = false;
    this.currentConversation!.summary = undefined;
    this.currentConversation!.updatedAt = Date.now();
    this.actualTokenCount = 0;  // Reset to re-estimate
  }

  updateSystemPrompt(newPrompt: string): void {
    if (!this.currentConversation) return;
    const systemIndex = this.currentConversation.messages.findIndex(m => m.role === 'system');
    if (systemIndex >= 0) {
      this.currentConversation.messages[systemIndex].content = newPrompt;
    } else {
      this.currentConversation.messages.unshift({ role: 'system', content: newPrompt });
    }
    this.currentConversation.updatedAt = Date.now();
  }

  getTokenCount(): number {
    // Use actual token count from LLM if available, otherwise estimate
    if (this.actualTokenCount > 0) {
      return this.actualTokenCount;
    }
    if (!this.currentConversation) return 0;
    return this.estimateTokens(this.currentConversation.messages);
  }

  getMaxTokens(): number {
    return this.settings.maxContextTokens;
  }

  isCompressed(): boolean {
    return this.currentConversation?.compressed || false;
  }

  /**
   * Manually compress the conversation using LLM summarization (Claude Code style)
   * Returns info about the compression
   */
  async compactWithLLM(
    client: LLMClient,
    model: string,
    focus?: string
  ): Promise<{ before: number; after: number; removed: number; summary: string }> {
    if (!this.currentConversation) {
      return { before: 0, after: 0, removed: 0, summary: '' };
    }

    const before = this.currentConversation.messages.length;

    // Get system messages (first one only, we'll add our summary separately)
    const originalSystem = this.currentConversation.messages.find(m => m.role === 'system');
    const otherMessages = this.currentConversation.messages.filter(m => m.role !== 'system');

    // Check token count - only compact if we have significant context
    const currentTokens = this.actualTokenCount || this.estimateTokens(this.currentConversation.messages);
    const minTokensToCompact = 2000; // At least 2k tokens before compacting

    if (currentTokens < minTokensToCompact) {
      return { before, after: before, removed: 0, summary: '' };
    }

    // Find safe split point - must be at a 'user' message boundary
    // to avoid breaking tool_call / tool_result pairs
    const userIndices: number[] = [];
    for (let i = 0; i < otherMessages.length; i++) {
      if (otherMessages[i].role === 'user') {
        userIndices.push(i);
      }
    }

    // Need at least 2 user messages to keep recent context
    if (userIndices.length < 2) {
      // If only 1 user message but lots of tokens, try to summarize tool results
      if (userIndices.length === 1 && currentTokens > 10000) {
        // Keep only the last user message and compact everything else
        const keepFromIndex = userIndices[0];
        if (keepFromIndex > 0) {
          // We have content before the user message that can be summarized
          const toSummarize = otherMessages.slice(0, keepFromIndex);
          const toKeep = otherMessages.slice(keepFromIndex);

          const conversationText = this.buildConversationText(toSummarize);
          const summary = await this.generateSummaryWithLLM(client, model, conversationText, focus);
          const cleanedToKeep = this.cleanToolMessages(toKeep);

          const newMessages: Message[] = [];
          if (originalSystem) newMessages.push(originalSystem);
          newMessages.push({ role: 'system', content: `[Conversation Summary]\n\n${summary}` });
          newMessages.push(...cleanedToKeep);

          this.currentConversation.messages = newMessages;
          this.currentConversation.compressed = true;
          this.currentConversation.summary = summary;
          this.currentConversation.updatedAt = Date.now();
          this.actualTokenCount = 0; // Reset to re-estimate

          return { before, after: newMessages.length, removed: before - newMessages.length, summary };
        }
      }
      return { before, after: before, removed: 0, summary: '' };
    }

    // Keep last 2 user messages and everything after them
    const keepFromIndex = userIndices[userIndices.length - 2];

    const toSummarize = otherMessages.slice(0, keepFromIndex);
    const toKeep = otherMessages.slice(keepFromIndex);

    // Make sure we're actually removing something meaningful
    const toSummarizeTokens = this.estimateTokens(toSummarize);
    if (toSummarizeTokens < 1000) {
      // Not enough to summarize
      return { before, after: before, removed: 0, summary: '' };
    }

    // Build conversation text for summarization (exclude tool messages from text, they're verbose)
    const conversationText = this.buildConversationText(toSummarize);

    // Create summary using LLM
    const summary = await this.generateSummaryWithLLM(client, model, conversationText, focus);

    // Build new message list - only include user/assistant from kept messages
    // Strip out orphaned tool messages to ensure clean conversation state
    const cleanedToKeep = this.cleanToolMessages(toKeep);

    const newMessages: Message[] = [];

    if (originalSystem) {
      newMessages.push(originalSystem);
    }

    newMessages.push({
      role: 'system',
      content: `[Conversation Summary]\n\n${summary}`,
    });

    newMessages.push(...cleanedToKeep);

    this.currentConversation.messages = newMessages;
    this.currentConversation.compressed = true;
    this.currentConversation.summary = summary;
    this.currentConversation.updatedAt = Date.now();
    this.actualTokenCount = 0; // Reset to re-estimate after next LLM call

    const after = this.currentConversation.messages.length;

    return { before, after, removed: before - after, summary };
  }

  /**
   * Remove orphaned tool messages and ensure tool_call/tool pairs are complete
   */
  private cleanToolMessages(messages: Message[]): Message[] {
    const result: Message[] = [];
    const pendingToolCallIds = new Set<string>();

    for (const msg of messages) {
      if (msg.role === 'assistant' && msg.tool_calls) {
        // Track expected tool responses
        for (const tc of msg.tool_calls) {
          pendingToolCallIds.add(tc.id);
        }
        result.push(msg);
      } else if (msg.role === 'tool' && msg.tool_call_id) {
        // Only include tool messages that have a matching assistant tool_call
        if (pendingToolCallIds.has(msg.tool_call_id)) {
          pendingToolCallIds.delete(msg.tool_call_id);
          result.push(msg);
        }
        // Skip orphaned tool messages
      } else {
        result.push(msg);
      }
    }

    // If there are pending tool calls without responses, remove those assistant messages too
    // to prevent "missing tool result" errors
    if (pendingToolCallIds.size > 0) {
      return result.filter(msg => {
        if (msg.role === 'assistant' && msg.tool_calls) {
          // Check if any tool_call is still pending
          const hasPending = msg.tool_calls.some(tc => pendingToolCallIds.has(tc.id));
          return !hasPending;
        }
        return true;
      });
    }

    return result;
  }

  private buildConversationText(messages: Message[]): string {
    const parts: string[] = [];

    for (const msg of messages) {
      if (msg.role === 'user') {
        parts.push(`User: ${msg.content}`);
      } else if (msg.role === 'assistant') {
        if (msg.tool_calls && msg.tool_calls.length > 0) {
          const tools = msg.tool_calls.map(tc => `${tc.function.name}(${tc.function.arguments.slice(0, 100)}...)`).join(', ');
          parts.push(`Assistant: [Used tools: ${tools}]`);
        }
        if (msg.content) {
          parts.push(`Assistant: ${msg.content}`);
        }
      } else if (msg.role === 'tool') {
        // Truncate tool output
        const content = msg.content.length > 500 ? msg.content.slice(0, 500) + '...' : msg.content;
        parts.push(`Tool result: ${content}`);
      }
    }

    return parts.join('\n\n');
  }

  /**
   * Detect if text contains significant Japanese characters
   */
  private isJapanese(text: string): boolean {
    // Count Japanese characters (hiragana, katakana, kanji)
    const japaneseChars = text.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g);
    return (japaneseChars?.length || 0) > 10;
  }

  private async generateSummaryWithLLM(
    client: LLMClient,
    model: string,
    conversationText: string,
    focus?: string
  ): Promise<string> {
    // Detect language from conversation
    const isJa = this.isJapanese(conversationText);

    const focusInstruction = focus
      ? (isJa ? `\n\n特に注目すべき点: ${focus}` : `\n\nPay special attention to: ${focus}`)
      : '';

    const summaryPrompt = isJa
      ? `以下の会話を要約してください。ユーザーの明示的なリクエストとアシスタントの行動に注意して要約してください。

この要約は会話を続けるためのコンテキストとして使用されます。以下の重要な情報を保持してください：

1. **完了したこと** - 完了したタスク、作成/修正したファイル
2. **進行中の作業** - 現在取り組んでいること
3. **関連ファイル** - 重要なファイルパスとその目的
4. **次のステップ** - 次にやるべきこと
5. **重要な決定** - 会話中に行われた重要な選択
6. **ユーザーの制約** - 言及された特定の要件や好み${focusInstruction}

要約する会話:
---
${conversationText}
---

構造化された形式で包括的な要約を日本語で書いてください。簡潔に、しかし作業を効果的に続けるために必要なすべての重要なコンテキストを保持してください。`
      : `Your task is to create a detailed summary of the conversation so far, paying close attention to the user's explicit requests and the assistant's previous actions.

This summary will be used as context when continuing the conversation, so preserve critical information including:

1. **What was accomplished** - Tasks completed, files created/modified
2. **Current work in progress** - What is being worked on now
3. **Files involved** - Important file paths and their purposes
4. **Next steps** - What needs to be done next
5. **Key decisions** - Important choices made during the conversation
6. **User constraints** - Any specific requirements or preferences mentioned${focusInstruction}

Conversation to summarize:
---
${conversationText}
---

Write a comprehensive summary in a structured format. Be concise but preserve all critical context needed to continue the work effectively.`;

    try {
      const response = await client.chat({
        model,
        messages: [{ role: 'user', content: summaryPrompt }],
      });

      return getTextContent(response.choices[0]?.message?.content || '') || this.createFallbackSummary(conversationText);
    } catch (error) {
      // Fallback to rule-based summary if LLM fails
      console.error('LLM summary failed, using fallback:', error);
      return this.createFallbackSummary(conversationText);
    }
  }

  private createFallbackSummary(conversationText: string): string {
    // Simple extraction as fallback
    const lines = conversationText.split('\n').filter(l => l.startsWith('User:') || l.startsWith('Assistant:'));
    return `Conversation summary (${lines.length} exchanges):\n` + lines.slice(-10).join('\n');
  }

  /**
   * Simple synchronous compact (fallback, no LLM)
   */
  compact(): { before: number; after: number; removed: number } {
    if (!this.currentConversation) {
      return { before: 0, after: 0, removed: 0 };
    }

    const before = this.currentConversation.messages.length;
    const originalSystem = this.currentConversation.messages.find(m => m.role === 'system');
    const otherMessages = this.currentConversation.messages.filter(m => m.role !== 'system');

    if (otherMessages.length <= 6) {
      return { before, after: before, removed: 0 };
    }

    let keepFromIndex = otherMessages.length;
    let userCount = 0;
    for (let i = otherMessages.length - 1; i >= 0; i--) {
      if (otherMessages[i].role === 'user') {
        userCount++;
        if (userCount >= 2) {
          keepFromIndex = i;
          break;
        }
      }
    }
    keepFromIndex = Math.max(0, Math.min(keepFromIndex, otherMessages.length - 4));

    const toSummarize = otherMessages.slice(0, keepFromIndex);
    const toKeep = otherMessages.slice(keepFromIndex);

    if (toSummarize.length === 0) {
      return { before, after: before, removed: 0 };
    }

    const summary = this.createSummary(toSummarize);

    const newMessages: Message[] = [];
    if (originalSystem) {
      newMessages.push(originalSystem);
    }
    newMessages.push({
      role: 'system',
      content: `[Conversation Summary]\n\n${summary}`,
    });
    newMessages.push(...toKeep);

    this.currentConversation.messages = newMessages;
    this.currentConversation.compressed = true;
    this.currentConversation.summary = summary;
    this.currentConversation.updatedAt = Date.now();

    const after = this.currentConversation.messages.length;
    return { before, after, removed: before - after };
  }

  getContextMessages(): Message[] {
    if (!this.currentConversation) return [];

    const messages = this.currentConversation.messages;
    const tokenEstimate = this.estimateTokens(messages);

    if (tokenEstimate < this.settings.maxContextTokens) {
      return messages;
    }

    // Need compression - set flag
    this.currentConversation.compressed = true;
    return this.compressContext(messages);
  }

  private estimateTokens(messages: Message[]): number {
    // Rough estimate: 4 chars = 1 token
    return messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0);
  }

  private compressContext(messages: Message[]): Message[] {
    const systemMessages = messages.filter((m) => m.role === 'system');
    const otherMessages = messages.filter((m) => m.role !== 'system');

    // Keep system messages + last N messages within threshold
    const threshold = this.settings.maxContextTokens * this.settings.compressionThreshold;
    const result: Message[] = [];
    let tokenCount = this.estimateTokens(systemMessages);

    // Add messages from newest to oldest
    for (let i = otherMessages.length - 1; i >= 0; i--) {
      const msg = otherMessages[i];
      const msgTokens = this.estimateTokens([msg]);

      if (tokenCount + msgTokens > threshold && result.length > 0) {
        // Summarize older messages
        const olderMessages = otherMessages.slice(0, i + 1);
        const summary = this.createSummary(olderMessages);
        result.unshift({
          role: 'system',
          content: `[Previous conversation summary]\n${summary}`,
        });
        break;
      }

      result.unshift(msg);
      tokenCount += msgTokens;
    }

    return [...systemMessages, ...result];
  }

  private createSummary(messages: Message[]): string {
    const parts: string[] = [];
    parts.push(`Previous conversation had ${messages.length} messages.`);
    parts.push('');
    parts.push('## Key Topics Discussed:');

    // Extract user requests with more context
    const userMessages = messages.filter(m => m.role === 'user');
    for (const msg of userMessages.slice(-10)) {
      const content = msg.content || '';
      // Keep more text, truncate only very long messages
      const truncated = content.length > 300 ? content.slice(0, 300) + '...' : content;
      parts.push(`- User asked: "${truncated}"`);
    }

    parts.push('');
    parts.push('## Key Actions Taken:');

    // Extract assistant actions including tool calls
    const assistantMessages = messages.filter(m => m.role === 'assistant');
    for (const msg of assistantMessages.slice(-10)) {
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        for (const tc of msg.tool_calls) {
          parts.push(`- Used tool: ${tc.function.name}`);
        }
      }
      if (msg.content && !isContentEmpty(msg.content)) {
        const content = getTextContent(msg.content);
        const truncated = content.length > 300 ? content.slice(0, 300) + '...' : content;
        parts.push(`- Assistant: ${truncated}`);
      }
    }

    // Extract tool results for context
    const toolMessages = messages.filter(m => m.role === 'tool');
    if (toolMessages.length > 0) {
      parts.push('');
      parts.push(`## Tool Executions: ${toolMessages.length} tools were executed.`);
    }

    return parts.join('\n');
  }

  save(): void {
    if (!this.currentConversation) return;

    const filepath = join(
      this.settings.historyDir,
      `${this.currentConversation.id}.json`
    );
    writeFileSync(filepath, JSON.stringify(this.currentConversation, null, 2));
  }

  load(id: string): Conversation | null {
    const filepath = join(this.settings.historyDir, `${id}.json`);
    if (!existsSync(filepath)) return null;

    try {
      const data = readFileSync(filepath, 'utf-8');
      this.currentConversation = JSON.parse(data);
      return this.currentConversation;
    } catch {
      return null;
    }
  }

  list(): { id: string; title: string; updatedAt: number }[] {
    if (!existsSync(this.settings.historyDir)) return [];

    const files = readdirSync(this.settings.historyDir).filter((f) =>
      f.endsWith('.json')
    );

    return files
      .map((f) => {
        try {
          const data = readFileSync(join(this.settings.historyDir, f), 'utf-8');
          const conv: Conversation = JSON.parse(data);
          return { id: conv.id, title: conv.title, updatedAt: conv.updatedAt };
        } catch {
          return null;
        }
      })
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .sort((a, b) => a.updatedAt - b.updatedAt); // Oldest first (like terminal history)
  }

  /**
   * Get the most recent conversation ID
   */
  getMostRecentId(): string | null {
    const conversations = this.list();
    if (conversations.length === 0) return null;
    // list() is sorted oldest first, so last item is most recent
    return conversations[conversations.length - 1].id;
  }

  /**
   * Load the most recent conversation
   */
  loadMostRecent(): Conversation | null {
    const id = this.getMostRecentId();
    if (!id) return null;
    return this.load(id);
  }
}
