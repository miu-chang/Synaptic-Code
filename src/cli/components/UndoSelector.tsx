import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import type { UndoPoint } from '../../core/undo.js';

type RestoreMode = 'fork-both' | 'undo-code' | 'fork-conversation' | 'cancel';

interface UndoSelectorProps {
  undoPoints: UndoPoint[];
  onRestore: (pointId: number, mode: RestoreMode) => void;
  onClose: () => void;
}

type Phase = 'select-point' | 'select-mode';

export function UndoSelector({ undoPoints, onRestore, onClose }: UndoSelectorProps): React.ReactElement {
  const [phase, setPhase] = useState<Phase>('select-point');
  const [selectedPointIndex, setSelectedPointIndex] = useState(0);
  const [selectedModeIndex, setSelectedModeIndex] = useState(0);

  const modes: { key: RestoreMode; label: string; desc: string }[] = [
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
      } else if (key.downArrow) {
        // Move down in display = newer = lower index in original array
        setSelectedPointIndex(i => Math.max(0, i - 1));
      } else if (key.return) {
        setPhase('select-mode');
        setSelectedModeIndex(0);
      }
    } else if (phase === 'select-mode') {
      if (key.upArrow) {
        setSelectedModeIndex(i => Math.max(0, i - 1));
      } else if (key.downArrow) {
        setSelectedModeIndex(i => Math.min(modes.length - 1, i + 1));
      } else if (key.return) {
        const mode = modes[selectedModeIndex].key;
        if (mode === 'cancel') {
          onClose();
        } else {
          onRestore(undoPoints[selectedPointIndex].id, mode);
        }
      } else if (key.leftArrow || key.backspace || key.delete) {
        setPhase('select-point');
      }
    }
  });

  const formatTime = (timestamp: number): string => {
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins === 1) return '1 min ago';
    if (mins < 60) return `${mins} mins ago`;
    const hours = Math.floor(mins / 60);
    if (hours === 1) return '1 hour ago';
    return `${hours} hours ago`;
  };

  if (undoPoints.length === 0) {
    return (
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor="yellow"
        paddingX={1}
      >
        <Text color="yellow">No undo points available</Text>
        <Text dimColor>Press Esc to close</Text>
      </Box>
    );
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="magenta"
      paddingX={1}
    >
      {phase === 'select-point' && (
        <>
          <Box marginBottom={1}>
            <Text bold color="magenta">Restore to:</Text>
            <Text dimColor> • ↑↓ navigate • Enter select • Esc cancel</Text>
          </Box>

          {[...undoPoints].reverse().map((point, i) => {
            // Reverse index for selection (oldest at top, newest at bottom)
            const originalIndex = undoPoints.length - 1 - i;
            const isSelected = originalIndex === selectedPointIndex;
            const turnsAgo = originalIndex + 1;
            const { filesChanged, linesAdded, linesRemoved } = point.stats;
            const hasChanges = filesChanged > 0;

            return (
              <Box key={point.id} flexDirection="column">
                <Box>
                  <Text color={isSelected ? 'cyan' : undefined}>
                    {isSelected ? '❯ ' : '  '}
                  </Text>
                  <Text bold={isSelected} color={isSelected ? 'cyan' : 'yellow'}>
                    {turnsAgo} turn{turnsAgo > 1 ? 's' : ''} ago
                  </Text>
                  <Text dimColor>: </Text>
                  <Text color={isSelected ? 'white' : undefined}>
                    {point.label}
                  </Text>
                  <Text dimColor> ({formatTime(point.timestamp)})</Text>
                </Box>
                {hasChanges && (
                  <Box paddingLeft={4}>
                    <Text dimColor>
                      {filesChanged} file{filesChanged > 1 ? 's' : ''} changed
                    </Text>
                    {linesAdded > 0 && (
                      <Text color="green"> +{linesAdded}</Text>
                    )}
                    {linesRemoved > 0 && (
                      <Text color="red"> -{linesRemoved}</Text>
                    )}
                  </Box>
                )}
              </Box>
            );
          })}
        </>
      )}

      {phase === 'select-mode' && (
        <>
          <Box marginBottom={1}>
            <Text bold color="magenta">What to restore?</Text>
            <Text dimColor> • ↑↓ navigate • Enter select • ← back</Text>
          </Box>

          <Box marginBottom={1}>
            <Text dimColor>Restoring to: </Text>
            <Text color="yellow">{undoPoints[selectedPointIndex].label}</Text>
          </Box>

          {modes.map((mode, i) => {
            const isSelected = i === selectedModeIndex;

            return (
              <Box key={mode.key} flexDirection="column">
                <Box>
                  <Text color={isSelected ? 'cyan' : undefined}>
                    {isSelected ? '❯ ' : '  '}
                  </Text>
                  <Text bold={isSelected} color={isSelected ? 'cyan' : undefined}>
                    {mode.label}
                  </Text>
                </Box>
                {isSelected && (
                  <Box paddingLeft={4}>
                    <Text dimColor>{mode.desc}</Text>
                  </Box>
                )}
              </Box>
            );
          })}
        </>
      )}
    </Box>
  );
}
