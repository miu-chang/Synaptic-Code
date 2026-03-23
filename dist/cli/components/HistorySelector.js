import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
function formatRelativeTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1)
        return 'just now';
    if (minutes < 60)
        return `${minutes}m ago`;
    if (hours < 24)
        return `${hours}h ago`;
    if (days < 7)
        return `${days}d ago`;
    const date = new Date(timestamp);
    return date.toLocaleDateString();
}
export function HistorySelector({ items, onSelect, onClose, onDelete }) {
    const [selectedIndex, setSelectedIndex] = useState(0);
    useInput((input, key) => {
        if (key.escape) {
            onClose();
            return;
        }
        if (key.upArrow) {
            setSelectedIndex(i => Math.max(0, i - 1));
            return;
        }
        if (key.downArrow) {
            setSelectedIndex(i => Math.min(items.length - 1, i + 1));
            return;
        }
        if (key.return) {
            if (items[selectedIndex]) {
                onSelect(items[selectedIndex].id);
            }
            return;
        }
        // Delete with 'd' or backspace
        if ((input === 'd' || key.delete) && onDelete && items[selectedIndex]) {
            onDelete(items[selectedIndex].id);
            // Adjust index if we deleted the last item
            if (selectedIndex >= items.length - 1 && selectedIndex > 0) {
                setSelectedIndex(selectedIndex - 1);
            }
            return;
        }
    });
    if (items.length === 0) {
        return (_jsxs(Box, { flexDirection: "column", borderStyle: "round", borderColor: "cyan", paddingX: 1, paddingY: 0, children: [_jsxs(Box, { marginBottom: 1, children: [_jsx(Text, { bold: true, color: "cyan", children: "History" }), _jsx(Text, { dimColor: true, children: " \u2022 Esc close" })] }), _jsx(Text, { dimColor: true, children: "No saved conversations" })] }));
    }
    return (_jsxs(Box, { flexDirection: "column", borderStyle: "round", borderColor: "cyan", paddingX: 1, paddingY: 0, children: [_jsxs(Box, { marginBottom: 1, children: [_jsx(Text, { bold: true, color: "cyan", children: "History" }), _jsx(Text, { dimColor: true, children: " \u2022 \u2191\u2193 navigate \u2022 Enter select \u2022 d delete \u2022 Esc close" })] }), items.map((item, i) => (_jsxs(Box, { children: [_jsx(Text, { color: i === selectedIndex ? 'cyan' : undefined, children: i === selectedIndex ? '❯ ' : '  ' }), _jsx(Box, { width: 40, children: _jsx(Text, { bold: i === selectedIndex, color: i === selectedIndex ? 'cyan' : undefined, children: item.title.length > 35 ? item.title.slice(0, 35) + '...' : item.title }) }), _jsxs(Text, { dimColor: true, children: [" ", formatRelativeTime(item.updatedAt)] })] }, item.id))), _jsx(Box, { marginTop: 1, children: _jsxs(Text, { dimColor: true, children: [items.length, " conversation", items.length !== 1 ? 's' : ''] }) })] }));
}
//# sourceMappingURL=HistorySelector.js.map