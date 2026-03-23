import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { Spinner } from './Spinner.js';

interface ModelSelectorProps {
  models: string[];
  currentModel: string;
  loading?: boolean;
  onSelect: (model: string) => void;
  onClose: () => void;
}

export function ModelSelector({
  models,
  currentModel,
  loading = false,
  onSelect,
  onClose,
}: ModelSelectorProps): React.ReactElement {
  const [selectedIndex, setSelectedIndex] = useState(() => {
    const idx = models.indexOf(currentModel);
    return idx >= 0 ? idx : 0;
  });

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
      setSelectedIndex(i => Math.min(models.length - 1, i + 1));
      return;
    }

    if (key.return) {
      if (models[selectedIndex]) {
        onSelect(models[selectedIndex]);
      }
      return;
    }
  });

  if (loading) {
    return (
      <Box borderStyle="round" borderColor="cyan" paddingX={1}>
        <Spinner text="Loading models..." />
      </Box>
    );
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      paddingX={1}
    >
      <Box marginBottom={1}>
        <Text bold color="cyan">Select Model</Text>
        <Text dimColor> • ↑↓ navigate • Enter select • Esc cancel</Text>
      </Box>

      {models.map((model, i) => {
        const isSelected = i === selectedIndex;
        const isCurrent = model === currentModel;

        return (
          <Box key={model}>
            <Text color={isSelected ? 'cyan' : undefined}>
              {isSelected ? '❯ ' : '  '}
            </Text>
            <Text bold={isSelected} color={isSelected ? 'cyan' : undefined}>
              {model}
            </Text>
            {isCurrent && <Text color="green"> (current)</Text>}
          </Box>
        );
      })}

      {models.length === 0 && (
        <Text dimColor>No models available</Text>
      )}
    </Box>
  );
}
