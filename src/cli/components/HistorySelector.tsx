import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { t } from '../../i18n/index.js';

interface HistoryItem {
  id: string;
  title: string;
  updatedAt: number;
  messageCount?: number;
}

interface HistorySelectorProps {
  items: HistoryItem[];
  onSelect: (id: string) => void;
  onClose: () => void;
  onDelete?: (id: string) => void;
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  const date = new Date(timestamp);
  return date.toLocaleDateString();
}

export function HistorySelector({ items, onSelect, onClose, onDelete }: HistorySelectorProps): React.ReactElement {
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
    return (
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor="cyan"
        paddingX={1}
        paddingY={0}
      >
        <Box marginBottom={1}>
          <Text bold color="cyan">History</Text>
          <Text dimColor> • Esc close</Text>
        </Box>
        <Text dimColor>No saved conversations</Text>
      </Box>
    );
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      paddingX={1}
      paddingY={0}
    >
      <Box marginBottom={1}>
        <Text bold color="cyan">History</Text>
        <Text dimColor> • ↑↓ navigate • Enter select • d delete • Esc close</Text>
      </Box>

      {items.map((item, i) => (
        <Box key={item.id}>
          <Text color={i === selectedIndex ? 'cyan' : undefined}>
            {i === selectedIndex ? '❯ ' : '  '}
          </Text>
          <Box width={40}>
            <Text bold={i === selectedIndex} color={i === selectedIndex ? 'cyan' : undefined}>
              {item.title.length > 35 ? item.title.slice(0, 35) + '...' : item.title}
            </Text>
          </Box>
          <Text dimColor> {formatRelativeTime(item.updatedAt)}</Text>
        </Box>
      ))}

      <Box marginTop={1}>
        <Text dimColor>
          {items.length} conversation{items.length !== 1 ? 's' : ''}
        </Text>
      </Box>
    </Box>
  );
}
