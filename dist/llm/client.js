import { getTextContent } from './types.js';
export class OpenAICompatibleClient {
    baseUrl;
    defaultModel;
    constructor(baseUrl, defaultModel) {
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.defaultModel = defaultModel;
    }
    async chat(request) {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...request,
                model: request.model || this.defaultModel,
                stream: false,
            }),
        });
        if (!response.ok) {
            throw new Error(`LLM API error: ${response.status} ${response.statusText}`);
        }
        return response.json();
    }
    async chatStream(request, onChunk, signal) {
        // Create timeout signal (5 minutes max for long responses)
        const timeoutMs = 300000;
        const timeoutController = new AbortController();
        const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);
        // Combine with user signal
        const combinedSignal = signal
            ? AbortSignal.any([signal, timeoutController.signal])
            : timeoutController.signal;
        try {
            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...request,
                    model: request.model || this.defaultModel,
                    stream: true,
                    stream_options: { include_usage: true },
                }),
                signal: combinedSignal,
            });
            if (!response.ok) {
                throw new Error(`LLM API error: ${response.status} ${response.statusText}`);
            }
            const reader = response.body?.getReader();
            if (!reader)
                throw new Error('No response body');
            const decoder = new TextDecoder();
            let fullContent = '';
            let usage;
            const toolCallsMap = new Map();
            let lastChunkTime = Date.now();
            const chunkTimeout = 60000; // 60s timeout between chunks
            while (true) {
                // Check for chunk timeout
                if (Date.now() - lastChunkTime > chunkTimeout) {
                    reader.cancel();
                    throw new Error('Stream timeout: no data received for 60 seconds');
                }
                const { done, value } = await reader.read();
                if (done)
                    break;
                lastChunkTime = Date.now();
                const text = decoder.decode(value, { stream: true });
                const lines = text.split('\n').filter((line) => line.startsWith('data: '));
                for (const line of lines) {
                    const data = line.slice(6);
                    if (data === '[DONE]')
                        continue;
                    try {
                        const chunk = JSON.parse(data);
                        // Capture usage from final chunk
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
                                const existing = toolCallsMap.get(tc.index);
                                if (tc.id) {
                                    existing.id = tc.id;
                                }
                                if (tc.function?.name) {
                                    existing.function.name += tc.function.name;
                                }
                                if (tc.function?.arguments) {
                                    existing.function.arguments += tc.function.arguments;
                                }
                            }
                        }
                    }
                    catch {
                        // Skip invalid JSON
                    }
                }
            }
            const message = {
                role: 'assistant',
                content: fullContent,
            };
            if (toolCallsMap.size > 0) {
                message.tool_calls = Array.from(toolCallsMap.values());
            }
            return { message, usage };
        }
        finally {
            clearTimeout(timeoutId);
        }
    }
    async listModels() {
        const response = await fetch(`${this.baseUrl}/models`);
        if (!response.ok) {
            throw new Error(`Failed to list models: ${response.status}`);
        }
        const data = await response.json();
        return data.data?.map((m) => m.id) || [];
    }
}
export class OllamaClient {
    baseUrl;
    defaultModel;
    constructor(baseUrl, defaultModel) {
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.defaultModel = defaultModel;
    }
    async chat(request) {
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
        const data = await response.json();
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
    async chatStream(request, onChunk, signal) {
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
        if (!reader)
            throw new Error('No response body');
        const decoder = new TextDecoder();
        let fullContent = '';
        let usage;
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            const text = decoder.decode(value, { stream: true });
            const lines = text.split('\n').filter((line) => line.trim());
            for (const line of lines) {
                try {
                    const data = JSON.parse(line);
                    if (data.message?.content) {
                        fullContent += data.message.content;
                        onChunk(data.message.content);
                    }
                    // Ollama returns token counts in final message
                    if (data.prompt_eval_count !== undefined || data.eval_count !== undefined) {
                        usage = {
                            prompt_tokens: data.prompt_eval_count || 0,
                            completion_tokens: data.eval_count || 0,
                            total_tokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
                        };
                    }
                }
                catch {
                    // Skip invalid JSON
                }
            }
        }
        return {
            message: { role: 'assistant', content: fullContent },
            usage,
        };
    }
    async listModels() {
        const response = await fetch(`${this.baseUrl}/api/tags`);
        if (!response.ok) {
            throw new Error(`Failed to list models: ${response.status}`);
        }
        const data = await response.json();
        return data.models?.map((m) => m.name) || [];
    }
}
// OpenAI Cloud API Client
export class OpenAICloudClient {
    apiKey;
    defaultModel;
    baseUrl = 'https://api.openai.com/v1';
    constructor(apiKey, defaultModel) {
        this.apiKey = apiKey;
        this.defaultModel = defaultModel;
    }
    async chat(request) {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
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
        return response.json();
    }
    async chatStream(request, onChunk, signal) {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
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
        if (!reader)
            throw new Error('No response body');
        const decoder = new TextDecoder();
        let fullContent = '';
        let usage;
        const toolCallsMap = new Map();
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            const text = decoder.decode(value, { stream: true });
            const lines = text.split('\n').filter((line) => line.startsWith('data: '));
            for (const line of lines) {
                const data = line.slice(6);
                if (data === '[DONE]')
                    continue;
                try {
                    const chunk = JSON.parse(data);
                    if (chunk.usage)
                        usage = chunk.usage;
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
                            const existing = toolCallsMap.get(tc.index);
                            if (tc.id)
                                existing.id = tc.id;
                            if (tc.function?.name)
                                existing.function.name += tc.function.name;
                            if (tc.function?.arguments)
                                existing.function.arguments += tc.function.arguments;
                        }
                    }
                }
                catch {
                    // Skip invalid JSON
                }
            }
        }
        const message = { role: 'assistant', content: fullContent };
        if (toolCallsMap.size > 0) {
            message.tool_calls = Array.from(toolCallsMap.values());
        }
        return { message, usage };
    }
    async listModels() {
        return ['gpt-5.4', 'gpt-5.4-pro', 'gpt-5.4-mini', 'gpt-5.3-codex'];
    }
}
// Anthropic Claude API Client
export class AnthropicClient {
    apiKey;
    defaultModel;
    baseUrl = 'https://api.anthropic.com/v1';
    constructor(apiKey, defaultModel) {
        this.apiKey = apiKey;
        this.defaultModel = defaultModel;
    }
    convertToAnthropicMessages(messages) {
        const systemMsg = messages.find(m => m.role === 'system');
        const otherMsgs = messages.filter(m => m.role !== 'system');
        return {
            system: systemMsg ? getTextContent(systemMsg.content) : undefined,
            messages: otherMsgs.map(m => ({
                role: m.role === 'assistant' ? 'assistant' : 'user',
                content: getTextContent(m.content),
            })),
        };
    }
    convertToolsToAnthropic(tools) {
        if (!tools)
            return undefined;
        return tools.map(t => ({
            name: t.function.name,
            description: t.function.description,
            input_schema: t.function.parameters,
        }));
    }
    async chat(request) {
        const { system, messages } = this.convertToAnthropicMessages(request.messages);
        const body = {
            model: request.model || this.defaultModel,
            max_tokens: request.max_tokens || 8192,
            messages,
        };
        if (system)
            body.system = system;
        const anthropicTools = this.convertToolsToAnthropic(request.tools);
        if (anthropicTools)
            body.tools = anthropicTools;
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
        const data = await response.json();
        // Convert Anthropic response to OpenAI format
        const textContent = data.content.find(c => c.type === 'text');
        const toolUses = data.content.filter(c => c.type === 'tool_use');
        const message = {
            role: 'assistant',
            content: textContent?.text || '',
        };
        if (toolUses.length > 0) {
            message.tool_calls = toolUses.map(t => ({
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
    async chatStream(request, onChunk, signal) {
        const { system, messages } = this.convertToAnthropicMessages(request.messages);
        const body = {
            model: request.model || this.defaultModel,
            max_tokens: request.max_tokens || 8192,
            messages,
            stream: true,
        };
        if (system)
            body.system = system;
        const anthropicTools = this.convertToolsToAnthropic(request.tools);
        if (anthropicTools)
            body.tools = anthropicTools;
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
        if (!reader)
            throw new Error('No response body');
        const decoder = new TextDecoder();
        let fullContent = '';
        let usage;
        const toolCalls = [];
        let currentToolIndex = -1;
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            const text = decoder.decode(value, { stream: true });
            const lines = text.split('\n').filter(line => line.startsWith('data: '));
            for (const line of lines) {
                const data = line.slice(6);
                if (!data)
                    continue;
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
                        if (event.delta?.type === 'input_json_delta' && event.delta.partial_json && currentToolIndex >= 0) {
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
                            total_tokens: event.message.usage.input_tokens + event.message.usage.output_tokens,
                        };
                    }
                }
                catch {
                    // Skip invalid JSON
                }
            }
        }
        const message = { role: 'assistant', content: fullContent };
        if (toolCalls.length > 0) {
            message.tool_calls = toolCalls;
        }
        return { message, usage };
    }
    async listModels() {
        return ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-opus-4-5', 'claude-sonnet-4-5', 'claude-haiku-4-5'];
    }
}
// Google Gemini API Client
export class GeminiClient {
    apiKey;
    defaultModel;
    baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
    constructor(apiKey, defaultModel) {
        this.apiKey = apiKey;
        this.defaultModel = defaultModel;
    }
    convertToGeminiMessages(messages) {
        const systemMsg = messages.find(m => m.role === 'system');
        const otherMsgs = messages.filter(m => m.role !== 'system');
        return {
            systemInstruction: systemMsg ? { parts: [{ text: getTextContent(systemMsg.content) }] } : undefined,
            contents: otherMsgs.map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: getTextContent(m.content) }],
            })),
        };
    }
    convertToolsToGemini(tools) {
        if (!tools)
            return undefined;
        return [{
                functionDeclarations: tools.map(t => ({
                    name: t.function.name,
                    description: t.function.description,
                    parameters: t.function.parameters,
                })),
            }];
    }
    async chat(request) {
        const model = request.model || this.defaultModel;
        const { systemInstruction, contents } = this.convertToGeminiMessages(request.messages);
        const body = { contents };
        if (systemInstruction)
            body.systemInstruction = systemInstruction;
        const geminiTools = this.convertToolsToGemini(request.tools);
        if (geminiTools)
            body.tools = geminiTools;
        const response = await fetch(`${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Gemini API error: ${response.status} - ${err}`);
        }
        const data = await response.json();
        const parts = data.candidates[0]?.content?.parts || [];
        const textPart = parts.find(p => p.text);
        const functionCalls = parts.filter(p => p.functionCall);
        const message = {
            role: 'assistant',
            content: textPart?.text || '',
        };
        if (functionCalls.length > 0) {
            message.tool_calls = functionCalls.map((p, i) => ({
                id: `call_${i}`,
                type: 'function',
                function: {
                    name: p.functionCall.name,
                    arguments: JSON.stringify(p.functionCall.args),
                },
            }));
        }
        return {
            id: `gemini-${Date.now()}`,
            object: 'chat.completion',
            created: Date.now(),
            model,
            choices: [{ index: 0, message, finish_reason: data.candidates[0]?.finishReason || 'stop' }],
            usage: {
                prompt_tokens: data.usageMetadata?.promptTokenCount || 0,
                completion_tokens: data.usageMetadata?.candidatesTokenCount || 0,
                total_tokens: data.usageMetadata?.totalTokenCount || 0,
            },
        };
    }
    async chatStream(request, onChunk, signal) {
        const model = request.model || this.defaultModel;
        const { systemInstruction, contents } = this.convertToGeminiMessages(request.messages);
        const body = { contents };
        if (systemInstruction)
            body.systemInstruction = systemInstruction;
        const geminiTools = this.convertToolsToGemini(request.tools);
        if (geminiTools)
            body.tools = geminiTools;
        const response = await fetch(`${this.baseUrl}/models/${model}:streamGenerateContent?alt=sse&key=${this.apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal,
        });
        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Gemini API error: ${response.status} - ${err}`);
        }
        const reader = response.body?.getReader();
        if (!reader)
            throw new Error('No response body');
        const decoder = new TextDecoder();
        let fullContent = '';
        let usage;
        const toolCalls = [];
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            const text = decoder.decode(value, { stream: true });
            const lines = text.split('\n').filter(line => line.startsWith('data: '));
            for (const line of lines) {
                const data = line.slice(6);
                if (!data)
                    continue;
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
                }
                catch {
                    // Skip invalid JSON
                }
            }
        }
        const message = { role: 'assistant', content: fullContent };
        if (toolCalls.length > 0) {
            message.tool_calls = toolCalls;
        }
        return { message, usage };
    }
    async listModels() {
        return ['gemini-3.1-pro', 'gemini-3.1-flash', 'gemini-3.1-flash-lite'];
    }
}
// Remote Synaptic Server Client
export class RemoteClient {
    baseUrl;
    apiKey;
    defaultModel;
    constructor(baseUrl, apiKey, defaultModel = 'default') {
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.apiKey = apiKey;
        this.defaultModel = defaultModel;
    }
    async chat(request) {
        const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
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
        return response.json();
    }
    async chatStream(request, onChunk, signal) {
        const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
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
        if (!reader)
            throw new Error('No response body');
        const decoder = new TextDecoder();
        let fullContent = '';
        let usage;
        const toolCallsMap = new Map();
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            const text = decoder.decode(value, { stream: true });
            const lines = text.split('\n').filter((line) => line.startsWith('data: '));
            for (const line of lines) {
                const data = line.slice(6);
                if (data === '[DONE]')
                    continue;
                try {
                    const chunk = JSON.parse(data);
                    if (chunk.usage)
                        usage = chunk.usage;
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
                            const existing = toolCallsMap.get(tc.index);
                            if (tc.id)
                                existing.id = tc.id;
                            if (tc.function?.name)
                                existing.function.name += tc.function.name;
                            if (tc.function?.arguments)
                                existing.function.arguments += tc.function.arguments;
                        }
                    }
                }
                catch {
                    // Skip invalid JSON
                }
            }
        }
        const message = { role: 'assistant', content: fullContent };
        if (toolCallsMap.size > 0) {
            message.tool_calls = Array.from(toolCallsMap.values());
        }
        return { message, usage };
    }
    async listModels() {
        const response = await fetch(`${this.baseUrl}/v1/models`, {
            headers: { 'Authorization': `Bearer ${this.apiKey}` },
        });
        if (!response.ok) {
            throw new Error(`Failed to list models: ${response.status}`);
        }
        const data = await response.json();
        return data.data?.map((m) => m.id) || [];
    }
}
export function createClient(provider, baseUrlOrApiKey, model) {
    switch (provider) {
        case 'ollama':
            return new OllamaClient(baseUrlOrApiKey, model);
        case 'lmstudio':
        case 'openai-local':
            return new OpenAICompatibleClient(baseUrlOrApiKey, model);
        case 'openai':
            return new OpenAICloudClient(baseUrlOrApiKey, model);
        case 'anthropic':
            return new AnthropicClient(baseUrlOrApiKey, model);
        case 'google':
            return new GeminiClient(baseUrlOrApiKey, model);
        default:
            return new OpenAICompatibleClient(baseUrlOrApiKey, model);
    }
}
/**
 * Create a remote client for Synaptic server
 */
export function createRemoteClient(config) {
    return new RemoteClient(config.url, config.apiKey, config.model);
}
//# sourceMappingURL=client.js.map