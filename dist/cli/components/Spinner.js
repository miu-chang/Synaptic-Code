import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { useScrollPaused } from './ScrollContext.js';
const SPINNER_FRAMES = ['|', '/', '-', '\\'];
const DOTS = ['o', 'O', '0', 'O'];
const PROGRESS = ['[    ]', '[=   ]', '[==  ]', '[=== ]', '[====]', '[=== ]', '[==  ]', '[=   ]'];
export function Spinner({ text = 'Thinking...', type = 'spinner' }) {
    const [frame, setFrame] = useState(0);
    const frames = type === 'dots' ? DOTS : type === 'progress' ? PROGRESS : SPINNER_FRAMES;
    const paused = useScrollPaused();
    useEffect(() => {
        if (paused)
            return;
        const timer = setInterval(() => {
            setFrame(f => (f + 1) % frames.length);
        }, 100);
        return () => clearInterval(timer);
    }, [frames.length, paused]);
    return (_jsxs(Box, { children: [_jsxs(Text, { color: "cyan", children: [frames[frame], " "] }), _jsx(Text, { dimColor: true, children: text })] }));
}
/**
 * Shimmer text effect - a bright spot moves across the text
 */
function ShimmerText({ text }) {
    const [pos, setPos] = useState(0);
    const paused = useScrollPaused();
    useEffect(() => {
        if (paused)
            return;
        const timer = setInterval(() => {
            setPos(p => (p + 1) % (text.length + 3));
        }, 80);
        return () => clearInterval(timer);
    }, [text.length, paused]);
    return (_jsx(Text, { children: text.split('').map((char, i) => {
            const dist = Math.abs(i - pos);
            if (dist === 0) {
                return _jsx(Text, { color: "whiteBright", bold: true, children: char }, i);
            }
            else if (dist === 1) {
                return _jsx(Text, { color: "cyanBright", children: char }, i);
            }
            else if (dist === 2) {
                return _jsx(Text, { color: "cyan", children: char }, i);
            }
            else {
                return _jsx(Text, { color: "gray", children: char }, i);
            }
        }) }));
}
export function ThinkingIndicator() {
    const [frame, setFrame] = useState(0);
    const paused = useScrollPaused();
    useEffect(() => {
        if (paused)
            return;
        const timer = setInterval(() => {
            setFrame(f => (f + 1) % SPINNER_FRAMES.length);
        }, 100);
        return () => clearInterval(timer);
    }, [paused]);
    return (_jsxs(Box, { marginY: 1, paddingLeft: 2, children: [_jsxs(Text, { color: "cyan", children: [SPINNER_FRAMES[frame], " "] }), _jsx(ShimmerText, { text: "Thinking..." })] }));
}
export function CompactingIndicator({ startedAt }) {
    const [dots, setDots] = useState(1);
    const [elapsed, setElapsed] = useState(0);
    const paused = useScrollPaused();
    useEffect(() => {
        if (paused)
            return;
        const timer = setInterval(() => {
            setDots(d => (d % 3) + 1);
        }, 400);
        return () => clearInterval(timer);
    }, [paused]);
    useEffect(() => {
        if (!startedAt || paused)
            return;
        const timer = setInterval(() => {
            setElapsed(Math.floor((Date.now() - startedAt) / 1000));
        }, 1000);
        return () => clearInterval(timer);
    }, [startedAt, paused]);
    const dotsStr = '.'.repeat(dots).padEnd(3, ' ');
    const timeStr = elapsed > 0 ? ` (${elapsed}s)` : '';
    return (_jsx(Box, { marginY: 1, paddingLeft: 2, children: _jsxs(Text, { color: "magenta", children: ["\u2139 Auto-compacting", dotsStr, timeStr] }) }));
}
// Strip ANSI codes and extract clean progress info
function parseProgress(raw) {
    // Remove ANSI escape codes
    const clean = raw.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '').replace(/[\x00-\x1F]/g, ' ').trim();
    // Try to extract percentage
    const percentMatch = clean.match(/(\d+\.?\d*)%/);
    const sizeMatch = clean.match(/(\d+\.?\d*\s*[KMGT]?B)\s*\/\s*(\d+\.?\d*\s*[KMGT]?B)/i);
    const speedMatch = clean.match(/(\d+\.?\d*\s*[KMGT]?B\/s)/i);
    const etaMatch = clean.match(/ETA\s*(\d+:\d+)/i);
    const parts = [];
    if (percentMatch)
        parts.push(`${percentMatch[1]}%`);
    if (sizeMatch)
        parts.push(`${sizeMatch[1]}/${sizeMatch[2]}`);
    if (speedMatch)
        parts.push(speedMatch[1]);
    if (etaMatch)
        parts.push(`ETA ${etaMatch[1]}`);
    return parts.length > 0 ? parts.join(' | ') : clean.slice(0, 60);
}
export function DownloadIndicator({ model, status, progress, message }) {
    const [dots, setDots] = useState(1);
    const paused = useScrollPaused();
    useEffect(() => {
        if (status !== 'downloading' || paused)
            return;
        const timer = setInterval(() => {
            setDots(d => (d % 3) + 1);
        }, 400);
        return () => clearInterval(timer);
    }, [status, paused]);
    const dotsStr = '.'.repeat(dots).padEnd(3, ' ');
    const statusIcon = status === 'done' ? '✓' : status === 'error' ? '✗' : '↓';
    const statusColor = status === 'done' ? 'green' : status === 'error' ? 'red' : 'cyan';
    // Parse and clean progress text
    const rawProgress = progress || message || '';
    const progressText = status === 'downloading' && rawProgress ? parseProgress(rawProgress) : rawProgress;
    return (_jsxs(Box, { marginY: 1, paddingLeft: 2, children: [_jsxs(Text, { color: statusColor, children: [statusIcon, " "] }), _jsx(Text, { children: "Downloading " }), _jsx(Text, { bold: true, children: model.length > 30 ? model.slice(0, 30) + '...' : model }), status === 'downloading' && !progressText && _jsx(Text, { dimColor: true, children: dotsStr }), progressText && _jsxs(Text, { dimColor: true, children: [" ", progressText] })] }));
}
// Tool name to human-readable description mapping
const TOOL_DESCRIPTIONS = {
    // File operations
    read_file: { icon: '[R]', action: 'Reading file' },
    write_file: { icon: '[W]', action: 'Writing file' },
    edit_file: { icon: '[E]', action: 'Editing file' },
    glob: { icon: '[G]', action: 'Searching files' },
    grep: { icon: '[S]', action: 'Searching content' },
    // Bash
    bash: { icon: '[>]', action: 'Running command' },
    execute_bash: { icon: '[>]', action: 'Running command' },
    // Web
    web_search: { icon: '[?]', action: 'Searching web' },
    web_fetch: { icon: '[~]', action: 'Fetching URL' },
    // Todo
    todo_read: { icon: '[T]', action: 'Reading todos' },
    todo_write: { icon: '[T]', action: 'Updating todos' },
};
function getToolInfo(name) {
    return TOOL_DESCRIPTIONS[name] || { icon: '[*]', action: `Running ${name}` };
}
export function ToolActivity({ name, args }) {
    const [frame, setFrame] = useState(0);
    const { icon, action } = getToolInfo(name);
    const paused = useScrollPaused();
    useEffect(() => {
        if (paused)
            return;
        const timer = setInterval(() => {
            setFrame(f => (f + 1) % SPINNER_FRAMES.length);
        }, 100);
        return () => clearInterval(timer);
    }, [paused]);
    // Extract meaningful info from args
    let detail = '';
    let content = '';
    let oldString = '';
    let newString = '';
    if (args) {
        try {
            const parsed = JSON.parse(args);
            if (parsed.path)
                detail = parsed.path;
            else if (parsed.pattern)
                detail = parsed.pattern;
            else if (parsed.query)
                detail = parsed.query;
            else if (parsed.url)
                detail = parsed.url;
            else if (parsed.command)
                detail = parsed.command.slice(0, 40);
            content = parsed.content || '';
            oldString = parsed.old_string || '';
            newString = parsed.new_string || '';
        }
        catch {
            // ignore parse errors
        }
    }
    // Generate diff preview for file operations
    const isFileWrite = name === 'write_file' && content;
    const isFileEdit = name === 'edit_file' && oldString && newString;
    let diffLines = [];
    let stats = null;
    if (isFileWrite) {
        const lines = content.split('\n');
        stats = { added: lines.length, removed: 0 };
        diffLines = lines.map(l => ({ text: `+ ${l}`, type: 'add' }));
    }
    else if (isFileEdit) {
        const oldLines = oldString.split('\n');
        const newLines = newString.split('\n');
        const oldSet = new Set(oldLines);
        const newSet = new Set(newLines);
        let added = 0, removed = 0;
        for (const line of oldLines) {
            if (!newSet.has(line)) {
                diffLines.push({ text: `- ${line}`, type: 'remove' });
                removed++;
            }
        }
        for (const line of newLines) {
            if (!oldSet.has(line)) {
                diffLines.push({ text: `+ ${line}`, type: 'add' });
                added++;
            }
        }
        stats = { added, removed };
    }
    return (_jsxs(Box, { flexDirection: "column", marginY: 1, children: [_jsxs(Box, { children: [_jsxs(Text, { color: "yellow", children: [icon, " "] }), _jsxs(Text, { color: "cyan", children: [SPINNER_FRAMES[frame], " "] }), _jsx(Text, { bold: true, children: action }), detail && (_jsxs(Text, { color: "cyan", children: [" ", detail.length > 50 ? detail.slice(0, 50) + '...' : detail] })), stats && (_jsxs(_Fragment, { children: [stats.added > 0 && _jsxs(Text, { color: "green", children: [" +", stats.added] }), stats.removed > 0 && _jsxs(Text, { color: "red", children: [" -", stats.removed] })] }))] }), diffLines.length > 0 && (_jsx(Box, { flexDirection: "column", paddingLeft: 4, children: diffLines.map((line, i) => (_jsx(Text, { color: line.type === 'add' ? 'green' : line.type === 'remove' ? 'red' : undefined, children: line.text }, i))) }))] }));
}
export function ToolExecuting({ name }) {
    return _jsx(ToolActivity, { name: name });
}
//# sourceMappingURL=Spinner.js.map