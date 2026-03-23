/**
 * Synaptic Execution History
 * --------------------------
 * Tracks execution results for cross-reference.
 * Allows LLM to refer to "the object I just created" etc.
 */
// Execution history (most recent first)
const history = [];
let nextId = 1;
// Max history size
const MAX_HISTORY = 50;
/**
 * Record an execution result
 */
export function recordExecution(server, tool, params, success, result, error) {
    const record = {
        id: nextId++,
        timestamp: Date.now(),
        server,
        tool,
        params,
        success,
        result,
        error,
        summary: generateSummary(server, tool, params, success, result),
        createdObjects: extractCreatedObjects(server, tool, result),
        modifiedObjects: extractModifiedObjects(server, tool, params),
    };
    // Add to front (most recent first)
    history.unshift(record);
    // Trim if too long
    if (history.length > MAX_HISTORY) {
        history.pop();
    }
    return record;
}
/**
 * Generate human-readable summary
 */
function generateSummary(server, tool, params, success, result) {
    if (!success) {
        return `Failed: ${tool}`;
    }
    // Unity-specific summaries
    if (server === 'unity') {
        if (tool.includes('create_gameobject')) {
            const name = params.name || 'GameObject';
            const type = params.type || 'empty';
            return `Created ${type} "${name}" in Unity`;
        }
        if (tool.includes('scene_summary') || tool.includes('scene_info')) {
            const r = result;
            return `Got Unity scene info: ${r?.scene_name || 'unknown'}`;
        }
        if (tool.includes('delete')) {
            return `Deleted "${params.name}" in Unity`;
        }
        if (tool.includes('set_transform')) {
            return `Moved "${params.gameObject || params.name}" in Unity`;
        }
    }
    // Blender-specific summaries
    if (server === 'blender') {
        if (tool.includes('create_cube') || tool.includes('create_sphere') || tool.includes('create_')) {
            const name = params.name || 'Object';
            return `Created "${name}" in Blender`;
        }
        if (tool.includes('delete')) {
            return `Deleted "${params.name}" in Blender`;
        }
        if (tool.includes('export')) {
            return `Exported from Blender: ${params.path || params.filepath}`;
        }
    }
    // Generic summary
    return `${server}:${tool}`;
}
/**
 * Extract created object names from result
 */
function extractCreatedObjects(server, tool, result) {
    if (!result || typeof result !== 'object')
        return undefined;
    const r = result;
    // Unity
    if (r.name && typeof r.name === 'string') {
        return [r.name];
    }
    if (r.gameObject && typeof r.gameObject === 'string') {
        return [r.gameObject];
    }
    // Blender
    if (r.object_name && typeof r.object_name === 'string') {
        return [r.object_name];
    }
    return undefined;
}
/**
 * Extract modified object names from params
 */
function extractModifiedObjects(server, tool, params) {
    const names = [];
    if (params.name && typeof params.name === 'string') {
        names.push(params.name);
    }
    if (params.gameObject && typeof params.gameObject === 'string') {
        names.push(params.gameObject);
    }
    if (params.target && typeof params.target === 'string') {
        names.push(params.target);
    }
    return names.length > 0 ? names : undefined;
}
/**
 * Get recent executions
 */
export function getRecentExecutions(count = 10) {
    return history.slice(0, count);
}
/**
 * Get last execution
 */
export function getLastExecution() {
    return history[0];
}
/**
 * Get last execution for a specific server
 */
export function getLastExecutionFor(server) {
    return history.find(r => r.server === server);
}
/**
 * Get last created object name
 */
export function getLastCreatedObject() {
    for (const record of history) {
        if (record.createdObjects && record.createdObjects.length > 0) {
            return {
                server: record.server,
                name: record.createdObjects[0],
            };
        }
    }
    return undefined;
}
/**
 * Find execution by object name
 */
export function findByObjectName(name) {
    return history.find(r => r.createdObjects?.includes(name) ||
        r.modifiedObjects?.includes(name));
}
/**
 * Get history summary for LLM context
 */
export function getHistorySummary(count = 5) {
    const recent = history.slice(0, count);
    if (recent.length === 0) {
        return 'No recent Synaptic operations.';
    }
    const lines = recent.map((r, i) => {
        const ago = Math.round((Date.now() - r.timestamp) / 1000);
        const timeStr = ago < 60 ? `${ago}s ago` : `${Math.round(ago / 60)}m ago`;
        return `${i + 1}. [${r.server}] ${r.summary} (${timeStr})`;
    });
    return 'Recent Synaptic operations:\n' + lines.join('\n');
}
/**
 * Clear history
 */
export function clearHistory() {
    history.length = 0;
    nextId = 1;
}
//# sourceMappingURL=history.js.map