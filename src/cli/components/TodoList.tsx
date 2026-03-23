import React from 'react';
import { Box, Text } from 'ink';

interface Todo {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
}

interface TodoListProps {
  todos: Todo[];
}

export function TodoList({ todos }: TodoListProps): React.ReactElement {
  if (todos.length === 0) {
    return (
      <Box paddingX={1}>
        <Text dimColor>No tasks</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1}>
      <Box marginBottom={1}>
        <Text bold color="magenta">Tasks</Text>
      </Box>
      {todos.map((todo, i) => {
        let icon: string;
        let color: string;

        switch (todo.status) {
          case 'completed':
            icon = '✓';
            color = 'green';
            break;
          case 'in_progress':
            icon = '→';
            color = 'yellow';
            break;
          default:
            icon = '○';
            color = 'gray';
        }

        return (
          <Box key={todo.id}>
            <Text color={color as any}>{icon} </Text>
            <Text
              strikethrough={todo.status === 'completed'}
              dimColor={todo.status === 'completed'}
            >
              {todo.content}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}

/**
 * Compact TODO bar for bottom of screen (Claude Code style)
 * Shows only in-progress and pending tasks inline
 * Press 't' to expand/collapse the full list
 */
interface TodoBarProps {
  todos: Todo[];
  expanded?: boolean;
  onToggle?: () => void;
}

export function TodoBar({ todos, expanded = false, onToggle }: TodoBarProps): React.ReactElement | null {
  // Filter to show only active tasks (in_progress first, then pending)
  const activeTodos = todos.filter(t => t.status !== 'completed');
  const completedCount = todos.filter(t => t.status === 'completed').length;

  if (todos.length === 0) {
    return null;
  }

  // Sort: in_progress first, then pending
  const sorted = [...activeTodos].sort((a, b) => {
    if (a.status === 'in_progress' && b.status !== 'in_progress') return -1;
    if (b.status === 'in_progress' && a.status !== 'in_progress') return 1;
    return 0;
  });

  const inProgress = sorted.find(t => t.status === 'in_progress');
  const pendingCount = sorted.filter(t => t.status === 'pending').length;

  // Expanded view - show all todos
  if (expanded) {
    return (
      <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1} marginY={0}>
        <Box>
          <Text bold color="magenta">Tasks</Text>
          <Text dimColor> ({completedCount}/{todos.length} done)</Text>
        </Box>
        {todos.map((todo) => {
          let checkbox: string;
          let color: string;

          switch (todo.status) {
            case 'completed':
              checkbox = '[✓]';
              color = 'green';
              break;
            case 'in_progress':
              checkbox = '[→]';
              color = 'yellow';
              break;
            default:
              checkbox = '[ ]';
              color = 'gray';
          }

          return (
            <Box key={todo.id}>
              <Text color={color as any}>{checkbox} </Text>
              <Text
                strikethrough={todo.status === 'completed'}
                dimColor={todo.status === 'completed'}
              >
                {todo.content}
              </Text>
            </Box>
          );
        })}
        <Text dimColor>Press t to collapse</Text>
      </Box>
    );
  }

  // Collapsed view - single line
  return (
    <Box>
      <Text dimColor color="gray">[</Text>
      {inProgress ? (
        <>
          <Text color="yellow">→</Text>
          <Text dimColor color="gray">] </Text>
          <Text>{inProgress.content.length > 50 ? inProgress.content.slice(0, 50) + '...' : inProgress.content}</Text>
        </>
      ) : pendingCount > 0 ? (
        <>
          <Text dimColor> </Text>
          <Text dimColor color="gray">] </Text>
          <Text dimColor>{pendingCount} pending</Text>
        </>
      ) : (
        <>
          <Text color="green">✓</Text>
          <Text dimColor color="gray">] </Text>
          <Text dimColor>All done</Text>
        </>
      )}
      {(inProgress && pendingCount > 0) && (
        <Text dimColor> +{pendingCount}</Text>
      )}
      {completedCount > 0 && (
        <Text color="green"> ✓{completedCount}</Text>
      )}
      <Text dimColor> (t:expand)</Text>
    </Box>
  );
}
