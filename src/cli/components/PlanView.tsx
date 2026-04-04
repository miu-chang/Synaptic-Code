/**
 * PlanView - Claude Code style plan display
 * Shows execution plan inline before tool calls
 */

import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

export interface PlanItem {
  id: number;
  action: string;
  tool?: string;
  status: 'pending' | 'approved' | 'rejected' | 'executing' | 'completed';
  outsideProject?: boolean;  // Warning for operations outside project root
}

interface PlanViewProps {
  items: PlanItem[];
  onApprove: (itemId: number) => void;
  onApproveAll: () => void;
  onReject: () => void;
}

export function PlanView({ items, onApprove, onApproveAll, onReject }: PlanViewProps): React.ReactElement {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const pendingItems = items.filter(i => i.status === 'pending');

  useInput((input, key) => {
    if (pendingItems.length === 0) return;

    if (key.upArrow) {
      setSelectedIndex(i => Math.max(0, i - 1));
    } else if (key.downArrow) {
      setSelectedIndex(i => Math.min(pendingItems.length - 1, i + 1));
    } else if (input === 'y' || key.return) {
      // Approve selected or all
      if (pendingItems.length === 1) {
        onApprove(pendingItems[0].id);
      } else {
        onApproveAll();
      }
    } else if (input === 'n' || key.escape) {
      onReject();
    }
  });

  if (items.length === 0) {
    return <Box />;
  }

  return (
    <Box flexDirection="column" marginY={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">Plan </Text>
        <Text dimColor>({items.length} step{items.length > 1 ? 's' : ''})</Text>
      </Box>

      {items.map((item, idx) => {
        const isSelected = pendingItems[selectedIndex]?.id === item.id;
        const statusIcon = item.outsideProject ? '⚠' : {
          pending: '○',
          approved: '✓',
          rejected: '✗',
          executing: '◉',
          completed: '●',
        }[item.status];

        const statusColor = item.outsideProject ? 'red' : {
          pending: isSelected ? 'cyan' : 'gray',
          approved: 'green',
          rejected: 'red',
          executing: 'yellow',
          completed: 'green',
        }[item.status];

        return (
          <Box key={item.id} paddingLeft={1} flexDirection="column">
            <Box>
              <Text color={statusColor}>
                {isSelected && item.status === 'pending' ? '❯ ' : '  '}
                {statusIcon}
              </Text>
              <Text color={item.outsideProject ? 'red' : (item.status === 'pending' ? undefined : 'gray')}>
                {item.action}
              </Text>
              {item.tool && (
                <Text color="yellow" dimColor={item.status !== 'pending'}>
                  {' '}[{item.tool}]
                </Text>
              )}
            </Box>
            {item.outsideProject && (
              <Box paddingLeft={4}>
                <Text color="red" bold>↳ OUTSIDE PROJECT</Text>
              </Box>
            )}
          </Box>
        );
      })}

      {pendingItems.length > 0 && (
        <Box marginTop={1} paddingLeft={1}>
          <Text dimColor>
            <Text color="green">Y</Text> approve
            {pendingItems.length > 1 && ' all'}
            {' • '}
            <Text color="red">N</Text> reject
          </Text>
        </Box>
      )}
    </Box>
  );
}

/**
 * Inline plan confirmation (single action)
 */
interface InlinePlanProps {
  action: string;
  tool?: string;
  onApprove: () => void;
  onReject: () => void;
}

export function InlinePlan({ action, tool, onApprove, onReject }: InlinePlanProps): React.ReactElement {
  useInput((input, key) => {
    if (input === 'y' || key.return) {
      onApprove();
    } else if (input === 'n' || key.escape) {
      onReject();
    }
  });

  return (
    <Box flexDirection="column" marginY={1}>
      <Box>
        <Text color="cyan">○ </Text>
        <Text>{action}</Text>
        {tool && <Text color="yellow"> [{tool}]</Text>}
      </Box>
      <Box paddingLeft={2}>
        <Text dimColor>
          <Text color="green">Y</Text> approve • <Text color="red">N</Text> reject
        </Text>
      </Box>
    </Box>
  );
}
