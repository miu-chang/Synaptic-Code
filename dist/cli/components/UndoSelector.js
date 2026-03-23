import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
export function UndoSelector({ undoPoints, onRestore, onClose }) {
    const [phase, setPhase] = useState('select-point');
    const [selectedPointIndex, setSelectedPointIndex] = useState(0);
    const [selectedModeIndex, setSelectedModeIndex] = useState(0);
    const modes = [
        { key: 'fork-both', label: 'Fork & Undo code', desc: 'Fork conversation + restore files' },
        { key: 'undo-code', label: 'Undo code only', desc: 'Restore files, keep conversation' },
        { key: 'fork-conversation', label: 'Fork conversation only', desc: 'Fork conversation, keep files' },
        { key: 'cancel', label: 'Cancel', desc: 'Do nothing' },
    ];
    useInput((input, key) => {
        if (key.escape) {
            onClose();
            return;
        }
        if (phase === 'select-point') {
            if (key.upArrow) {
                // Move up in display = older = higher index in original array
                setSelectedPointIndex(i => Math.min(undoPoints.length - 1, i + 1));
            }
            else if (key.downArrow) {
                // Move down in display = newer = lower index in original array
                setSelectedPointIndex(i => Math.max(0, i - 1));
            }
            else if (key.return) {
                setPhase('select-mode');
                setSelectedModeIndex(0);
            }
        }
        else if (phase === 'select-mode') {
            if (key.upArrow) {
                setSelectedModeIndex(i => Math.max(0, i - 1));
            }
            else if (key.downArrow) {
                setSelectedModeIndex(i => Math.min(modes.length - 1, i + 1));
            }
            else if (key.return) {
                const mode = modes[selectedModeIndex].key;
                if (mode === 'cancel') {
                    onClose();
                }
                else {
                    onRestore(undoPoints[selectedPointIndex].id, mode);
                }
            }
            else if (key.leftArrow || key.backspace || key.delete) {
                setPhase('select-point');
            }
        }
    });
    const formatTime = (timestamp) => {
        const diff = Date.now() - timestamp;
        const mins = Math.floor(diff / 60000);
        if (mins < 1)
            return 'just now';
        if (mins === 1)
            return '1 min ago';
        if (mins < 60)
            return `${mins} mins ago`;
        const hours = Math.floor(mins / 60);
        if (hours === 1)
            return '1 hour ago';
        return `${hours} hours ago`;
    };
    if (undoPoints.length === 0) {
        return (_jsxs(Box, { flexDirection: "column", borderStyle: "round", borderColor: "yellow", paddingX: 1, children: [_jsx(Text, { color: "yellow", children: "No undo points available" }), _jsx(Text, { dimColor: true, children: "Press Esc to close" })] }));
    }
    return (_jsxs(Box, { flexDirection: "column", borderStyle: "round", borderColor: "magenta", paddingX: 1, children: [phase === 'select-point' && (_jsxs(_Fragment, { children: [_jsxs(Box, { marginBottom: 1, children: [_jsx(Text, { bold: true, color: "magenta", children: "Restore to:" }), _jsx(Text, { dimColor: true, children: " \u2022 \u2191\u2193 navigate \u2022 Enter select \u2022 Esc cancel" })] }), [...undoPoints].reverse().map((point, i) => {
                        // Reverse index for selection (oldest at top, newest at bottom)
                        const originalIndex = undoPoints.length - 1 - i;
                        const isSelected = originalIndex === selectedPointIndex;
                        const turnsAgo = originalIndex + 1;
                        const { filesChanged, linesAdded, linesRemoved } = point.stats;
                        const hasChanges = filesChanged > 0;
                        return (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Box, { children: [_jsx(Text, { color: isSelected ? 'cyan' : undefined, children: isSelected ? '❯ ' : '  ' }), _jsxs(Text, { bold: isSelected, color: isSelected ? 'cyan' : 'yellow', children: [turnsAgo, " turn", turnsAgo > 1 ? 's' : '', " ago"] }), _jsx(Text, { dimColor: true, children: ": " }), _jsx(Text, { color: isSelected ? 'white' : undefined, children: point.label }), _jsxs(Text, { dimColor: true, children: [" (", formatTime(point.timestamp), ")"] })] }), hasChanges && (_jsxs(Box, { paddingLeft: 4, children: [_jsxs(Text, { dimColor: true, children: [filesChanged, " file", filesChanged > 1 ? 's' : '', " changed"] }), linesAdded > 0 && (_jsxs(Text, { color: "green", children: [" +", linesAdded] })), linesRemoved > 0 && (_jsxs(Text, { color: "red", children: [" -", linesRemoved] }))] }))] }, point.id));
                    })] })), phase === 'select-mode' && (_jsxs(_Fragment, { children: [_jsxs(Box, { marginBottom: 1, children: [_jsx(Text, { bold: true, color: "magenta", children: "What to restore?" }), _jsx(Text, { dimColor: true, children: " \u2022 \u2191\u2193 navigate \u2022 Enter select \u2022 \u2190 back" })] }), _jsxs(Box, { marginBottom: 1, children: [_jsx(Text, { dimColor: true, children: "Restoring to: " }), _jsx(Text, { color: "yellow", children: undoPoints[selectedPointIndex].label })] }), modes.map((mode, i) => {
                        const isSelected = i === selectedModeIndex;
                        return (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Box, { children: [_jsx(Text, { color: isSelected ? 'cyan' : undefined, children: isSelected ? '❯ ' : '  ' }), _jsx(Text, { bold: isSelected, color: isSelected ? 'cyan' : undefined, children: mode.label })] }), isSelected && (_jsx(Box, { paddingLeft: 4, children: _jsx(Text, { dimColor: true, children: mode.desc }) }))] }, mode.key));
                    })] }))] }));
}
//# sourceMappingURL=UndoSelector.js.map