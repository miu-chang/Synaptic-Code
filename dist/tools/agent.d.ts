/**
 * Agent Tools - Allow LLM to spawn sub-agents for task distribution
 * Sub-agents run in background and auto-report completion
 */
import type { ToolHandler, ToolRegistry } from './registry.js';
import type { LLMClient } from '../llm/types.js';
import { type AgentState } from '../core/agent.js';
export interface SubAgentStatus {
    id: string;
    goal: string;
    status: AgentState['status'];
    currentStep: string;
    iterations: number;
    startedAt: number;
    result?: string;
    error?: string;
}
export interface AgentCompletion {
    agentId: string;
    status: 'completed' | 'failed' | 'cancelled';
    result?: string;
    error?: string;
    iterations: number;
    elapsedMs: number;
}
export interface SharedContext {
    key: string;
    value: string;
    fromAgent: string;
    timestamp: number;
}
/**
 * Initialize the agent tools with required dependencies
 */
export declare function initAgentTools(client: LLMClient, model: string, tools: ToolRegistry, options?: {
    maxConcurrent?: number;
    onStatusUpdate?: (statuses: Map<string, SubAgentStatus>) => void;
    onCompletion?: (completion: AgentCompletion) => void;
}): void;
/**
 * Update model (when user changes model)
 */
export declare function updateAgentModel(model: string): void;
/**
 * Get current sub-agent statuses for UI
 */
export declare function getSubAgentStatuses(): Map<string, SubAgentStatus>;
/**
 * Get and clear completion queue (for injecting into LLM context)
 */
export declare function popCompletions(): AgentCompletion[];
/**
 * Check if there are pending completions
 */
export declare function hasCompletions(): boolean;
/**
 * Get running agent count
 */
export declare function getRunningCount(): number;
/**
 * Share data between agents
 */
export declare function shareContext(key: string, value: string, fromAgent: string): void;
/**
 * Get shared context
 */
export declare function getSharedContext(key?: string): SharedContext[];
/**
 * Clear shared context
 */
export declare function clearSharedContext(): void;
export declare const agentTools: ToolHandler[];
//# sourceMappingURL=agent.d.ts.map