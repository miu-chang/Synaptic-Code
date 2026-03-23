/**
 * Synaptic Tools for LLM
 * ----------------------
 * Dynamically registers Blender/Unity tools based on connection status.
 */
import type { ToolHandler } from '../tools/registry.js';
/**
 * Meta-tool: Execute any Blender tool by name
 */
export declare const blenderExecuteTool: ToolHandler;
/**
 * Meta-tool: Execute any Unity tool by name
 */
export declare const unityExecuteTool: ToolHandler;
/**
 * Tool to list available Blender tools/categories
 */
export declare const blenderListToolsTool: ToolHandler;
/**
 * Tool to list available Unity tools/categories
 */
export declare const unityListToolsTool: ToolHandler;
/**
 * Tool to get recent Synaptic execution history
 */
export declare const synapticHistoryTool: ToolHandler;
/**
 * Tool to get console logs/errors from Unity/Blender
 */
export declare const synapticLogsTool: ToolHandler;
/**
 * Get all Synaptic tools based on current connection status
 */
export declare function getSynapticTools(): ToolHandler[];
/**
 * Check if any Synaptic server is connected
 */
export declare function hasSynapticConnection(): boolean;
//# sourceMappingURL=tools.d.ts.map