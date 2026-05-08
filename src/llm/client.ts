import type {
  LLMClient,
  ChatCompletionRequest,
  ChatCompletionResponse,
  Message,
  StreamResponse,
  ToolCall,
  ToolDefinition,
  Usage,
} from './types.js';
import { getTextContent } from './types.js';

/**
 * Models known to not support OpenAI-style tool/function calling.
 * For these models we strip `tools` / `tool_choice` from the request body.
 */
const NO_TOOL_SUPPORT_PATTERNS: RegExp[] = [
  /phi-?[0-9]/i,
  /tinyllama/i,
  /stablelm/i,
  /falcon/i,
  /mpt/i,
  /dolly/i,
  /codellama/i,
  /deepseek-coder/i,
];

function modelSupportsTools(modelName: string): boolean {
  return !NO_TOOL_SUPPORT_PATTERNS.some((pattern) => pattern.test(modelName));
}

/**
 * OpenAI-compatible client (LM Studio, llama.cpp server, vLLM, openai-local, ...).
 *
 * Supports `reasoningEffort` by routing to the `/responses` streaming endpoint
 * (with `reasoning: { effort }`) and falling back to `/chat/completions` on error.
 */
export class OpenAICompatibleClient implements LLMClient {
  private baseUrl: string;
  private defaultModel: string;

  constructor(baseUrl: string, defaultModel: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.defaultModel = defaultModel;
  }

  async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const model = request.model || this.defaultModel;
    const supportsTools = modelSupportsTools(model);

    const body: Record<string, unknown> = {
      ...request,
      model,
      stream: false,
    };
    if (!supportsTools) {
      delete body.tools;
      delete body.tool_choice;
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<ChatCompletionResponse>;
  }

  async chatStream(
    request: ChatCompletionRequest,
    onChunk: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<StreamResponse> {
    if (request.reasoningEffort) {
      try {
        return await this.chatStreamResponses(request, onChunk, signal);
      } catch {
        // Fall through to /chat/completions
      }
    }
    return this.chatStreamCompletions(request, onChunk, signal);
  }

  /**
   * Streaming via the `/responses` endpoint, which carries reasoning metadata.
   */
  private async chatStreamResponses(
    request: ChatCompletionRequest,
    onChunk: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<StreamResponse> {
    const model = request.model || this.defaultModel;
    const systemMsg = request.messages.find((m) => m.role === 'system');
    const otherMsgs = request.messages.filter((m) => m.role !== 'system');

    let input: string | { role: string; content: string }[];
    if (otherMsgs.length === 1) {
      input = getTextContent(otherMsgs[0].content);
    } else {
      input = otherMsgs.map((m) => ({
        role: m.role,
        content: getTextContent(m.content),
      }));
    }

    const body: Record<string, unknown> = {
      model,
      input,
      stream: true,
      reasoning: { effort: request.reasoningEffort },
    };
    if (systemMsg) {
      body.instructions = getTextContent(systemMsg.content);
    }
    if (request.temperature !== undefined) {
      body.temperature = request.temperature;
    }

    const response = await fetch(`${this.baseUrl}/responses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      throw new Error(`Responses API error: ${response.status} ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let fullContent = '';
    let usage: Usage | undefined;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      const lines = text.split('\n').filter((line) => line.startsWith('data: '));

      for (const line of lines) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        try {
          const event = JSON.parse(data);
          if (event.type === 'response.output_text.delta' && typeof event.delta === 'string') {
            fullContent += event.delta;
            onChunk(event.delta);
          }
          if (event.output && Array.isArray(event.output)) {
            for (const item of event.output) {
              if (item.type === 'message' && item.content) {
                for (const c of item.content) {
                  if (c.type === 'output_text' && c.text) {
                    fullContent += c.text;
                    onChunk(c.text);
                  }
                }
              }
            }
          }
          if (event.usage && typeof event.usage === 'object') {
            const u = event.usage;
            usage = {
              prompt_tokens: u.input_tokens || 0,
              completion_tokens: u.output_tokens || 0,
              total_tokens: (u.input_tokens || 0) + (u.output_tokens || 0),
            };
          }
        } catch {
          // Ignore malformed SSE frames
        }
      }
    }

    // Strip channel/role markers some local servers emit, e.g. <|channel|>...
    fullContent = fullContent.replace(/<\|[^>]*>/g, '');

    return {
      message: { role: 'assistant', content: fullContent },
      usage,
    };
  }

  /**
   * Streaming via the standard `/chat/completions` endpoint.
   */
  private async chatStreamCompletions(
    request: ChatCompletionRequest,
    onChunk: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<StreamResponse> {
    // 30 minute hard cap for very long generations.
    const timeoutMs = 1800000;
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);
    const combinedSignal = signal
      ? AbortSignal.any([signal, timeoutController.signal])
      : timeoutController.signal;

    const model = request.model || this.defaultModel;
    const supportsTools = modelSupportsTools(model);

    const body: Record<string, unknown> = {
      ...request,
      model,
      stream: true,
      stream_options: { include_usage: true },
    };
    // reasoningEffort is consumed by chatStreamResponses; not a /chat/completions field.
    delete body.reasoningEffort;
    if (!supportsTools) {
      delete body.tools;
      delete body.tool_choice;
    }

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: combinedSignal,
      });

