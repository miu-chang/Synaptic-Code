import type { ToolDefinition, ToolCall } from '../llm/types.js';
export interface ToolHandler {
    definition: ToolDefinition;
    execute: (args: Record<string, unknown>) => Promise<string>;
}
export declare class ToolRegistry {
    private tools;
    register(handler: ToolHandler): void;
    registerMultiple(handlers: ToolHandler[]): void;
    unregister(name: string): boolean;
    unregisterMultiple(names: string[]): void;
    get(name: string): ToolHandler | undefined;
    getDefinitions(): ToolDefinition[];
    execute(toolCall: ToolCall): Promise<string>;
    executeMultiple(toolCalls: ToolCall[]): Promise<{
        id: string;
        result: string;
    }[]>;
    list(): string[];
    has(name: string): boolean;
}
//# sourceMappingURL=registry.d.ts.map