import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * SubAgentBar - Shows running sub-agents status in one line each
 * Displays in chat mode when agents are active
 */
import { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { useScrollPaused } from './ScrollContext.js';
const SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
function AgentLine({ status }) {
    const [frame, setFrame] = useState(0);
    const paused = useScrollPaused();
    useEffect(() => {
        if (status.status !== 'running' || paused)
            return;
        const timer = setInterval(() => setFrame(f => (f + 1) % SPINNER.length), 80);
        return () => clearInterval(timer);
    }, [status.status, paused]);
    const elapsed = ((Date.now() - status.startedAt) / 1000).toFixed(0);
    const statusIcon = {
        idle: '○',
        running: SPINNER[frame],
        completed: '✓',
        failed: '✗',
        cancelled: '⊘',
    }[status.status];
    const statusColor = {
        idle: 'gray',
        running: 'cyan',
        completed: 'green',
        failed: 'red',
        cancelled: 'yellow',
    }[status.status];
    return (_jsxs(Box, { children: [_jsx(Text, { color: statusColor, children: statusIcon }), _jsxs(Text, { color: statusColor, bold: true, children: [" ", status.id] }), _jsx(Text, { dimColor: true, children: " \u2502 " }), _jsx(Text, { children: status.currentStep }), _jsxs(Text, { dimColor: true, children: [" \u2502 ", elapsed, "s"] })] }));
}
export function SubAgentBar({ statuses }) {
    if (statuses.size === 0)
        return null;
    const running = Array.from(statuses.values()).filter(s => s.status === 'running').length;
    return (_jsxs(Box, { flexDirection: "column", marginY: 0, paddingX: 1, borderStyle: "single", borderColor: "magenta", children: [_jsxs(Box, { children: [_jsx(Text, { bold: true, color: "magenta", children: "Sub-Agents" }), _jsxs(Text, { dimColor: true, children: [" (", running, " running)"] })] }), Array.from(statuses.values()).map(status => (_jsx(AgentLine, { status: status }, status.id)))] }));
}
//# sourceMappingURL=SubAgentBar.js.map