      if (!response.ok) {
        throw new Error(`LLM API error: ${response.status} ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let fullContent = '';
      let usage: Usage | undefined;
      const toolCallsMap = new Map<number, ToolCall>();

      let lastChunkTime = Date.now();
      const chunkTimeout = 180000;

      while (true) {
        if (Date.now() - lastChunkTime > chunkTimeout) {
          reader.cancel();
          throw new Error('Stream timeout: no data received for 60 seconds');
        }
        const { done, value } = await reader.read();
        if (done) break;
        lastChunkTime = Date.now();

        const text = decoder.decode(value, { stream: true });
        const lines = text.split('\n').filter((line) => line.startsWith('data: '));

        for (const line of lines) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const chunk = JSON.parse(data);
            if (chunk.usage) {
              usage = chunk.usage;
            }
            const delta = chunk.choices[0]?.delta;
            if (delta?.content) {
              fullContent += delta.content;
              onChunk(delta.content);
            }
            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                if (!toolCallsMap.has(tc.index)) {
                  toolCallsMap.set(tc.index, {
                    id: tc.id || '',
                    type: 'function',
                    function: { name: '', arguments: '' },
                  });
                }
                const existing = toolCallsMap.get(tc.index)!;
                if (tc.id) existing.id = tc.id;
                if (tc.function?.name) existing.function.name += tc.function.name;
                if (tc.function?.arguments) existing.function.arguments += tc.function.arguments;
              }
            }
          } catch {
            // Ignore malformed SSE frames
          }
        }
      }

      const message: Message = {
        role: 'assistant',
        content: fullContent,
      };
      if (toolCallsMap.size > 0) {
        message.tool_calls = Array.from(toolCallsMap.values());
      }
      return { message, usage };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async listModels(): Promise<string[]> {
    const response = await fetch(`${this.baseUrl}/models`);
    if (!response.ok) {
      throw new Error(`Failed to list models: ${response.status}`);
    }
    const data = (await response.json()) as { data?: { id: string }[] };
    return data.data?.map((m) => m.id) || [];
  }
}

/**
 * Native Ollama API client (`/api/chat`, `/api/tags`).
 */
export class OllamaClient implements LLMClient {
  private baseUrl: string;
  private defaultModel: string;

  constructor(baseUrl: string, defaultModel: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.defaultModel = defaultModel;
  }

  async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: request.model || this.defaultModel,
        messages: request.messages,
        stream: false,
        options: {
          num_predict: request.max_tokens,
          temperature: request.temperature,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const data = (await response.json()) as { message: Message };
    return {
      id: `ollama-${Date.now()}`,
      object: 'chat.completion',
      created: Date.now(),
      model: request.model || this.defaultModel,
      choices: [
        {
          index: 0,
          message: data.message,
          finish_reason: 'stop',
        },
      ],
    };
  }

  async chatStream(
    request: ChatCompletionRequest,
    onChunk: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<StreamResponse> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: request.model || this.defaultModel,
        messages: request.messages,
        stream: true,
      }),
      signal,
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let fullContent = '';
    let usage: Usage | undefined;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      const lines = text.split('\n').filter((line) => line.trim());

      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (data.message?.content) {
            fullContent += data.message.content;
            onChunk(data.message.content);
          }
          if (data.prompt_eval_count !== undefined || data.eval_count !== undefined) {
            usage = {
              prompt_tokens: data.prompt_eval_count || 0,
              completion_tokens: data.eval_count || 0,
              total_tokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
            };
          }
        } catch {
          // Ignore malformed lines
        }
      }
    }

    return {
      message: { role: 'assistant', content: fullContent },
      usage,
    };
  }

  async listModels(): Promise<string[]> {
    const response = await fetch(`${this.baseUrl}/api/tags`);
    if (!response.ok) {
      throw new Error(`Failed to list models: ${response.status}`);
    }
    const data = (await response.json()) as { models?: { name: string }[] };
    return data.models?.map((m) => m.name) || [];
  }
}

/**
 * Cloud client for OpenAI-compatible providers that require an API key
 * (OpenAI itself, xAI/Grok via `https://api.x.ai/v1`, ...).
 */
export class OpenAICloudClient implements LLMClient {
  private apiKey: string;
  private defaultModel: string;
  private baseUrl: string;

  constructor(apiKey: string, defaultModel: string, baseUrl = 'https://api.openai.com/v1') {
    this.apiKey = apiKey;
    this.defaultModel = defaultModel;
    this.baseUrl = baseUrl;
  }

  async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        ...request,
        model: request.model || this.defaultModel,
        stream: false,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${err}`);
    }

    return response.json() as Promise<ChatCompletionResponse>;
  }

  async chatStream(
    request: ChatCompletionRequest,
    onChunk: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<StreamResponse> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        ...request,
        model: request.model || this.defaultModel,
        stream: true,
        stream_options: { include_usage: true },
      }),
      signal,
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${err}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let fullContent = '';
    let usage: Usage | undefined;
    const toolCallsMap = new Map<number, ToolCall>();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      const lines = text.split('\n').filter((line) => line.startsWith('data: '));

      for (const line of lines) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        try {
          const chunk = JSON.parse(data);
          if (chunk.usage) usage = chunk.usage;
          const delta = chunk.choices[0]?.delta;
          if (delta?.content) {
            fullContent += delta.content;
            onChunk(delta.content);
          }
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              if (!toolCallsMap.has(tc.index)) {
                toolCallsMap.set(tc.index, {
                  id: tc.id || '',
                  type: 'function',
                  function: { name: '', arguments: '' },
                });
              }
              const existing = toolCallsMap.get(tc.index)!;
              if (tc.id) existing.id = tc.id;
              if (tc.function?.name) existing.function.name += tc.function.name;
              if (tc.function?.arguments) existing.function.arguments += tc.function.arguments;
            }
          }
        } catch {
          // Ignore malformed SSE frames
        }
      }
    }

    const message: Message = { role: 'assistant', content: fullContent };
    if (toolCallsMap.size > 0) {
      message.tool_calls = Array.from(toolCallsMap.values());
    }
    return { message, usage };
  }

  async listModels(): Promise<string[]> {
    if (this.baseUrl.includes('x.ai')) {
      return [
        'grok-4-1-fast-non-reasoning',
        'grok-4-1-fast-reasoning',
        'grok-4.20-0309-non-reasoning',
        'grok-4.20-0309-reasoning',
      ];
    }
    return ['gpt-5.4', 'gpt-5.4-mini', 'gpt-5.4-nano', 'gpt-5.3-codex'];
  }
}

/**
 * Anthropic Messages API client.
 */
export class AnthropicClient implements LLMClient {
  private apiKey: string;
  private defaultModel: string;
  private baseUrl = 'https://api.anthropic.com/v1';

  constructor(apiKey: string, defaultModel: string) {
    this.apiKey = apiKey;
    this.defaultModel = defaultModel;
  }

  private convertToAnthropicMessages(messages: Message[]): {
    system: string | undefined;
    messages: { role: 'assistant' | 'user'; content: string }[];
  } {
    const systemMsg = messages.find((m) => m.role === 'system');
    const otherMsgs = messages.filter((m) => m.role !== 'system');
    return {
      system: systemMsg ? getTextContent(systemMsg.content) : undefined,
      messages: otherMsgs.map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: getTextContent(m.content),
      })),
    };
  }

  private convertToolsToAnthropic(tools?: ToolDefinition[]) {
    if (!tools) return undefined;
    return tools.map((t) => ({
      name: t.function.name,
      description: t.function.description,
      input_schema: t.function.parameters,
    }));
  }

  async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const { system, messages } = this.convertToAnthropicMessages(request.messages);
    const body: Record<string, unknown> = {
      model: request.model || this.defaultModel,
      max_tokens: request.max_tokens || 8192,
      messages,
    };
    if (system) body.system = system;
    const anthropicTools = this.convertToolsToAnthropic(request.tools);
    if (anthropicTools) body.tools = anthropicTools;

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${err}`);
    }

    const data = (await response.json()) as {
      id: string;
      content: { type: string; text?: string; id?: string; name?: string; input?: unknown }[];
      stop_reason: string;
      usage: { input_tokens: number; output_tokens: number };
    };
    const textContent = data.content.find((c) => c.type === 'text');
    const toolUses = data.content.filter((c) => c.type === 'tool_use');

    const message: Message = {
      role: 'assistant',
      content: textContent?.text || '',
    };
    if (toolUses.length > 0) {
      message.tool_calls = toolUses.map((t) => ({
        id: t.id || '',
        type: 'function',
        function: {
          name: t.name || '',
          arguments: JSON.stringify(t.input),
        },
      }));
    }

    return {
      id: data.id,
      object: 'chat.completion',
      created: Date.now(),
      model: request.model || this.defaultModel,
      choices: [{ index: 0, message, finish_reason: data.stop_reason }],
      usage: {
        prompt_tokens: data.usage.input_tokens,
        completion_tokens: data.usage.output_tokens,
        total_tokens: data.usage.input_tokens + data.usage.output_tokens,
      },
    };
  }

