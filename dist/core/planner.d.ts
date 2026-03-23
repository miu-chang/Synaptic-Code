/**
 * Plan Mode - Claude Code style
 * Extracts plan from LLM response before executing tools
 */
import type { ToolCall } from '../llm/types.js';
export interface PlanStep {
    id: number;
    action: string;
    tool?: string;
    toolArgs?: string;
    status: 'pending' | 'approved' | 'rejected' | 'executing' | 'completed';
}
export interface ExecutionPlan {
    steps: PlanStep[];
    reasoning?: string;
}
/**
 * Extract plan from tool calls
 * Converts tool_calls into human-readable plan steps
 */
export declare function extractPlanFromToolCalls(toolCalls: ToolCall[]): ExecutionPlan;
/**
 * Check if plan mode should be used for these tool calls
 * Returns true for potentially destructive or important operations
 */
export declare function shouldRequireApproval(toolCalls: ToolCall[]): boolean;
//# sourceMappingURL=planner.d.ts.map