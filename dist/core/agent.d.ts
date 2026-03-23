/**
 * Agent Mode - Autonomous task execution
 * Runs LLM in a loop to complete complex goals automatically.
 */
import type { LLMClient } from '../llm/types.js';
import type { ToolRegistry } from '../tools/registry.js';
export interface AgentStep {
    id: number;
    type: 'thinking' | 'tool_call' | 'tool_result' | 'complete' | 'error';
    content: string;
    toolName?: string;
    toolArgs?: string;
    timestamp: number;
}
export interface AgentConfig {
    maxIterations: number;
    stopOnError: boolean;
    verbose: boolean;
    isSubAgent: boolean;
}
export interface AgentState {
    goal: string;
    status: 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';
    steps: AgentStep[];
    iterations: number;
    startedAt: number;
    completedAt?: number;
    result?: string;
    error?: string;
}
export type AgentEventHandler = (step: AgentStep, state: AgentState) => void;
export declare class Agent {
    private client;
    private model;
    private tools;
    private config;
    private state;
    private messages;
    private eventHandler?;
    private cancelled;
    constructor(client: LLMClient, model: string, tools: ToolRegistry, config?: Partial<AgentConfig>);
    private createInitialState;
    private addStep;
    /** Subscribe to step events */
    onStep(handler: AgentEventHandler): void;
    /** Get current state */
    getState(): AgentState;
    /** Cancel running agent */
    cancel(): void;
    /** Run agent to complete goal */
    run(goal: string): Promise<AgentState>;
}
//# sourceMappingURL=agent.d.ts.map