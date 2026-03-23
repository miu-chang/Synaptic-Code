import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Box, Text, useInput } from 'ink';
function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
}
function formatRelative(timestamp) {
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 1)
        return 'just now';
    if (mins < 60)
        return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    return `${hours}h ago`;
}
export function TimelineView({ undoPoints, onClose }) {
    useInput((input, key) => {
        if (key.escape || input === 'q') {
            onClose();
        }
    });
    // Reverse to show oldest first (chronological)
    const points = [...undoPoints].reverse();
    const totalFiles = new Set(points.flatMap(p => p.files.map(f => f.path))).size;
    const totalAdded = points.reduce((sum, p) => sum + p.stats.linesAdded, 0);
    const totalRemoved = points.reduce((sum, p) => sum + p.stats.linesRemoved, 0);
    return (_jsxs(Box, { flexDirection: "column", borderStyle: "round", borderColor: "cyan", paddingX: 1, paddingY: 0, children: [_jsxs(Box, { marginBottom: 1, children: [_jsx(Text, { bold: true, color: "cyan", children: "\uD83D\uDCCA Session Timeline" }), _jsx(Text, { dimColor: true, children: " \u2022 q/Esc close" })] }), points.length === 0 ? (_jsx(Text, { dimColor: true, children: "No changes recorded yet" })) : (_jsxs(_Fragment, { children: [_jsx(Box, { flexDirection: "column", children: points.map((point, i) => {
                            const isLast = i === points.length - 1;
                            const hasChanges = point.stats.filesChanged > 0;
                            return (_jsxs(Box, { children: [_jsx(Text, { dimColor: true, children: formatTime(point.timestamp) }), _jsx(Text, { dimColor: true, children: "  \u2503 " }), _jsx(Text, { color: hasChanges ? 'green' : 'gray', children: hasChanges ? '📝' : '💬' }), _jsx(Text, { children: " " }), _jsx(Text, { color: isLast ? 'cyan' : undefined, children: point.label }), hasChanges && (_jsxs(Text, { dimColor: true, children: [' ', "(", point.stats.filesChanged, " file", point.stats.filesChanged > 1 ? 's' : '', ",", _jsxs(Text, { color: "green", children: ["+", point.stats.linesAdded] }), "/", _jsxs(Text, { color: "red", children: ["-", point.stats.linesRemoved] }), ")"] }))] }, point.id));
                        }) }), _jsx(Box, { marginTop: 1, borderStyle: "single", borderColor: "gray", paddingX: 1, children: _jsxs(Text, { dimColor: true, children: ["Summary: ", totalFiles, " files touched,", _jsxs(Text, { color: "green", children: [" +", totalAdded] }), _jsxs(Text, { color: "red", children: [" -", totalRemoved] }), ' ', "lines"] }) })] }))] }));
}
//# sourceMappingURL=TimelineView.js.map