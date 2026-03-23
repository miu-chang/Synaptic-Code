import React from 'react';
import { Box, Text, useInput } from 'ink';
import type { UndoPoint } from '../../core/undo.js';

interface TimelineViewProps {
  undoPoints: UndoPoint[];
  onClose: () => void;
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

function formatRelative(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ago`;
}

export function TimelineView({ undoPoints, onClose }: TimelineViewProps): React.ReactElement {
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

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      paddingX={1}
      paddingY={0}
    >
      <Box marginBottom={1}>
        <Text bold color="cyan">📊 Session Timeline</Text>
        <Text dimColor> • q/Esc close</Text>
      </Box>

      {points.length === 0 ? (
        <Text dimColor>No changes recorded yet</Text>
      ) : (
        <>
          <Box flexDirection="column">
            {points.map((point, i) => {
              const isLast = i === points.length - 1;
              const hasChanges = point.stats.filesChanged > 0;

              return (
                <Box key={point.id}>
                  <Text dimColor>{formatTime(point.timestamp)}</Text>
                  <Text dimColor>  ┃ </Text>
                  <Text color={hasChanges ? 'green' : 'gray'}>
                    {hasChanges ? '📝' : '💬'}
                  </Text>
                  <Text> </Text>
                  <Text color={isLast ? 'cyan' : undefined}>
                    {point.label}
                  </Text>
                  {hasChanges && (
                    <Text dimColor>
                      {' '}({point.stats.filesChanged} file{point.stats.filesChanged > 1 ? 's' : ''},
                      <Text color="green">+{point.stats.linesAdded}</Text>
                      /
                      <Text color="red">-{point.stats.linesRemoved}</Text>)
                    </Text>
                  )}
                </Box>
              );
            })}
          </Box>

          <Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
            <Text dimColor>
              Summary: {totalFiles} files touched,
              <Text color="green"> +{totalAdded}</Text>
              <Text color="red"> -{totalRemoved}</Text>
              {' '}lines
            </Text>
          </Box>
        </>
      )}
    </Box>
  );
}
