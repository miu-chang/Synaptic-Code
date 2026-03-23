export class ToolRegistry {
    tools = new Map();
    register(handler) {
        this.tools.set(handler.definition.function.name, handler);
    }
    registerMultiple(handlers) {
        handlers.forEach((h) => this.register(h));
    }
    unregister(name) {
        return this.tools.delete(name);
    }
    unregisterMultiple(names) {
        names.forEach((n) => this.unregister(n));
    }
    get(name) {
        return this.tools.get(name);
    }
    getDefinitions() {
        return Array.from(this.tools.values()).map((h) => h.definition);
    }
    async execute(toolCall) {
        const handler = this.tools.get(toolCall.function.name);
        if (!handler) {
            return JSON.stringify({ error: `Unknown tool: ${toolCall.function.name}` });
        }
        try {
            const args = JSON.parse(toolCall.function.arguments);
            const result = await handler.execute(args);
            return result;
        }
        catch (error) {
            return JSON.stringify({
                error: `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`,
            });
        }
    }
    async executeMultiple(toolCalls) {
        const results = await Promise.all(toolCalls.map(async (tc) => ({
            id: tc.id,
            result: await this.execute(tc),
        })));
        return results;
    }
    list() {
        return Array.from(this.tools.keys());
    }
    has(name) {
        return this.tools.has(name);
    }
}
//# sourceMappingURL=registry.js.map