import type { ToolDefinition, ToolCall } from '../llm/types.js';

export interface ToolHandler {
  definition: ToolDefinition;
  execute: (args: Record<string, unknown>) => Promise<string>;
}

export class ToolRegistry {
  private tools: Map<string, ToolHandler> = new Map();

  register(handler: ToolHandler): void {
    this.tools.set(handler.definition.function.name, handler);
  }

  registerMultiple(handlers: ToolHandler[]): void {
    handlers.forEach((h) => this.register(h));
  }

  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  unregisterMultiple(names: string[]): void {
    names.forEach((n) => this.unregister(n));
  }

  get(name: string): ToolHandler | undefined {
    return this.tools.get(name);
  }

  getDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((h) => h.definition);
  }

  async execute(toolCall: ToolCall): Promise<string> {
    const handler = this.tools.get(toolCall.function.name);
    if (!handler) {
      return JSON.stringify({ error: `Unknown tool: ${toolCall.function.name}` });
    }

    try {
      const args = JSON.parse(toolCall.function.arguments);
      const result = await handler.execute(args);
      return result;
    } catch (error) {
      return JSON.stringify({
        error: `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  async executeMultiple(
    toolCalls: ToolCall[]
  ): Promise<{ id: string; result: string }[]> {
    const results = await Promise.all(
      toolCalls.map(async (tc) => ({
        id: tc.id,
        result: await this.execute(tc),
      }))
    );
    return results;
  }

  list(): string[] {
    return Array.from(this.tools.keys());
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }
}
