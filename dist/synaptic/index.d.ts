/**
 * Synaptic Ecosystem Integration
 * ==============================
 * Connects Synaptic Code CLI to Blender and Unity.
 */
export * from './client.js';
export * from './mention.js';
export * from './tools.js';
export * from './history.js';
import * as client from './client.js';
import * as mention from './mention.js';
import type { ToolHandler } from '../tools/registry.js';
/**
 * Initialize Synaptic ecosystem connection
 * Call this on CLI startup
 */
export declare function initSynaptic(): Promise<{
    blender: boolean;
    unity: boolean;
    toolCount: number;
    message: string;
    tools: ToolHandler[];
}>;
/**
 * Process user input for @mentions
 * Returns execution results if mentions found
 */
export declare function processMentions(input: string): Promise<{
    handled: boolean;
    results?: Array<{
        command: mention.MentionCommand;
        result: client.ExecuteResult;
    }>;
    remainingText: string;
    formatted?: string;
}>;
/**
 * Get ecosystem status for display
 */
export declare function getEcosystemStatus(): string;
//# sourceMappingURL=index.d.ts.map