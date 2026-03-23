import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { t } from '../../i18n/index.js';
import { useScrollPaused } from './ScrollContext.js';

function formatTime(): string {
  const now = new Date();
  return now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
}

interface StatusBarProps {
  provider: string;
  model: string;
  toolCount: number;
  tokenCount?: number;
  maxTokens?: number;
  isCompressed?: boolean;
  lastUsage?: { prompt: number; completion: number } | null;
  autoAccept?: boolean;
  isLoading?: boolean;
}

function formatTokens(n: number): string {
  if (n >= 1000) {
    return (n / 1000).toFixed(1) + 'k';
  }
  return String(n);
}

/**
 * Context usage bar visualization
 * [████████░░░░░░░░░░░░] 2.5k/32k
 */
function ContextBar({
  usage,
  tokenCount,
  maxTokens,
  isCompressed,
}: {
  usage: number;
  tokenCount: number;
  maxTokens: number;
  isCompressed: boolean;
}): React.ReactElement {
  const barWidth = 12;
  const filled = Math.round((usage / 100) * barWidth);
  const empty = barWidth - filled;

  // Only warn when high usage
  const barColor = usage > 90 ? 'red' : usage > 75 ? 'yellow' : 'gray';

  return (
    <Box>
      <Text dimColor>[</Text>
      <Text color={barColor}>{'█'.repeat(filled)}</Text>
      <Text dimColor>{'░'.repeat(empty)}</Text>
      <Text dimColor>] </Text>
      <Text dimColor>{formatTokens(tokenCount)}/{formatTokens(maxTokens)}</Text>
      {isCompressed && <Text dimColor> [compressed]</Text>}
    </Box>
  );
}

export function StatusBar({
  provider,
  model,
  toolCount,
  tokenCount = 0,
  maxTokens = 128000,
  isCompressed = false,
  lastUsage = null,
  autoAccept = true,
  isLoading = false,
}: StatusBarProps): React.ReactElement {
  const usage = maxTokens > 0 ? (tokenCount / maxTokens) * 100 : 0;
  const [time, setTime] = useState(formatTime());
  const paused = useScrollPaused();

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => setTime(formatTime()), 60000);
    return () => clearInterval(timer);
  }, [paused]);

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box
        borderStyle="round"
        borderColor="gray"
        paddingX={1}
      >
        <Text dimColor>{model.length > 25 ? model.slice(0, 25) + '…' : model}</Text>
        <Text dimColor> │ </Text>
        <ContextBar usage={usage} tokenCount={tokenCount} maxTokens={maxTokens} isCompressed={isCompressed} />
        {lastUsage && (
          <Text dimColor> │ ↑{formatTokens(lastUsage.prompt)} ↓{formatTokens(lastUsage.completion)}</Text>
        )}
        <Text dimColor> │ {toolCount} tools</Text>
        <Text dimColor> │ </Text>
        <Text dimColor>{autoAccept ? t().status.autoAccept : t().status.confirmMode}</Text>
      </Box>
      <Box paddingX={1} justifyContent="space-between">
        <Text dimColor>
          {isLoading
            ? `${t().ui.pressEscToCancel} • Space ${t().ui.scrollPause}`
            : `/ ${t().ui.commands} • Shift+Tab ${t().ui.toggleConfirm} • Esc×2 ${t().ui.undo} • Ctrl+C×2 ${t().ui.exit}`
          }
        </Text>
        <Text dimColor>{time}</Text>
      </Box>
    </Box>
  );
}
