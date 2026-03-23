/**
 * AgentView - UI for Agent Mode
 * Shows real-time progress of autonomous task execution
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import type { AgentStep, AgentState } from '../../core/agent.js';
import { getSubAgentStatuses, type SubAgentStatus } from '../../tools/agent.js';
import { useScrollPaused } from './ScrollContext.js';

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

interface AgentViewProps {
  state: AgentState;
  onCancel: () => void;
}

function Spinner(): React.ReactElement {
  const [frame, setFrame] = useState(0);
  const paused = useScrollPaused();

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => setFrame(f => (f + 1) % SPINNER_FRAMES.length), 80);
    return () => clearInterval(timer);
  }, [paused]);

  return <Text color="cyan">{SPINNER_FRAMES[frame]}</Text>;
}

function StepIcon({ type, isLatest }: { type: AgentStep['type']; isLatest: boolean }): React.ReactElement {
  const [frame, setFrame] = useState(0);
  const paused = useScrollPaused();

  useEffect(() => {
    if (!isLatest || type === 'complete' || type === 'error' || paused) return;
    const timer = setInterval(() => setFrame(f => (f + 1) % SPINNER_FRAMES.length), 80);
    return () => clearInterval(timer);
  }, [isLatest, type, paused]);

  switch (type) {
    case 'thinking':
      return <Text color="cyan">{isLatest ? SPINNER_FRAMES[frame] : '○'}</Text>;
    case 'tool_call':
      return <Text color="yellow">{isLatest ? SPINNER_FRAMES[frame] : '○'}</Text>;
    case 'tool_result':
      return <Text color="green">✓</Text>;
    case 'complete':
      return <Text color="green">●</Text>;
    case 'error':
      return <Text color="red">✗</Text>;
    default:
      return <Text>○</Text>;
  }
}

function StepDisplay({ step, isLatest }: { step: AgentStep; isLatest: boolean }): React.ReactElement {
  const getColor = () => {
    switch (step.type) {
      case 'thinking': return 'cyan';
      case 'tool_call': return 'yellow';
      case 'tool_result': return 'green';
      case 'complete': return 'greenBright';
      case 'error': return 'red';
      default: return undefined;
    }
  };

  const content = step.toolName
    ? `${step.toolName} ${step.content}`
    : step.content;

  return (
    <Box>
      <StepIcon type={step.type} isLatest={isLatest} />
      <Text color={getColor()}> {content.slice(0, 100)}{content.length > 100 ? '...' : ''}</Text>
    </Box>
  );
}

function SubAgentLine({ status }: { status: SubAgentStatus }): React.ReactElement {
  const statusColor = {
    idle: 'gray',
    running: 'cyan',
    completed: 'green',
    failed: 'red',
    cancelled: 'yellow',
  }[status.status];

  const elapsed = ((Date.now() - status.startedAt) / 1000).toFixed(0);

  return (
    <Box marginLeft={2}>
      {status.status === 'running' ? <Spinner /> : <Text color={statusColor}>●</Text>}
      <Text bold color={statusColor}> {status.id}</Text>
      <Text dimColor> │ </Text>
      <Text>{status.currentStep.slice(0, 50)}</Text>
      <Text dimColor> │ {elapsed}s</Text>
    </Box>
  );
}

export function AgentView({ state, onCancel }: AgentViewProps): React.ReactElement {
  const [subAgents, setSubAgents] = useState<Map<string, SubAgentStatus>>(new Map());
  const paused = useScrollPaused();

  // Poll for sub-agent updates
  useEffect(() => {
    if (state.status !== 'running' || paused) return;

    const timer = setInterval(() => {
      setSubAgents(getSubAgentStatuses());
    }, 200);

    return () => clearInterval(timer);
  }, [state.status, paused]);

  useInput((input, key) => {
    if (key.escape || input === 'q' || (key.ctrl && input === 'c')) {
      onCancel();
    }
  });

  const statusColor = {
    idle: 'gray',
    running: 'cyan',
    completed: 'green',
    failed: 'red',
    cancelled: 'yellow',
  }[state.status];

  const elapsed = state.completedAt
    ? ((state.completedAt - state.startedAt) / 1000).toFixed(1)
    : ((Date.now() - state.startedAt) / 1000).toFixed(1);

  // Show last N steps
  const visibleSteps = state.steps.slice(-8);

  // Count sub-agents
  const runningSubAgents = Array.from(subAgents.values()).filter(s => s.status === 'running').length;
  const totalSubAgents = subAgents.size;

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={statusColor} paddingX={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color={statusColor}>Agent Mode</Text>
        <Text dimColor> │ </Text>
        <Text color={statusColor}>{state.status.toUpperCase()}</Text>
        <Text dimColor> │ </Text>
        <Text>Steps: {state.iterations}</Text>
        <Text dimColor> │ </Text>
        <Text>{elapsed}s</Text>
        {totalSubAgents > 0 && (
          <>
            <Text dimColor> │ </Text>
            <Text color="magenta">Sub: {runningSubAgents}/{totalSubAgents}</Text>
          </>
        )}
        {state.status === 'running' && (
          <Text dimColor> │ Press ESC to cancel</Text>
        )}
      </Box>

      {/* Goal */}
      <Box marginBottom={1}>
        <Text dimColor>Goal: </Text>
        <Text>{state.goal.slice(0, 80)}{state.goal.length > 80 ? '...' : ''}</Text>
      </Box>

      {/* Steps */}
      <Box flexDirection="column">
        {visibleSteps.map((step, i) => (
          <StepDisplay
            key={step.id}
            step={step}
            isLatest={i === visibleSteps.length - 1 && state.status === 'running'}
          />
        ))}
      </Box>

      {/* Sub-agents */}
      {totalSubAgents > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold color="magenta">Sub-Agents</Text>
          {Array.from(subAgents.values()).map(status => (
            <SubAgentLine key={status.id} status={status} />
          ))}
        </Box>
      )}

      {/* Result/Error */}
      {state.status === 'completed' && state.result && (
        <Box marginTop={1} borderStyle="single" borderColor="green" paddingX={1}>
          <Text color="green">{state.result}</Text>
        </Box>
      )}

      {state.status === 'failed' && state.error && (
        <Box marginTop={1} borderStyle="single" borderColor="red" paddingX={1}>
          <Text color="red">{state.error}</Text>
        </Box>
      )}
    </Box>
  );
}
