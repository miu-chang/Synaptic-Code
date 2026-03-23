/**
 * SubAgentBar - Shows running sub-agents status in one line each
 * Displays in chat mode when agents are active
 */

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import type { SubAgentStatus } from '../../tools/agent.js';
import { useScrollPaused } from './ScrollContext.js';

const SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

interface SubAgentBarProps {
  statuses: Map<string, SubAgentStatus>;
}

function AgentLine({ status }: { status: SubAgentStatus }): React.ReactElement {
  const [frame, setFrame] = useState(0);
  const paused = useScrollPaused();

  useEffect(() => {
    if (status.status !== 'running' || paused) return;
    const timer = setInterval(() => setFrame(f => (f + 1) % SPINNER.length), 80);
    return () => clearInterval(timer);
  }, [status.status, paused]);

  const elapsed = ((Date.now() - status.startedAt) / 1000).toFixed(0);

  const statusIcon = {
    idle: '○',
    running: SPINNER[frame],
    completed: '✓',
    failed: '✗',
    cancelled: '⊘',
  }[status.status];

  const statusColor = {
    idle: 'gray',
    running: 'cyan',
    completed: 'green',
    failed: 'red',
    cancelled: 'yellow',
  }[status.status];

  return (
    <Box>
      <Text color={statusColor}>{statusIcon}</Text>
      <Text color={statusColor} bold> {status.id}</Text>
      <Text dimColor> │ </Text>
      <Text>{status.currentStep}</Text>
      <Text dimColor> │ {elapsed}s</Text>
    </Box>
  );
}

export function SubAgentBar({ statuses }: SubAgentBarProps): React.ReactElement | null {
  if (statuses.size === 0) return null;

  const running = Array.from(statuses.values()).filter(s => s.status === 'running').length;

  return (
    <Box flexDirection="column" marginY={0} paddingX={1} borderStyle="single" borderColor="magenta">
      <Box>
        <Text bold color="magenta">Sub-Agents</Text>
        <Text dimColor> ({running} running)</Text>
      </Box>
      {Array.from(statuses.values()).map(status => (
        <AgentLine key={status.id} status={status} />
      ))}
    </Box>
  );
}
