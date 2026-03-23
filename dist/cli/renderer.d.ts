export declare function renderMarkdown(text: string): string;
export declare function renderCode(code: string, language?: string): string;
export declare function renderToolCall(name: string, args: string): string;
export declare function renderToolResult(result: string, isError?: boolean): string;
export declare function renderTodo(todos: {
    content: string;
    status: 'pending' | 'in_progress' | 'completed';
}[]): string;
export declare function renderError(error: string): string;
export declare function renderInfo(text: string): string;
export declare function renderSuccess(text: string): string;
export declare function renderWarning(text: string): string;
export declare function renderPrompt(): string;
export declare function renderThinking(): string;
export declare function renderDivider(): string;
//# sourceMappingURL=renderer.d.ts.map