  async chatStream(
    request: ChatCompletionRequest,
    onChunk: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<StreamResponse> {
    const { system, messages } = this.convertToAnthropicMessages(request.messages);
    const body: Record<string, unknown> = {
      model: request.model || this.defaultModel,
      max_tokens: request.max_tokens || 8192,
      messages,
      stream: true,
    };
    if (system) body.system = system;
    const anthropicTools = this.convertToolsToAnthropic(request.tools);
    if (anthropicTools) body.tools = anthropicTools;

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${err}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let fullContent = '';
    let usage: Usage | undefined;
    const toolCalls: ToolCall[] = [];
    let currentToolIndex = -1;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      const lines = text.split('\n').filter((line) => line.startsWith('data: '));

      for (const line of lines) {
        const data = line.slice(6);
        if (!data) continue;
        try {
          const event = JSON.parse(data);
          if (event.type === 'content_block_start' && event.content_block?.type === 'tool_use') {
            currentToolIndex++;
            toolCalls.push({
              id: event.content_block.id || '',
              type: 'function',
              function: { name: event.content_block.name || '', arguments: '' },
            });
          }
          if (event.type === 'content_block_delta') {
            if (event.delta?.type === 'text_delta' && event.delta.text) {
              fullContent += event.delta.text;
              onChunk(event.delta.text);
            }
            if (
              event.delta?.type === 'input_json_delta' &&
              event.delta.partial_json &&
              currentToolIndex >= 0
            ) {
              toolCalls[currentToolIndex].function.arguments += event.delta.partial_json;
            }
          }
          if (event.type === 'message_delta' && event.usage) {
            usage = {
              prompt_tokens: event.usage.input_tokens,
              completion_tokens: event.usage.output_tokens,
              total_tokens: event.usage.input_tokens + event.usage.output_tokens,
            };
          }
          if (event.type === 'message_start' && event.message?.usage) {
            usage = {
              prompt_tokens: event.message.usage.input_tokens,
              completion_tokens: event.message.usage.output_tokens,
              total_tokens:
                event.message.usage.input_tokens + event.message.usage.output_tokens,
            };
          }
        } catch {
          // Ignore malformed SSE frames
        }
      }
    }

    const message: Message = { role: 'assistant', content: fullContent };
    if (toolCalls.length > 0) {
      message.tool_calls = toolCalls;
    }
    return { message, usage };
  }

