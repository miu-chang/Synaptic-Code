import type { ToolDefinition, ToolCall } from '../llm/types.js';
import * as synapticClient from '../synaptic/client.js';

export interface ToolHandler {
  definition: ToolDefinition;
  execute: (args: Record<string, unknown>) => Promise<string>;
}

// Tools blocked in restricted mode (offline > 3 days)
const RESTRICTED_MODE_BLOCKED_TOOLS = new Set([
  'bash',
  'bash_background',
  'write_file',
  'edit_file',
  'web_fetch',
  'web_search',
]);

export class ToolRegistry {
  private tools: Map<string, ToolHandler> = new Map();
  private restrictedMode: boolean = false;

  setRestrictedMode(restricted: boolean): void {
    this.restrictedMode = restricted;
  }

  isRestrictedMode(): boolean {
    return this.restrictedMode;
  }

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
    const allTools = Array.from(this.tools.values());

    // Filter out blocked tools in restricted mode
    if (this.restrictedMode) {
      return allTools
        .filter((h) => !RESTRICTED_MODE_BLOCKED_TOOLS.has(h.definition.function.name))
        .map((h) => h.definition);
    }

    return allTools.map((h) => h.definition);
  }

  async execute(toolCall: ToolCall): Promise<string> {
    const toolName = toolCall.function.name;

    // Block dangerous tools in restricted mode
    if (this.restrictedMode && RESTRICTED_MODE_BLOCKED_TOOLS.has(toolName)) {
      return JSON.stringify({
        error: `Tool "${toolName}" is disabled in restricted mode. Please connect to the internet to verify your license.`,
        restricted: true,
      });
    }

    const handler = this.tools.get(toolName);
    if (!handler) {
      // Fallback: Check if it's a Synaptic tool (unity_*/blender_*) and forward to execute
      if (toolName.startsWith('unity_') && synapticClient.isServerConnected('unity')) {
        try {
          const args = JSON.parse(toolCall.function.arguments);
          const result = await synapticClient.execute('unity', toolName, args);
          if (result.success) {
            return JSON.stringify({ success: true, result: result.result });
          } else {
            return JSON.stringify({ error: result.error });
          }
        } catch (error) {
          return JSON.stringify({ error: `Unity tool execution failed: ${error instanceof Error ? error.message : String(error)}` });
        }
      }
      if (toolName.startsWith('blender_') && synapticClient.isServerConnected('blender')) {
        try {
          const args = JSON.parse(toolCall.function.arguments);
          const result = await synapticClient.execute('blender', toolName, args);
          if (result.success) {
            return JSON.stringify({ success: true, result: result.result });
          } else {
            return JSON.stringify({ error: result.error });
          }
        } catch (error) {
          return JSON.stringify({ error: `Blender tool execution failed: ${error instanceof Error ? error.message : String(error)}` });
        }
      }
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
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
