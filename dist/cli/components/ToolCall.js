import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { useScrollPaused } from './ScrollContext.js';
// Blinking dot for executing state
const DOT_FRAMES = ['●', '○'];
// Tool name to human-readable description mapping
const TOOL_INFO = {
    read_file: { icon: '[R]', label: 'Read' },
    write_file: { icon: '[W]', label: 'Write' },
    edit_file: { icon: '[E]', label: 'Edit' },
    glob: { icon: '[G]', label: 'Glob' },
    grep: { icon: '[S]', label: 'Search' },
    bash: { icon: '[>]', label: 'Bash' },
    execute_bash: { icon: '[>]', label: 'Bash' },
    web_search: { icon: '[?]', label: 'WebSearch' },
    web_fetch: { icon: '[~]', label: 'Fetch' },
    todo_read: { icon: '[T]', label: 'TodoRead' },
    todo_write: { icon: '[T]', label: 'TodoWrite' },
    synaptic_history: { icon: '[H]', label: 'History' },
};
/**
 * Get tool info with smart detection for external tools
 */
function getToolInfo(name, args) {
    // Check exact match first
    if (TOOL_INFO[name]) {
        return TOOL_INFO[name];
    }
    // Parse args once
    let parsed = null;
    if (args) {
        try {
            parsed = JSON.parse(args);
        }
        catch { /* ignore */ }
    }
    // Synaptic HTTP tools: blender_execute / unity_execute
    // args: {tool: "create_cube", params: {...}}
    if (name === 'blender_execute') {
        const detail = parsed?.tool;
        return { icon: '[B]', label: 'Blender', detail };
    }
    if (name === 'unity_execute') {
        const tool = parsed?.tool || '';
        const detail = tool.replace(/^unity_/, '');
        return { icon: '[U]', label: 'Unity', detail };
    }
    // List tools: show category being searched
    // args: {category: "Mesh"}
    if (name === 'blender_list_tools') {
        const category = parsed?.category;
        const detail = category ? `category:${category}` : 'categories';
        return { icon: '[B]', label: 'Blender', detail };
    }
    if (name === 'unity_list_tools') {
        const category = parsed?.category;
        const detail = category ? `category:${category}` : 'categories';
        return { icon: '[U]', label: 'Unity', detail };
    }
    // Synaptic logs: show server and log type
    // args: {server: "unity", logType: "error"}
    if (name === 'synaptic_logs') {
        const server = parsed?.server;
        const logType = parsed?.logType;
        const detail = [server, logType].filter(Boolean).join(' ');
        return { icon: '[L]', label: 'Logs', detail };
    }
    return { icon: '[*]', label: name };
}
/**
 * Format bytes to human readable (KB, MB)
 */
function formatBytes(bytes) {
    if (bytes >= 1024 * 1024) {
        return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
    }
    else if (bytes >= 1024) {
        return (bytes / 1024).toFixed(1) + 'KB';
    }
    return bytes + 'B';
}
/**
 * Format tool result for compact display
 */
function formatToolResult(result, toolName) {
    try {
        const parsed = JSON.parse(result);
        // Unity/Blender list_tools - show categories or tool names
        if (toolName.includes('list_tools')) {
            if (parsed.categories) {
                const names = parsed.categories.map((c) => c.name).slice(0, 5);
                const suffix = parsed.categories.length > 5 ? ` +${parsed.categories.length - 5} more` : '';
                return names.join(', ') + suffix;
            }
            if (parsed.tools) {
                const count = parsed.count || parsed.tools.length;
                return `${count} tools`;
            }
        }
        // Synaptic history
        if (toolName === 'synaptic_history' && parsed.recent) {
            return `${parsed.recent.length} recent operations`;
        }
        // Unity scene info
        if (parsed.gameObjectCount !== undefined) {
            return `${parsed.gameObjectCount} objects`;
        }
        // Success with result
        if (parsed.success && parsed.result) {
            const r = typeof parsed.result === 'string' ? parsed.result : JSON.stringify(parsed.result);
            return r.slice(0, 60) + (r.length > 60 ? '...' : '');
        }
        // Error
        if (parsed.error) {
            return parsed.error.slice(0, 80);
        }
        // Generic
        return result.slice(0, 80) + (result.length > 80 ? '...' : '');
    }
    catch {
        return result.slice(0, 80) + (result.length > 80 ? '...' : '');
    }
}
/**
 * Parse fetch result for status and size
 */
function parseFetchResult(result) {
    // Try to detect HTTP status from result
    const statusMatch = result.match(/(?:status|code)[:\s]*(\d{3})/i) ||
        result.match(/^(\d{3})\s/) ||
        result.match(/HTTP\/\d\.\d\s+(\d{3})/);
    const status = statusMatch ? parseInt(statusMatch[1]) : undefined;
    // Calculate content size
    const size = new TextEncoder().encode(result).length;
    // Determine if successful
    const ok = !result.toLowerCase().includes('error') &&
        !result.toLowerCase().includes('failed') &&
        (!status || (status >= 200 && status < 400));
    return { status, size, ok };
}
/**
 * Calculate simple line diff stats
 */