  async listModels(): Promise<string[]> {
    return [
      'claude-opus-4-6',
      'claude-sonnet-4-6',
      'claude-opus-4-5',
      'claude-sonnet-4-5',
      'claude-haiku-4-5',
    ];
  }
}

/**
 * Google Gemini client (`generativelanguage.googleapis.com`).
 */
export class GeminiClient implements LLMClient {
  private apiKey: string;
  private defaultModel: string;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  constructor(apiKey: string, defaultModel: string) {
    this.apiKey = apiKey;
    this.defaultModel = defaultModel;
  }

  private convertToGeminiMessages(messages: Message[]): {
    systemInstruction: { parts: { text: string }[] } | undefined;
    contents: { role: 'user' | 'model'; parts: { text: string }[] }[];
  } {
    const systemMsg = messages.find((m) => m.role === 'system');
    const otherMsgs = messages.filter((m) => m.role !== 'system');
    return {
      systemInstruction: systemMsg
        ? { parts: [{ text: getTextContent(systemMsg.content) }] }
        : undefined,
      contents: otherMsgs.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: getTextContent(m.content) }],
      })),
    };
  }

  private convertToolsToGemini(tools?: ToolDefinition[]) {
    if (!tools) return undefined;
    return [
      {
        functionDeclarations: tools.map((t) => ({
          name: t.function.name,
          description: t.function.description,
          parameters: t.function.parameters,
        })),
      },
    ];
  }

  async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const model = request.model || this.defaultModel;
    const { systemInstruction, contents } = this.convertToGeminiMessages(request.messages);
    const body: Record<string, unknown> = { contents };
    if (systemInstruction) body.systemInstruction = systemInstruction;
    const geminiTools = this.convertToolsToGemini(request.tools);
    if (geminiTools) body.tools = geminiTools;

    const response = await fetch(
      `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${err}`);
    }

    const data = (await response.json()) as {
      candidates: {
        content?: { parts: { text?: string; functionCall?: { name: string; args: unknown } }[] };
        finishReason?: string;
      }[];
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
      };
    };
    const parts = data.candidates[0]?.content?.parts || [];
    const textPart = parts.find((p) => p.text);
    const functionCalls = parts.filter((p) => p.functionCall);

    const message: Message = {
      role: 'assistant',
      content: textPart?.text || '',
    };
    if (functionCalls.length > 0) {
      message.tool_calls = functionCalls.map((p, i) => ({
        id: `call_${i}`,
        type: 'function',
        function: {
          name: p.functionCall!.name,
          arguments: JSON.stringify(p.functionCall!.args),
        },
      }));
    }

    return {
      id: `gemini-${Date.now()}`,
      object: 'chat.completion',
      created: Date.now(),
      model,
      choices: [
        {
          index: 0,
          message,
          finish_reason: data.candidates[0]?.finishReason || 'stop',
        },
      ],
      usage: {
        prompt_tokens: data.usageMetadata?.promptTokenCount || 0,
        completion_tokens: data.usageMetadata?.candidatesTokenCount || 0,
        total_tokens: data.usageMetadata?.totalTokenCount || 0,
      },
    };
  }

  async chatStream(
    request: ChatCompletionRequest,
    onChunk: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<StreamResponse> {
    const model = request.model || this.defaultModel;
    const { systemInstruction, contents } = this.convertToGeminiMessages(request.messages);
    const body: Record<string, unknown> = { contents };
    if (systemInstruction) body.systemInstruction = systemInstruction;
    const geminiTools = this.convertToolsToGemini(request.tools);
    if (geminiTools) body.tools = geminiTools;

    const response = await fetch(
      `${this.baseUrl}/models/${model}:streamGenerateContent?alt=sse&key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      }
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${err}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let fullContent = '';
    let usage: Usage | undefined;
    const toolCalls: ToolCall[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      const lines = text.split('\n').filter((line) => line.startsWith('data: '));

      for (const line of lines) {
        const data = line.slice(6);
        if (!data) continue;
        try {
          const chunk = JSON.parse(data);
          const parts = chunk.candidates?.[0]?.content?.parts || [];
          for (const part of parts) {
            if (part.text) {
              fullContent += part.text;
              onChunk(part.text);
            }
            if (part.functionCall) {
              toolCalls.push({
                id: `call_${toolCalls.length}`,
                type: 'function',
                function: {
                  name: part.functionCall.name,
                  arguments: JSON.stringify(part.functionCall.args),
                },
              });
            }
          }
          if (chunk.usageMetadata) {
            usage = {
              prompt_tokens: chunk.usageMetadata.promptTokenCount,
              completion_tokens: chunk.usageMetadata.candidatesTokenCount,
              total_tokens: chunk.usageMetadata.totalTokenCount,
            };
          }
        } catch {
          // Ignore malformed SSE frames
        }
      }
    }

    const message: Message = { role: 'assistant', content: fullContent };
    if (toolCalls.length > 0) {
      message.tool_calls = toolCalls;
    }
    return { message, usage };
  }

  async listModels(): Promise<string[]> {
    return ['gemini-3.1-pro', 'gemini-3.1-flash', 'gemini-3.1-flash-lite'];
  }
}

/**
 * Remote relay client — talks to a Synaptic-hosted relay that fronts an
 * OpenAI-compatible API at `/v1`.
 */
export class RemoteClient implements LLMClient {
  private baseUrl: string;
  private apiKey: string;
  private defaultModel: string;

  constructor(baseUrl: string, apiKey: string, defaultModel = 'default') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
    this.defaultModel = defaultModel;
  }

  async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        ...request,
        model: request.model || this.defaultModel,
        stream: false,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Remote API error: ${response.status} - ${err}`);
    }

    return response.json() as Promise<ChatCompletionResponse>;
  }

  async chatStream(
    request: ChatCompletionRequest,
    onChunk: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<StreamResponse> {
    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        ...request,
        model: request.model || this.defaultModel,
        stream: true,
        stream_options: { include_usage: true },
      }),
      signal,
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Remote API error: ${response.status} - ${err}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let fullContent = '';
    let usage: Usage | undefined;
    const toolCallsMap = new Map<number, ToolCall>();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      const lines = text.split('\n').filter((line) => line.startsWith('data: '));

      for (const line of lines) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        try {
          const chunk = JSON.parse(data);
          if (chunk.usage) usage = chunk.usage;
          const delta = chunk.choices[0]?.delta;
          if (delta?.content) {
            fullContent += delta.content;
            onChunk(delta.content);
          }
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              if (!toolCallsMap.has(tc.index)) {
                toolCallsMap.set(tc.index, {
                  id: tc.id || '',
                  type: 'function',
                  function: { name: '', arguments: '' },
                });
              }
              const existing = toolCallsMap.get(tc.index)!;
              if (tc.id) existing.id = tc.id;
              if (tc.function?.name) existing.function.name += tc.function.name;
              if (tc.function?.arguments) existing.function.arguments += tc.function.arguments;
            }
          }
        } catch {
          // Ignore malformed SSE frames
        }
      }
    }

    const message: Message = { role: 'assistant', content: fullContent };
    if (toolCallsMap.size > 0) {
      message.tool_calls = Array.from(toolCallsMap.values());
    }
    return { message, usage };
  }

  async listModels(): Promise<string[]> {
    const response = await fetch(`${this.baseUrl}/v1/models`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    if (!response.ok) {
      throw new Error(`Failed to list models: ${response.status}`);
    }
    const data = (await response.json()) as { data?: { id: string }[] };
    return data.data?.map((m) => m.id) || [];
  }
}

