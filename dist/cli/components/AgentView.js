import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * AgentView - UI for Agent Mode
 * Shows real-time progress of autonomous task execution
 */
import { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { getSubAgentStatuses } from '../../tools/agent.js';
import { useScrollPaused } from './ScrollContext.js';
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
function Spinner() {
    const [frame, setFrame] = useState(0);
    const paused = useScrollPaused();
    useEffect(() => {
        if (paused)
            return;
        const timer = setInterval(() => setFrame(f => (f + 1) % SPINNER_FRAMES.length), 80);
        return () => clearInterval(timer);
    }, [paused]);
    return _jsx(Text, { color: "cyan", children: SPINNER_FRAMES[frame] });
}
function StepIcon({ type, isLatest }) {
    const [frame, setFrame] = useState(0);
    const paused = useScrollPaused();
    useEffect(() => {
        if (!isLatest || type === 'complete' || type === 'error' || paused)
            return;
        const timer = setInterval(() => setFrame(f => (f + 1) % SPINNER_FRAMES.length), 80);
        return () => clearInterval(timer);
    }, [isLatest, type, paused]);
    switch (type) {
        case 'thinking':
            return _jsx(Text, { color: "cyan", children: isLatest ? SPINNER_FRAMES[frame] : '○' });
        case 'tool_call':
            return _jsx(Text, { color: "yellow", children: isLatest ? SPINNER_FRAMES[frame] : '○' });
        case 'tool_result':
            return _jsx(Text, { color: "green", children: "\u2713" });
        case 'complete':
            return _jsx(Text, { color: "green", children: "\u25CF" });
        case 'error':
            return _jsx(Text, { color: "red", children: "\u2717" });
        default:
            return _jsx(Text, { children: "\u25CB" });
    }
}
function StepDisplay({ step, isLatest }) {
    const getColor = () => {
        switch (step.type) {
            case 'thinking': return 'cyan';
            case 'tool_call': return 'yellow';
            case 'tool_result': return 'green';
            case 'complete': return 'greenBright';
            case 'error': return 'red';
            default: return undefined;
        }
    };
    const content = step.toolName
        ? `${step.toolName} ${step.content}`
        : step.content;
    return (_jsxs(Box, { children: [_jsx(StepIcon, { type: step.type, isLatest: isLatest }), _jsxs(Text, { color: getColor(), children: [" ", content.slice(0, 100), content.length > 100 ? '...' : ''] })] }));
}
function SubAgentLine({ status }) {
    const statusColor = {
        idle: 'gray',
        running: 'cyan',
        completed: 'green',
        failed: 'red',
        cancelled: 'yellow',
    }[status.status];
    const elapsed = ((Date.now() - status.startedAt) / 1000).toFixed(0);
    return (_jsxs(Box, { marginLeft: 2, children: [status.status === 'running' ? _jsx(Spinner, {}) : _jsx(Text, { color: statusColor, children: "\u25CF" }), _jsxs(Text, { bold: true, color: statusColor, children: [" ", status.id] }), _jsx(Text, { dimColor: true, children: " \u2502 " }), _jsx(Text, { children: status.currentStep.slice(0, 50) }), _jsxs(Text, { dimColor: true, children: [" \u2502 ", elapsed, "s"] })] }));
}
export function AgentView({ state, onCancel }) {
    const [subAgents, setSubAgents] = useState(new Map());
    const paused = useScrollPaused();
    // Poll for sub-agent updates
    useEffect(() => {
        if (state.status !== 'running' || paused)
            return;
        const timer = setInterval(() => {
            setSubAgents(getSubAgentStatuses());
        }, 200);
        return () => clearInterval(timer);
    }, [state.status, paused]);
    useInput((input, key) => {
        if (key.escape || input === 'q' || (key.ctrl && input === 'c')) {
            onCancel();
        }
    });
    const statusColor = {
        idle: 'gray',
        running: 'cyan',
        completed: 'green',
        failed: 'red',
        cancelled: 'yellow',
    }[state.status];
    const elapsed = state.completedAt
        ? ((state.completedAt - state.startedAt) / 1000).toFixed(1)
        : ((Date.now() - state.startedAt) / 1000).toFixed(1);
    // Show last N steps
    const visibleSteps = state.steps.slice(-8);
    // Count sub-agents
    const runningSubAgents = Array.from(subAgents.values()).filter(s => s.status === 'running').length;
    const totalSubAgents = subAgents.size;
    return (_jsxs(Box, { flexDirection: "column", borderStyle: "round", borderColor: statusColor, paddingX: 1, children: [_jsxs(Box, { marginBottom: 1, children: [_jsx(Text, { bold: true, color: statusColor, children: "Agent Mode" }), _jsx(Text, { dimColor: true, children: " \u2502 " }), _jsx(Text, { color: statusColor, children: state.status.toUpperCase() }), _jsx(Text, { dimColor: true, children: " \u2502 " }), _jsxs(Text, { children: ["Steps: ", state.iterations] }), _jsx(Text, { dimColor: true, children: " \u2502 " }), _jsxs(Text, { children: [elapsed, "s"] }), totalSubAgents > 0 && (_jsxs(_Fragment, { children: [_jsx(Text, { dimColor: true, children: " \u2502 " }), _jsxs(Text, { color: "magenta", children: ["Sub: ", runningSubAgents, "/", totalSubAgents] })] })), state.status === 'running' && (_jsx(Text, { dimColor: true, children: " \u2502 Press ESC to cancel" }))] }), _jsxs(Box, { marginBottom: 1, children: [_jsx(Text, { dimColor: true, children: "Goal: " }), _jsxs(Text, { children: [state.goal.slice(0, 80), state.goal.length > 80 ? '...' : ''] })] }), _jsx(Box, { flexDirection: "column", children: visibleSteps.map((step, i) => (_jsx(StepDisplay, { step: step, isLatest: i === visibleSteps.length - 1 && state.status === 'running' }, step.id))) }), totalSubAgents > 0 && (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsx(Text, { bold: true, color: "magenta", children: "Sub-Agents" }), Array.from(subAgents.values()).map(status => (_jsx(SubAgentLine, { status: status }, status.id)))] })), state.status === 'completed' && state.result && (_jsx(Box, { marginTop: 1, borderStyle: "single", borderColor: "green", paddingX: 1, children: _jsx(Text, { color: "green", children: state.result }) })), state.status === 'failed' && state.error && (_jsx(Box, { marginTop: 1, borderStyle: "single", borderColor: "red", paddingX: 1, children: _jsx(Text, { color: "red", children: state.error }) }))] }));
}
//# sourceMappingURL=AgentView.js.map