import React, { useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { t } from '../../i18n/index.js';
import { loadCustomCommands } from '../../core/custom-commands.js';

interface Command {
  name: string;
  descriptionKey: keyof ReturnType<typeof t>['commandDescriptions'];
  shortcut?: string;
}

const COMMAND_DEFINITIONS: Command[] = [
  { name: 'help', descriptionKey: 'help', shortcut: '?' },
  { name: 'model', descriptionKey: 'model', shortcut: 'm' },
  { name: 'provider', descriptionKey: 'provider', shortcut: 'p' },
  { name: 'new', descriptionKey: 'new', shortcut: 'n' },
  { name: 'history', descriptionKey: 'history', shortcut: 'h' },
  { name: 'clear', descriptionKey: 'clear', shortcut: 'c' },
  { name: 'compact', descriptionKey: 'compact' },
  { name: 'agent', descriptionKey: 'agent', shortcut: 'a' },
  { name: 'todo', descriptionKey: 'todo', shortcut: 't' },
  { name: 'language', descriptionKey: 'language', shortcut: 'l' },
  { name: 'license', descriptionKey: 'license' },
  { name: 'tools', descriptionKey: 'tools' },
  { name: 'config', descriptionKey: 'config' },
  { name: 'synaptic', descriptionKey: 'synaptic' },
  { name: 'self', descriptionKey: 'self' },
  { name: 'timeline', descriptionKey: 'timeline' },
  { name: 'diff', descriptionKey: 'diff' },
  { name: 'changelog', descriptionKey: 'changelog' },
  { name: 'quit', descriptionKey: 'quit', shortcut: 'q' },
];

// Helper to get commands with localized descriptions
export function getCommands() {
  const translations = t();
  return COMMAND_DEFINITIONS.map(cmd => ({
    name: cmd.name,
    description: translations.commandDescriptions[cmd.descriptionKey],
    shortcut: cmd.shortcut,
  }));
}

// For backwards compatibility
export const COMMANDS = COMMAND_DEFINITIONS.map(cmd => ({
  name: cmd.name,
  description: cmd.descriptionKey, // Will be replaced at runtime
  shortcut: cmd.shortcut,
}));

// Get all valid command names and shortcuts
export const COMMAND_NAMES = new Set(
  COMMAND_DEFINITIONS.flatMap(c => [c.name, c.shortcut].filter(Boolean) as string[])
);

interface CommandPaletteProps {
  onSelect: (command: string) => void;
  onClose: () => void;
}

export function CommandPalette({ onSelect, onClose }: CommandPaletteProps): React.ReactElement {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filter, setFilter] = useState('');

  // Load custom commands from synaptic/ directory
  const customCommands = useMemo(() => {
    return loadCustomCommands().map(cmd => ({
      name: cmd.name,
      description: `[custom] ${cmd.content.slice(0, 50)}${cmd.content.length > 50 ? '...' : ''}`,
      shortcut: undefined,
      isCustom: true,
    }));
  }, []);

  const commands = getCommands();
  const allCommands = [...commands, ...customCommands];
  const filteredCommands = allCommands.filter(cmd =>
    cmd.name.includes(filter.toLowerCase()) ||
    cmd.description.toLowerCase().includes(filter.toLowerCase())
  );

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
      setSelectedIndex(i => Math.min(filteredCommands.length - 1, i + 1));
      return;
    }

    if (key.return) {
      if (filteredCommands[selectedIndex]) {
        onSelect(filteredCommands[selectedIndex].name);
      }
      return;
    }

    if (key.backspace || key.delete) {
      setFilter(f => f.slice(0, -1));
      setSelectedIndex(0);
      return;
    }

    if (input && !key.ctrl && !key.meta) {
      setFilter(f => f + input);
      setSelectedIndex(0);
    }
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      paddingX={1}
      paddingY={0}
    >
      <Box marginBottom={1}>
        <Text bold color="cyan">Commands</Text>
        <Text dimColor> • ↑↓ navigate • Enter select • Esc close</Text>
      </Box>

      {filter && (
        <Box marginBottom={1}>
          <Text dimColor>Filter: </Text>
          <Text color="yellow">{filter}</Text>
        </Box>
      )}

      {filteredCommands.map((cmd, i) => {
        const isCustom = 'isCustom' in cmd && cmd.isCustom;
        return (
          <Box key={cmd.name}>
            <Text color={i === selectedIndex ? 'cyan' : undefined}>
              {i === selectedIndex ? '❯ ' : '  '}
            </Text>
            <Text bold={i === selectedIndex} color={i === selectedIndex ? 'cyan' : (isCustom ? 'magenta' : undefined)}>
              /{cmd.name}
            </Text>
            {isCustom ? <Text color="magenta"> [custom]</Text> : null}
            <Text dimColor> - {cmd.description.replace('[custom] ', '')}</Text>
            {cmd.shortcut ? (
              <Text color="gray"> [{cmd.shortcut}]</Text>
            ) : null}
          </Box>
        );
      })}

      {filteredCommands.length === 0 && (
        <Text dimColor>No commands found</Text>
      )}
    </Box>
  );
}