export type Provider =
  | 'ollama'
  | 'lmstudio'
  | 'openai-local'
  | 'openai'
  | 'xai'
  | 'anthropic'
  | 'google';

/**
 * Factory: build an LLMClient for a local or cloud provider.
 *
 * For `ollama`, `baseUrlOrApiKey` is a base URL.
 * For `openai`/`xai`/`anthropic`/`google`, it is an API key.
 * For `lmstudio`/`openai-local` it is a base URL.
 */
export function createClient(
  provider: Provider | string,
  baseUrlOrApiKey: string,
  model: string
): LLMClient {
  switch (provider) {
    case 'ollama':
      return new OllamaClient(baseUrlOrApiKey, model);
    case 'lmstudio':
    case 'openai-local':
      return new OpenAICompatibleClient(baseUrlOrApiKey, model);
    case 'openai':
      return new OpenAICloudClient(baseUrlOrApiKey, model);
    case 'xai':
      return new OpenAICloudClient(baseUrlOrApiKey, model, 'https://api.x.ai/v1');
    case 'anthropic':
      return new AnthropicClient(baseUrlOrApiKey, model);
    case 'google':
      return new GeminiClient(baseUrlOrApiKey, model);
    default:
      return new OpenAICompatibleClient(baseUrlOrApiKey, model);
  }
}

export interface RemoteClientConfig {
  url: string;
  apiKey: string;
  model?: string;
}

/**
 * Factory: build a RemoteClient from a config object.
 */
export function createRemoteClient(config: RemoteClientConfig): RemoteClient {
  return new RemoteClient(config.url, config.apiKey, config.model);
}
