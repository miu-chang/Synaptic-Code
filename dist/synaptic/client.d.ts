/**
 * Synaptic Ecosystem Client
 * -------------------------
 * Connects to Blender and Unity HTTP servers directly.
 * Auto-detects running instances via port scanning.
 */
export interface SynapticTool {
    name: string;
    server: 'blender' | 'unity';
    port: number;
}
export interface SynapticServer {
    type: 'blender' | 'unity';
    port: number;
    status: 'connected' | 'disconnected';
    toolCount: number;
    tools?: string[];
}
export interface ExecuteResult {
    success: boolean;
    result?: unknown;
    error?: string;
    server: 'blender' | 'unity';
}
/**
 * Scan for running Synaptic servers
 */
export declare function discoverServers(): Promise<SynapticServer[]>;
/**
 * Get currently connected servers
 */
export declare function getConnectedServers(): SynapticServer[];
/**
 * Check if a specific server type is connected
 */
export declare function isServerConnected(type: 'blender' | 'unity'): boolean;
/**
 * Get server by type
 */
export declare function getServer(type: 'blender' | 'unity'): SynapticServer | undefined;
/**
 * Fetch tools from a server and cache them
 */
export declare function fetchTools(type: 'blender' | 'unity'): Promise<string[]>;
/**
 * Fetch tools from all connected servers
 */
export declare function fetchAllTools(): Promise<Map<string, SynapticTool>>;
/**
 * Find which server has a specific tool
 */
export declare function findToolServer(toolName: string): SynapticTool | undefined;
/**
 * Execute a tool on a specific server
 */
export declare function execute(server: 'blender' | 'unity', tool: string, params?: Record<string, unknown>): Promise<ExecuteResult>;
/**
 * Execute multiple tools in batch on a server
 */
export declare function executeBatch(server: 'blender' | 'unity', tasks: Array<{
    tool: string;
    params?: Record<string, unknown>;
}>): Promise<ExecuteResult>;
/**
 * Get categories from a server
 */
export declare function getCategories(server: 'blender' | 'unity'): Promise<Array<{
    name: string;
    count: number;
}>>;
/**
 * Tool info with inputSchema
 */
export interface ToolInfo {
    name: string;
    description: string;
    inputSchema?: {
        type: string;
        properties?: Record<string, unknown>;
        required?: string[];
    };
}
/**
 * Get tools by category from a server
 */
export declare function getToolsByCategory(server: 'blender' | 'unity', category: string): Promise<ToolInfo[]>;
/**
 * Initialize: discover servers and fetch tools
 */
export declare function init(): Promise<{
    servers: SynapticServer[];
    toolCount: number;
}>;
/**
 * Get status summary
 */
export declare function getStatus(): {
    blender: SynapticServer | null;
    unity: SynapticServer | null;
    totalTools: number;
};
//# sourceMappingURL=client.d.ts.map