/**
 * Synaptic Ecosystem Client
 * -------------------------
 * Connects to Blender and Unity HTTP servers directly.
 * Auto-detects running instances via port scanning.
 */
import { recordExecution } from './history.js';
// Default port ranges to scan
const BLENDER_PORTS = [8085, 8185, 8285];
const UNITY_PORTS = [8086, 8186, 8286];
// Connected servers cache
let connectedServers = new Map();
// Tool cache: tool name -> server info
let toolCache = new Map();
/**
 * Identify server type from /health response
 */
function identifyServer(health) {
    const serverName = health.server?.toLowerCase() || '';
    if (serverName.includes('blender'))
        return 'blender';
    if (serverName.includes('unity'))
        return 'unity';
    return null;
}
/**
 * Check a single port for Synaptic server
 */
async function checkPort(port) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1000);
        const response = await fetch(`http://localhost:${port}/health`, {
            signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!response.ok)
            return null;
        const health = await response.json();
        const type = identifyServer(health);
        if (!type)
            return null;
        return {
            type,
            port,
            status: 'connected',
            toolCount: health.tools || 0,
        };
    }
    catch {
        return null;
    }
}
/**
 * Scan for running Synaptic servers
 */
export async function discoverServers() {
    const allPorts = [...BLENDER_PORTS, ...UNITY_PORTS];
    const results = await Promise.all(allPorts.map(checkPort));
    const servers = results.filter((s) => s !== null);
    // Update cache
    connectedServers.clear();
    for (const server of servers) {
        connectedServers.set(server.type, server);
    }
    return servers;
}
/**
 * Get currently connected servers
 */
export function getConnectedServers() {
    return Array.from(connectedServers.values());
}
/**
 * Check if a specific server type is connected
 */
export function isServerConnected(type) {
    return connectedServers.has(type);
}
/**
 * Get server by type
 */
export function getServer(type) {
    return connectedServers.get(type);
}
/**
 * Fetch tools from a server and cache them
 */
export async function fetchTools(type) {
    const server = connectedServers.get(type);
    if (!server)
        return [];
    try {
        const response = await fetch(`http://localhost:${server.port}/tools/list`);
        if (!response.ok)
            return [];
        const data = await response.json();
        const tools = data.tools || [];
        // Cache tools
        for (const toolName of tools) {
            toolCache.set(toolName, {
                name: toolName,
                server: type,
                port: server.port,
            });
        }
        // Update server tool count
        server.tools = tools;
        server.toolCount = tools.length;
        return tools;
    }
    catch {
        return [];
    }
}
/**
 * Fetch tools from all connected servers
 */
export async function fetchAllTools() {
    toolCache.clear();
    const types = ['blender', 'unity'];
    await Promise.all(types.map(fetchTools));
    return toolCache;
}
/**
 * Find which server has a specific tool
 */
export function findToolServer(toolName) {
    return toolCache.get(toolName);
}
// Timeout for tool execution (30 seconds)
const EXECUTE_TIMEOUT = 30000;
// Max result size to return (prevent context explosion)
const MAX_RESULT_SIZE = 10000;
// Heavy tools -> lightweight alternatives (for local LLMs)
const HEAVY_TOOL_ALTERNATIVES = {
    // Unity
    'unity_get_scene_info': 'unity_get_scene_summary',
    'unity_get_hierarchy': 'unity_get_scene_summary',
    // Add more as needed
};
/**
 * Truncate large results to prevent context explosion
 */
function truncateResult(result) {
    const str = JSON.stringify(result);
    if (str.length > MAX_RESULT_SIZE) {
        return {
            _truncated: true,
            _originalSize: str.length,
            preview: str.slice(0, MAX_RESULT_SIZE) + '...[truncated]',
        };
    }
    return result;
}
/**
 * Execute a tool on a specific server
 */
export async function execute(server, tool, params = {}) {
    const serverInfo = connectedServers.get(server);
    if (!serverInfo) {
        return {
            success: false,
            error: `${server} is not connected. Call discoverServers() first.`,
            server,
        };
    }
    // Auto-replace heavy tools with lightweight alternatives
    const actualTool = HEAVY_TOOL_ALTERNATIVES[tool] || tool;
    const startTime = Date.now();
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), EXECUTE_TIMEOUT);
        const response = await fetch(`http://localhost:${serverInfo.port}/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tool: actualTool, params }),
            signal: controller.signal,
        });
        clearTimeout(timeout);
        const data = await response.json();
        if (!response.ok || data.error) {
            const errorMsg = data.error || `HTTP ${response.status}`;
            recordExecution(server, actualTool, params, false, undefined, errorMsg);
            return {
                success: false,
                error: errorMsg,
                server,
            };
        }
        const truncatedResult = truncateResult(data.result);
        recordExecution(server, actualTool, params, true, data.result);
        return {
            success: true,
            result: truncatedResult,
            server,
        };
    }
    catch (e) {
        const errorMsg = e instanceof Error && e.name === 'AbortError'
            ? `Request timeout (${EXECUTE_TIMEOUT / 1000}s)`
            : (e instanceof Error ? e.message : String(e));
        recordExecution(server, actualTool, params, false, undefined, errorMsg);
        return {
            success: false,
            error: errorMsg,
            server,
        };
    }
}
/**
 * Execute multiple tools in batch on a server
 */
export async function executeBatch(server, tasks) {
    const serverInfo = connectedServers.get(server);
    if (!serverInfo) {
        return {
            success: false,
            error: `${server} is not connected`,
            server,
        };
    }
    try {
        const response = await fetch(`http://localhost:${serverInfo.port}/batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tasks),
        });
        const data = await response.json();
        return {
            success: data.success ?? false,
            result: data.results,
            error: data.error,
            server,
        };
    }
    catch (e) {
        return {
            success: false,
            error: e instanceof Error ? e.message : String(e),
            server,
        };
    }
}
/**
 * Get categories from a server
 */
export async function getCategories(server) {
    const serverInfo = connectedServers.get(server);
    if (!serverInfo)
        return [];
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(`http://localhost:${serverInfo.port}/categories`, {
            signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!response.ok)
            return [];
        const data = await response.json();
        return data.categories || [];
    }
    catch {
        return [];
    }
}
/**
 * Get tools by category from a server
 */
export async function getToolsByCategory(server, category) {
    const serverInfo = connectedServers.get(server);
    if (!serverInfo)
        return [];
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(`http://localhost:${serverInfo.port}/tools/category/${encodeURIComponent(category)}`, { signal: controller.signal });
        clearTimeout(timeout);
        if (!response.ok)
            return [];
        const data = await response.json();
        return data.tools || [];
    }
    catch {
        return [];
    }
}
/**
 * Initialize: discover servers and fetch tools
 */
export async function init() {
    const servers = await discoverServers();
    await fetchAllTools();
    return {
        servers,
        toolCount: toolCache.size,
    };
}
/**
 * Get status summary
 */
export function getStatus() {
    return {
        blender: connectedServers.get('blender') || null,
        unity: connectedServers.get('unity') || null,
        totalTools: toolCache.size,
    };
}
//# sourceMappingURL=client.js.map