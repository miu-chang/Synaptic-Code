export type MessageContent = string | ContentPart[];
export interface TextContent {
    type: 'text';
    text: string;
}
export interface ImageContent {
    type: 'image_url';
    image_url: {
        url: string;
        detail?: 'auto' | 'low' | 'high';
    };
}
export type ContentPart = TextContent | ImageContent;
/**
 * Extract text from MessageContent (handles both string and ContentPart[])
 */
export declare function getTextContent(content: MessageContent): string;
/**
 * Check if MessageContent is empty
 */
export declare function isContentEmpty(content: MessageContent): boolean;
export interface Message {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: MessageContent;
    tool_calls?: ToolCall[];
    tool_call_id?: string;
    name?: string;
}
export interface ToolCall {
    id: string;
    type: 'function';
    function: {
        name: string;
        arguments: string;
    };
}
export interface ToolDefinition {
    type: 'function';
    function: {
        name: string;
        description: string;
        parameters: {
            type: 'object';
            properties: Record<string, unknown>;
            required?: string[];
        };
    };
}
export interface ChatCompletionRequest {
    model: string;
    messages: Message[];
    tools?: ToolDefinition[];
    tool_choice?: 'auto' | 'none' | {
        type: 'function';
        function: {
            name: string;
        };
    };
    stream?: boolean;
    max_tokens?: number;
    temperature?: number;
}
export interface ChatCompletionResponse {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: {
        index: number;
        message: Message;
        finish_reason: string;
    }[];
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}
export interface StreamToolCallDelta {
    index: number;
    id?: string;
    type?: 'function';
    function?: {
        name?: string;
        arguments?: string;
    };
}
export interface StreamDelta {
    role?: 'assistant';
    content?: string;
    tool_calls?: StreamToolCallDelta[];
}
export interface StreamChunk {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: {
        index: number;
        delta: StreamDelta;
        finish_reason: string | null;
    }[];
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}
export interface Usage {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
}
export interface StreamResponse {
    message: Message;
    usage?: Usage;
}
export interface LLMClient {
    chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
    chatStream(request: ChatCompletionRequest, onChunk: (chunk: string) => void, signal?: AbortSignal): Promise<StreamResponse>;
    listModels(): Promise<string[]>;
}
//# sourceMappingURL=types.d.ts.map