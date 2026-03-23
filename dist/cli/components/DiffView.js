import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { readFileSync, existsSync } from 'fs';
function computeSimpleDiff(oldLines, newLines) {
    const result = [];
    const oldSet = new Set(oldLines);
    const newSet = new Set(newLines);
    let oldIdx = 0;
    let newIdx = 0;
    // Simple LCS-ish diff
    while (oldIdx < oldLines.length || newIdx < newLines.length) {
        if (oldIdx >= oldLines.length) {
            // Rest are additions
            result.push({ type: 'add', content: newLines[newIdx], newLineNo: newIdx + 1 });
            newIdx++;
        }
        else if (newIdx >= newLines.length) {
            // Rest are deletions
            result.push({ type: 'delete', content: oldLines[oldIdx], oldLineNo: oldIdx + 1 });
            oldIdx++;
        }
        else if (oldLines[oldIdx] === newLines[newIdx]) {
            // Same line
            result.push({ type: 'context', content: oldLines[oldIdx], oldLineNo: oldIdx + 1, newLineNo: newIdx + 1 });
            oldIdx++;
            newIdx++;
        }
        else if (!newSet.has(oldLines[oldIdx])) {
            // Line was deleted
            result.push({ type: 'delete', content: oldLines[oldIdx], oldLineNo: oldIdx + 1 });
            oldIdx++;
        }
        else if (!oldSet.has(newLines[newIdx])) {
            // Line was added
            result.push({ type: 'add', content: newLines[newIdx], newLineNo: newIdx + 1 });
            newIdx++;
        }
        else {
            // Both exist somewhere, treat as delete then add
            result.push({ type: 'delete', content: oldLines[oldIdx], oldLineNo: oldIdx + 1 });
            oldIdx++;
        }
    }
    return result;
}
function getFileDiffs(point) {
    const diffs = [];
    for (const snapshot of point.files) {
        const oldContent = snapshot.content;
        let newContent = '';
        try {
            if (existsSync(snapshot.path)) {
                newContent = readFileSync(snapshot.path, 'utf-8');
            }
        }
        catch {
            continue;
        }
        if (oldContent === newContent)
            continue;
        const oldLines = oldContent.split('\n');
        const newLines = newContent.split('\n');
        const diffLines = computeSimpleDiff(oldLines, newLines);
        const additions = diffLines.filter(l => l.type === 'add').length;
        const deletions = diffLines.filter(l => l.type === 'delete').length;
        // Group into hunks (consecutive changes with context)
        const hunks = [];
        let currentHunk = null;
        let contextBuffer = [];
        for (const line of diffLines) {
            if (line.type === 'context') {
                if (currentHunk) {
                    currentHunk.lines.push(line);
                    // End hunk after 3 context lines
                    if (currentHunk.lines.filter(l => l.type === 'context').length >= 3) {
                        hunks.push(currentHunk);
                        currentHunk = null;
                        contextBuffer = [];
                    }
                }
                else {
                    contextBuffer.push(line);
                    if (contextBuffer.length > 3)
                        contextBuffer.shift();
                }
            }
            else {
                if (!currentHunk) {
                    currentHunk = {
                        oldStart: line.oldLineNo || line.newLineNo || 1,
                        newStart: line.newLineNo || line.oldLineNo || 1,
                        lines: [...contextBuffer],
                    };
                }
                currentHunk.lines.push(line);
            }
        }
        if (currentHunk && currentHunk.lines.some(l => l.type !== 'context')) {
            hunks.push(currentHunk);
        }
        diffs.push({
            path: snapshot.path,
            oldContent,
            newContent,
            additions,
            deletions,
            hunks,
        });
    }
    return diffs;
}
export function DiffView({ undoPoints, onClose }) {
    const [selectedPoint, setSelectedPoint] = useState(0);
    const [expandedFile, setExpandedFile] = useState(0);
    useInput((input, key) => {
        if (key.escape || input === 'q') {
            onClose();
            return;
        }
        if (key.leftArrow) {
            setSelectedPoint(i => Math.max(0, i - 1));
            setExpandedFile(0);
        }
        if (key.rightArrow) {
            setSelectedPoint(i => Math.min(undoPoints.length - 1, i + 1));
            setExpandedFile(0);
        }
        if (key.upArrow) {
            setExpandedFile(i => Math.max(0, i - 1));
        }
        if (key.downArrow) {
            setExpandedFile(i => i + 1);
        }
    });
    if (undoPoints.length === 0) {
        return (_jsxs(Box, { flexDirection: "column", borderStyle: "round", borderColor: "cyan", paddingX: 1, children: [_jsx(Text, { bold: true, color: "cyan", children: "\uD83D\uDCCB Diff View" }), _jsx(Text, { dimColor: true, children: "No undo points available" }), _jsx(Text, { dimColor: true, children: "Press q/Esc to close" })] }));
    }
    const point = undoPoints[selectedPoint];
    const diffs = getFileDiffs(point);
    return (_jsxs(Box, { flexDirection: "column", borderStyle: "round", borderColor: "cyan", paddingX: 1, children: [_jsxs(Box, { marginBottom: 1, children: [_jsx(Text, { bold: true, color: "cyan", children: "\uD83D\uDCCB Diff View" }), _jsx(Text, { dimColor: true, children: " \u2022 \u2190\u2192 points \u2022 \u2191\u2193 files \u2022 q close" })] }), _jsxs(Box, { marginBottom: 1, children: [_jsx(Text, { dimColor: true, children: "Point: " }), undoPoints.map((p, i) => (_jsx(Text, { color: i === selectedPoint ? 'cyan' : 'gray', children: i === selectedPoint ? `[${i + 1}]` : ` ${i + 1} ` }, p.id))), _jsxs(Text, { dimColor: true, children: [" - ", point.label] })] }), diffs.length === 0 ? (_jsx(Text, { dimColor: true, children: "No file changes at this point" })) : (_jsx(Box, { flexDirection: "column", children: diffs.map((diff, fileIdx) => {
                    const isExpanded = fileIdx === expandedFile;
                    const shortPath = diff.path.split('/').slice(-2).join('/');
                    return (_jsxs(Box, { flexDirection: "column", marginBottom: 1, children: [_jsxs(Box, { children: [_jsxs(Text, { color: isExpanded ? 'cyan' : undefined, children: [isExpanded ? '▼' : '▶', " ", shortPath] }), _jsxs(Text, { color: "green", children: [" +", diff.additions] }), _jsxs(Text, { color: "red", children: [" -", diff.deletions] })] }), isExpanded && diff.hunks.slice(0, 3).map((hunk, hunkIdx) => (_jsxs(Box, { flexDirection: "column", marginLeft: 2, children: [_jsxs(Text, { dimColor: true, children: ["@@ -", hunk.oldStart, " +", hunk.newStart, " @@"] }), hunk.lines.slice(0, 10).map((line, lineIdx) => (_jsx(Box, { children: _jsxs(Text, { color: line.type === 'add' ? 'green' : line.type === 'delete' ? 'red' : undefined, dimColor: line.type === 'context', children: [line.type === 'add' ? '+' : line.type === 'delete' ? '-' : ' ', line.content.slice(0, 70), line.content.length > 70 ? '...' : ''] }) }, lineIdx))), hunk.lines.length > 10 && (_jsxs(Text, { dimColor: true, children: ["  ... ", hunk.lines.length - 10, " more lines"] }))] }, hunkIdx)))] }, diff.path));
                }) }))] }));
}
//# sourceMappingURL=DiffView.js.map