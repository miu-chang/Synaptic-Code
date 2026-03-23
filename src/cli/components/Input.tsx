import React, { useState, useRef, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { getCommands } from './CommandPalette.js';
import { useScrollPaused } from './ScrollContext.js';

// Animated dots with elapsed time: Processing... (5s)
function AnimatedDots({ startedAt }: { startedAt?: number }): React.ReactElement {
  const [dots, setDots] = useState(1);
  const [elapsed, setElapsed] = useState(0);
  const paused = useScrollPaused();

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => {
      setDots(d => (d % 3) + 1);
    }, 400);
    return () => clearInterval(timer);
  }, [paused]);

  useEffect(() => {
    if (!startedAt || paused) return;
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [startedAt, paused]);

  const dotsStr = '.'.repeat(dots).padEnd(3, ' ');
  const timeStr = elapsed > 0 ? ` (${elapsed}s)` : '';
  return <Text dimColor>Processing{dotsStr}{timeStr}</Text>;
}

interface InputProps {
  onSubmit: (value: string) => void;
  placeholder?: string;
  loading?: boolean;
  loadingStartedAt?: number;
}

// Format long/multiline input for display
function formatDisplayValue(value: string): { display: string; isTruncated: boolean; lineCount: number } {
  const lines = value.split('\n');
  const lineCount = lines.length;

  if (lineCount > 3 || value.length > 200) {
    // Truncate: show first line + "... (N lines)"
    const firstLine = lines[0].slice(0, 60);
    const suffix = firstLine.length < lines[0].length ? '...' : '';
    return {
      display: `${firstLine}${suffix} [${lineCount} lines, ${value.length} chars]`,
      isTruncated: true,
      lineCount,
    };
  }

  return { display: value, isTruncated: false, lineCount };
}

// Filter commands based on partial input
function getMatchingCommands(input: string) {
  if (!input.startsWith('/')) return [];
  const partial = input.slice(1).toLowerCase();
  const commands = getCommands();
  return commands.filter(cmd =>
    cmd.name.startsWith(partial) ||
    (cmd.shortcut && cmd.shortcut.startsWith(partial))
  );
}

// Keep history across re-renders but not across sessions
const inputHistory: string[] = [];
const MAX_HISTORY = 100;

export function Input({ onSubmit, placeholder = 'Type a message...', loading = false, loadingStartedAt }: InputProps): React.ReactElement {
  const [value, setValue] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [commandIndex, setCommandIndex] = useState(0);
  const savedInputRef = useRef(''); // Save current input when browsing history

  const matchingCommands = getMatchingCommands(value);
  const showCommandHints = value.startsWith('/') && matchingCommands.length > 0;
  const { display: displayValue, isTruncated } = formatDisplayValue(value);

  const handleSubmit = (v: string) => {
    if (v.trim() && !loading) {
      // If showing command hints and user presses enter, complete the command
      if (showCommandHints && matchingCommands.length > 0) {
        const selectedCmd = matchingCommands[commandIndex];
        const completed = `/${selectedCmd.name}`;

        // Add to history (avoid duplicates)
        if (inputHistory[0] !== completed) {
          inputHistory.unshift(completed);
          if (inputHistory.length > MAX_HISTORY) {
            inputHistory.pop();
          }
        }

        onSubmit(completed);
        setValue('');
        setHistoryIndex(-1);
        setCommandIndex(0);
        savedInputRef.current = '';
        return;
      }

      // Add to history (avoid duplicates)
      if (inputHistory[0] !== v.trim()) {
        inputHistory.unshift(v.trim());
        if (inputHistory.length > MAX_HISTORY) {
          inputHistory.pop();
        }
      }

      onSubmit(v.trim());
      setValue('');
      setHistoryIndex(-1);
      setCommandIndex(0);
      savedInputRef.current = '';
    }
  };

  // Handle up/down arrow keys for history or command selection
  useInput((input, key) => {
    if (loading) return;

    // Handle truncated input mode
    if (isTruncated) {
      if (key.return) {
        handleSubmit(value);
        return;
      }
      if (key.escape) {
        setValue('');
        return;
      }
      return; // Ignore other keys in truncated mode
    }

    // Tab to complete command
    if (key.tab && showCommandHints) {
      const selectedCmd = matchingCommands[commandIndex];
      setValue(`/${selectedCmd.name}`);
      setCommandIndex(0);
      return;
    }

    if (key.upArrow) {
      // If showing commands, navigate commands (loop)
      if (showCommandHints) {
        const maxIndex = matchingCommands.length - 1;
        setCommandIndex(i => (i > 0 ? i - 1 : maxIndex));
        return;
      }

      // Otherwise, history navigation
      if (inputHistory.length === 0) return;

      if (historyIndex === -1) {
        savedInputRef.current = value;
      }

      const newIndex = Math.min(historyIndex + 1, inputHistory.length - 1);
      setHistoryIndex(newIndex);
      setValue(inputHistory[newIndex]);
    }

    if (key.downArrow) {
      // If showing commands, navigate commands (loop)
      if (showCommandHints) {
        const maxIndex = matchingCommands.length - 1;
        setCommandIndex(i => (i < maxIndex ? i + 1 : 0));
        return;
      }

      // Otherwise, history navigation
      if (historyIndex === -1) return;

      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);

      if (newIndex === -1) {
        setValue(savedInputRef.current);
      } else {
        setValue(inputHistory[newIndex]);
      }
    }
  });

  const handleChange = (newValue: string) => {
    setValue(newValue);
    setCommandIndex(0); // Reset command selection on type
    // Reset history browsing when user types
    if (historyIndex !== -1) {
      setHistoryIndex(-1);
      savedInputRef.current = '';
    }
  };

  return (
    <Box flexDirection="column">
      {/* Command hints - Claude Code style */}
      {showCommandHints && (
        <Box flexDirection="column" marginBottom={1} paddingX={1}>
          {matchingCommands.map((cmd, i) => (
            <Box key={cmd.name}>
              <Text color={i === commandIndex ? 'cyan' : 'gray'}>
                {i === commandIndex ? '❯ ' : '  '}
              </Text>
              <Text color={i === commandIndex ? 'cyan' : undefined} bold={i === commandIndex}>
                /{cmd.name}
              </Text>
              {cmd.shortcut && (
                <Text dimColor> [{cmd.shortcut}]</Text>
              )}
              <Text dimColor> - {cmd.description}</Text>
            </Box>
          ))}
          <Text dimColor>  ↑↓ select • Tab complete • Enter execute</Text>
        </Box>
      )}

      {/* Input box */}
      <Box
        borderStyle="round"
        borderColor={loading ? 'gray' : isTruncated ? 'yellow' : 'cyan'}
        paddingX={1}
      >
        <Text color="cyan">❯ </Text>
        {loading ? (
          <AnimatedDots startedAt={loadingStartedAt} />
        ) : isTruncated ? (
          // Show truncated preview for long/multiline input
          <Box flexDirection="column">
            <Text color="yellow">{displayValue}</Text>
            <Text dimColor>Press Enter to send, Esc to clear</Text>
          </Box>
        ) : (
          <TextInput
            value={value}
            onChange={handleChange}
            onSubmit={handleSubmit}
            placeholder={placeholder}
          />
        )}
      </Box>
    </Box>
  );
}
