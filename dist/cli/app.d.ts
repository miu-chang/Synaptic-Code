import type { LLMClient } from '../llm/types.js';
import type { ToolRegistry } from '../tools/registry.js';
import type { Settings } from '../config/settings.js';
export interface AppConfig {
    settings: Settings;
    client: LLMClient;
    tools: ToolRegistry;
    systemPrompt?: string;
}
export declare class App {
    private settings;
    private client;
    private tools;
    private conversation;
    private todoManager;
    private systemPrompt;
    private rl;
    private running;
    constructor(config: AppConfig);
    start(): Promise<void>;
    private promptLoop;
    private showCommandSelector;
    private handleCommand;
    private showHelp;
    private processMessage;
    private streamResponse;
    private handleResponse;
    private executeToolCalls;
    private selectModel;
    private selectProvider;
    private quit;
}
//# sourceMappingURL=app.d.ts.map