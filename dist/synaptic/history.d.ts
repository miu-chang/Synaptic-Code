/**
 * Synaptic Execution History
 * --------------------------
 * Tracks execution results for cross-reference.
 * Allows LLM to refer to "the object I just created" etc.
 */
export interface ExecutionRecord {
    id: number;
    timestamp: number;
    server: 'blender' | 'unity';
    tool: string;
    params: Record<string, unknown>;
    success: boolean;
    result?: unknown;
    error?: string;
    summary: string;
    createdObjects?: string[];
    modifiedObjects?: string[];
}
/**
 * Record an execution result
 */
export declare function recordExecution(server: 'blender' | 'unity', tool: string, params: Record<string, unknown>, success: boolean, result?: unknown, error?: string): ExecutionRecord;
/**
 * Get recent executions
 */
export declare function getRecentExecutions(count?: number): ExecutionRecord[];
/**
 * Get last execution
 */
export declare function getLastExecution(): ExecutionRecord | undefined;
/**
 * Get last execution for a specific server
 */
export declare function getLastExecutionFor(server: 'blender' | 'unity'): ExecutionRecord | undefined;
/**
 * Get last created object name
 */
export declare function getLastCreatedObject(): {
    server: 'blender' | 'unity';
    name: string;
} | undefined;
/**
 * Find execution by object name
 */
export declare function findByObjectName(name: string): ExecutionRecord | undefined;
/**
 * Get history summary for LLM context
 */
export declare function getHistorySummary(count?: number): string;
/**
 * Clear history
 */
export declare function clearHistory(): void;
//# sourceMappingURL=history.d.ts.map