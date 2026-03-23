import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * PlanView - Claude Code style plan display
 * Shows execution plan inline before tool calls
 */
import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
export function PlanView({ items, onApprove, onApproveAll, onReject }) {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const pendingItems = items.filter(i => i.status === 'pending');
    useInput((input, key) => {
        if (pendingItems.length === 0)
            return;
        if (key.upArrow) {
            setSelectedIndex(i => Math.max(0, i - 1));
        }
        else if (key.downArrow) {
            setSelectedIndex(i => Math.min(pendingItems.length - 1, i + 1));
        }
        else if (input === 'y' || key.return) {
            // Approve selected or all
            if (pendingItems.length === 1) {
                onApprove(pendingItems[0].id);
            }
            else {
                onApproveAll();
            }
        }
        else if (input === 'n' || key.escape) {
            onReject();
        }
    });
    if (items.length === 0) {
        return _jsx(Box, {});
    }
    return (_jsxs(Box, { flexDirection: "column", marginY: 1, children: [_jsxs(Box, { marginBottom: 1, children: [_jsx(Text, { bold: true, color: "cyan", children: "Plan " }), _jsxs(Text, { dimColor: true, children: ["(", items.length, " step", items.length > 1 ? 's' : '', ")"] })] }), items.map((item, idx) => {
                const isSelected = pendingItems[selectedIndex]?.id === item.id;
                const statusIcon = {
                    pending: '○',
                    approved: '✓',
                    rejected: '✗',
                    executing: '◉',
                    completed: '●',
                }[item.status];
                const statusColor = {
                    pending: isSelected ? 'cyan' : 'gray',
                    approved: 'green',
                    rejected: 'red',
                    executing: 'yellow',
                    completed: 'green',
                }[item.status];
                return (_jsxs(Box, { paddingLeft: 1, children: [_jsxs(Text, { color: statusColor, children: [isSelected && item.status === 'pending' ? '❯ ' : '  ', statusIcon] }), _jsx(Text, { color: item.status === 'pending' ? undefined : 'gray', children: item.action }), item.tool && (_jsxs(Text, { color: "yellow", dimColor: item.status !== 'pending', children: [' ', "[", item.tool, "]"] }))] }, item.id));
            }), pendingItems.length > 0 && (_jsx(Box, { marginTop: 1, paddingLeft: 1, children: _jsxs(Text, { dimColor: true, children: [_jsx(Text, { color: "green", children: "Y" }), " approve", pendingItems.length > 1 && ' all', ' • ', _jsx(Text, { color: "red", children: "N" }), " reject"] }) }))] }));
}
export function InlinePlan({ action, tool, onApprove, onReject }) {
    useInput((input, key) => {
        if (input === 'y' || key.return) {
            onApprove();
        }
        else if (input === 'n' || key.escape) {
            onReject();
        }
    });
    return (_jsxs(Box, { flexDirection: "column", marginY: 1, children: [_jsxs(Box, { children: [_jsx(Text, { color: "cyan", children: "\u25CB " }), _jsx(Text, { children: action }), tool && _jsxs(Text, { color: "yellow", children: [" [", tool, "]"] })] }), _jsx(Box, { paddingLeft: 2, children: _jsxs(Text, { dimColor: true, children: [_jsx(Text, { color: "green", children: "Y" }), " approve \u2022 ", _jsx(Text, { color: "red", children: "N" }), " reject"] }) })] }));
}
//# sourceMappingURL=PlanView.js.map