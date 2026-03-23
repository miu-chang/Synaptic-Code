import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import type { UndoPoint } from '../../core/undo.js';
import { readFileSync, existsSync } from 'fs';

interface DiffViewProps {
  undoPoints: UndoPoint[];
  onClose: () => void;
}

interface FileDiff {
  path: string;
  oldContent: string;
  newContent: string;
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
}

interface DiffHunk {
  oldStart: number;
  newStart: number;
  lines: DiffLine[];
}

interface DiffLine {
  type: 'context' | 'add' | 'delete';
  content: string;
  oldLineNo?: number;
  newLineNo?: number;
}

function computeSimpleDiff(oldLines: string[], newLines: string[]): DiffLine[] {
  const result: DiffLine[] = [];
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
    } else if (newIdx >= newLines.length) {
      // Rest are deletions
      result.push({ type: 'delete', content: oldLines[oldIdx], oldLineNo: oldIdx + 1 });
      oldIdx++;
    } else if (oldLines[oldIdx] === newLines[newIdx]) {
      // Same line
      result.push({ type: 'context', content: oldLines[oldIdx], oldLineNo: oldIdx + 1, newLineNo: newIdx + 1 });
      oldIdx++;
      newIdx++;
    } else if (!newSet.has(oldLines[oldIdx])) {
      // Line was deleted
      result.push({ type: 'delete', content: oldLines[oldIdx], oldLineNo: oldIdx + 1 });
      oldIdx++;
    } else if (!oldSet.has(newLines[newIdx])) {
      // Line was added
      result.push({ type: 'add', content: newLines[newIdx], newLineNo: newIdx + 1 });
      newIdx++;
    } else {
      // Both exist somewhere, treat as delete then add
      result.push({ type: 'delete', content: oldLines[oldIdx], oldLineNo: oldIdx + 1 });
      oldIdx++;
    }
  }

  return result;
}

function getFileDiffs(point: UndoPoint): FileDiff[] {
  const diffs: FileDiff[] = [];

  for (const snapshot of point.files) {
    const oldContent = snapshot.content;
    let newContent = '';

    try {
      if (existsSync(snapshot.path)) {
        newContent = readFileSync(snapshot.path, 'utf-8');
      }
    } catch {
      continue;
    }

    if (oldContent === newContent) continue;

    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    const diffLines = computeSimpleDiff(oldLines, newLines);

    const additions = diffLines.filter(l => l.type === 'add').length;
    const deletions = diffLines.filter(l => l.type === 'delete').length;

    // Group into hunks (consecutive changes with context)
    const hunks: DiffHunk[] = [];
    let currentHunk: DiffHunk | null = null;
    let contextBuffer: DiffLine[] = [];

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
        } else {
          contextBuffer.push(line);
          if (contextBuffer.length > 3) contextBuffer.shift();
        }
      } else {
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

export function DiffView({ undoPoints, onClose }: DiffViewProps): React.ReactElement {
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
    return (
      <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
        <Text bold color="cyan">📋 Diff View</Text>
        <Text dimColor>No undo points available</Text>
        <Text dimColor>Press q/Esc to close</Text>
      </Box>
    );
  }

  const point = undoPoints[selectedPoint];
  const diffs = getFileDiffs(point);

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">📋 Diff View</Text>
        <Text dimColor> • ←→ points • ↑↓ files • q close</Text>
      </Box>

      {/* Point selector */}
      <Box marginBottom={1}>
        <Text dimColor>Point: </Text>
        {undoPoints.map((p, i) => (
          <Text key={p.id} color={i === selectedPoint ? 'cyan' : 'gray'}>
            {i === selectedPoint ? `[${i + 1}]` : ` ${i + 1} `}
          </Text>
        ))}
        <Text dimColor> - {point.label}</Text>
      </Box>

      {diffs.length === 0 ? (
        <Text dimColor>No file changes at this point</Text>
      ) : (
        <Box flexDirection="column">
          {diffs.map((diff, fileIdx) => {
            const isExpanded = fileIdx === expandedFile;
            const shortPath = diff.path.split('/').slice(-2).join('/');

            return (
              <Box key={diff.path} flexDirection="column" marginBottom={1}>
                <Box>
                  <Text color={isExpanded ? 'cyan' : undefined}>
                    {isExpanded ? '▼' : '▶'} {shortPath}
                  </Text>
                  <Text color="green"> +{diff.additions}</Text>
                  <Text color="red"> -{diff.deletions}</Text>
                </Box>

                {isExpanded && diff.hunks.slice(0, 3).map((hunk, hunkIdx) => (
                  <Box key={hunkIdx} flexDirection="column" marginLeft={2}>
                    <Text dimColor>@@ -{hunk.oldStart} +{hunk.newStart} @@</Text>
                    {hunk.lines.slice(0, 10).map((line, lineIdx) => (
                      <Box key={lineIdx}>
                        <Text
                          color={line.type === 'add' ? 'green' : line.type === 'delete' ? 'red' : undefined}
                          dimColor={line.type === 'context'}
                        >
                          {line.type === 'add' ? '+' : line.type === 'delete' ? '-' : ' '}
                          {line.content.slice(0, 70)}
                          {line.content.length > 70 ? '...' : ''}
                        </Text>
                      </Box>
                    ))}
                    {hunk.lines.length > 10 && (
                      <Text dimColor>  ... {hunk.lines.length - 10} more lines</Text>
                    )}
                  </Box>
                ))}
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