function calcDiff(oldContent, newContent) {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    const oldSet = new Set(oldLines);
    const newSet = new Set(newLines);
    let added = 0;
    let removed = 0;
    for (const line of newLines) {
        if (!oldSet.has(line))
            added++;
    }
    for (const line of oldLines) {
        if (!newSet.has(line))
            removed++;
    }
    return { added, removed };
}
export function ToolCallDisplay({ name, args, result, isError = false, isExecuting = false, }) {
    const toolInfo = getToolInfo(name, args);
    const { label } = toolInfo;
    const externalDetail = 'detail' in toolInfo ? toolInfo.detail : undefined;
    const [frame, setFrame] = useState(0);
    const [elapsed, setElapsed] = useState(0);
    const [startTime] = useState(() => Date.now());
    const paused = useScrollPaused();
    // Blinking dot animation for executing state
    useEffect(() => {
        if (!isExecuting || paused)
            return;
        const timer = setInterval(() => {
            setFrame(f => (f + 1) % DOT_FRAMES.length);
        }, 500);
        return () => clearInterval(timer);
    }, [isExecuting, paused]);
    // Elapsed time
    useEffect(() => {
        if (!isExecuting || paused)
            return;
        const timer = setInterval(() => {
            setElapsed(Math.floor((Date.now() - startTime) / 1000));
        }, 1000);
        return () => clearInterval(timer);
    }, [isExecuting, startTime, paused]);
    // Parse args for meaningful display
    let detail = '';
    let content = '';
    let oldString = '';
    let newString = '';
    let path = '';
    if (args) {
        try {
            const parsed = JSON.parse(args);
            path = parsed.path || '';
            content = parsed.content || '';
            oldString = parsed.old_string || '';
            newString = parsed.new_string || '';
            if (path)
                detail = path;
            else if (parsed.pattern)
                detail = parsed.pattern;
            else if (parsed.query)
                detail = parsed.query;
            else if (parsed.url)
                detail = parsed.url;
            else if (parsed.command)
                detail = parsed.command.slice(0, 50);
        }
        catch {
            detail = args.slice(0, 60);
        }
    }
    // Determine if this is a file write/edit for special display
    const isFileWrite = name === 'write_file' && content;
    const isFileEdit = name === 'edit_file' && oldString && newString;
    const isFetch = name === 'web_fetch';
    const isSearch = name === 'web_search';
    // Calculate stats for file operations
    let stats = null;
    let diffPreview = [];
    if (isFileWrite) {
        const lines = content.split('\n');
        stats = { added: lines.length, removed: 0 };
        // Show all lines
        diffPreview = lines.map(l => `+ ${l}`);
    }
    else if (isFileEdit) {
        stats = calcDiff(oldString, newString);
        // Show full diff
        const oldLines = oldString.split('\n');
        const newLines = newString.split('\n');
        const oldSet = new Set(oldLines);
        const newSet = new Set(newLines);
        for (const line of oldLines) {
            if (!newSet.has(line)) {
                diffPreview.push(`- ${line}`);
            }
        }
        for (const line of newLines) {
            if (!oldSet.has(line)) {
                diffPreview.push(`+ ${line}`);
            }
        }
    }
    // Determine dot color: white blinking (executing), green (success), red (error)
    const dotColor = isExecuting ? 'white' : isError ? 'red' : 'green';
    const dot = isExecuting ? DOT_FRAMES[frame] : '●';
    return (_jsxs(Box, { flexDirection: "column", marginY: 0, children: [_jsxs(Box, { children: [_jsxs(Text, { color: dotColor, children: [dot, " "] }), _jsx(Text, { children: label }), externalDetail && (_jsxs(Text, { color: "cyan", children: [" ", externalDetail] })), detail && (_jsxs(Text, { dimColor: true, children: [" ", detail.length > 50 ? detail.slice(0, 50) + '...' : detail] })), stats && (_jsxs(Text, { children: [stats.added > 0 && _jsxs(Text, { color: "green", children: [" +", stats.added] }), stats.removed > 0 && _jsxs(Text, { color: "red", children: [" -", stats.removed] })] })), isExecuting && elapsed > 0 && (_jsxs(Text, { dimColor: true, children: [" (", elapsed, "s)"] }))] }), diffPreview.length > 0 && (_jsx(Box, { flexDirection: "column", paddingLeft: 4, marginTop: 0, children: diffPreview.map((line, i) => (_jsx(Text, { color: line.startsWith('+') ? 'green' : line.startsWith('-') ? 'red' : undefined, dimColor: line.startsWith('  ...'), children: line }, i))) })), result && isFetch && (() => {
                const { status, size, ok } = parseFetchResult(result);
                return (_jsxs(Box, { paddingLeft: 4, children: [_jsx(Text, { color: ok ? 'green' : 'red', children: ok ? '✓ ' : '✗ ' }), status && (_jsxs(Text, { color: status >= 200 && status < 300 ? 'green' : status >= 400 ? 'red' : 'yellow', children: [status, ' '] })), size && _jsx(Text, { dimColor: true, children: formatBytes(size) })] }));
            })(), result && isSearch && (_jsxs(Box, { paddingLeft: 4, children: [_jsx(Text, { color: "green", children: "\u2713 " }), _jsx(Text, { dimColor: true, children: formatBytes(new TextEncoder().encode(result).length) })] })), result && !isFileWrite && !isFileEdit && !isFetch && !isSearch && (_jsxs(Box, { paddingLeft: 4, children: [_jsx(Text, { color: isError ? 'red' : 'green', children: isError ? '✗ ' : '✓ ' }), _jsx(Text, { wrap: "truncate", color: isError ? 'red' : undefined, dimColor: !isError, children: formatToolResult(result, name) })] }))] }));
}
//# sourceMappingURL=ToolCall.js.map