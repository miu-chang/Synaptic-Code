import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { useScrollPaused } from './ScrollContext.js';

const SPINNER_FRAMES = ['|', '/', '-', '\\'];
const DOTS = ['o', 'O', '0', 'O'];
const PROGRESS = ['[    ]', '[=   ]', '[==  ]', '[=== ]', '[====]', '[=== ]', '[==  ]', '[=   ]'];

interface SpinnerProps {
  text?: string;
  type?: 'dots' | 'spinner' | 'progress';
}

export function Spinner({ text = 'Thinking...', type = 'spinner' }: SpinnerProps): React.ReactElement {
  const [frame, setFrame] = useState(0);
  const frames = type === 'dots' ? DOTS : type === 'progress' ? PROGRESS : SPINNER_FRAMES;
  const paused = useScrollPaused();

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => {
      setFrame(f => (f + 1) % frames.length);
    }, 100);
    return () => clearInterval(timer);
  }, [frames.length, paused]);

  return (
    <Box>
      <Text color="cyan">{frames[frame]} </Text>
      <Text dimColor>{text}</Text>
    </Box>
  );
}

/**
 * Shimmer text effect - a bright spot moves across the text
 */
function ShimmerText({ text }: { text: string }): React.ReactElement {
  const [pos, setPos] = useState(0);
  const paused = useScrollPaused();

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => {
      setPos(p => (p + 1) % (text.length + 3));
    }, 80);
    return () => clearInterval(timer);
  }, [text.length, paused]);

  return (
    <Text>
      {text.split('').map((char, i) => {
        const dist = Math.abs(i - pos);
        if (dist === 0) {
          return <Text key={i} color="whiteBright" bold>{char}</Text>;
        } else if (dist === 1) {
          return <Text key={i} color="cyanBright">{char}</Text>;
        } else if (dist === 2) {
          return <Text key={i} color="cyan">{char}</Text>;
        } else {
          return <Text key={i} color="gray">{char}</Text>;
        }
      })}
    </Text>
  );
}

export function ThinkingIndicator(): React.ReactElement {
  const [frame, setFrame] = useState(0);
  const paused = useScrollPaused();

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => {
      setFrame(f => (f + 1) % SPINNER_FRAMES.length);
    }, 100);
    return () => clearInterval(timer);
  }, [paused]);

  return (
    <Box marginY={1} paddingLeft={2}>
      <Text color="cyan">{SPINNER_FRAMES[frame]} </Text>
      <ShimmerText text="Thinking..." />
    </Box>
  );
}

interface CompactingIndicatorProps {
  startedAt?: number;
}

export function CompactingIndicator({ startedAt }: CompactingIndicatorProps): React.ReactElement {
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

  return (
    <Box marginY={1} paddingLeft={2}>
      <Text color="magenta">ℹ Auto-compacting{dotsStr}{timeStr}</Text>
    </Box>
  );
}

interface DownloadIndicatorProps {
  model: string;
  status: 'searching' | 'downloading' | 'done' | 'error';
  progress?: string;
  message?: string;
}

// Strip ANSI codes and extract clean progress info
function parseProgress(raw: string): string {
  // Remove ANSI escape codes
  const clean = raw.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '').replace(/[\x00-\x1F]/g, ' ').trim();

  // Try to extract percentage
  const percentMatch = clean.match(/(\d+\.?\d*)%/);
  const sizeMatch = clean.match(/(\d+\.?\d*\s*[KMGT]?B)\s*\/\s*(\d+\.?\d*\s*[KMGT]?B)/i);
  const speedMatch = clean.match(/(\d+\.?\d*\s*[KMGT]?B\/s)/i);
  const etaMatch = clean.match(/ETA\s*(\d+:\d+)/i);

  const parts: string[] = [];
  if (percentMatch) parts.push(`${percentMatch[1]}%`);
  if (sizeMatch) parts.push(`${sizeMatch[1]}/${sizeMatch[2]}`);
  if (speedMatch) parts.push(speedMatch[1]);
  if (etaMatch) parts.push(`ETA ${etaMatch[1]}`);

  return parts.length > 0 ? parts.join(' | ') : clean.slice(0, 60);
}

export function DownloadIndicator({ model, status, progress, message }: DownloadIndicatorProps): React.ReactElement {
  const [dots, setDots] = useState(1);
  const paused = useScrollPaused();

  useEffect(() => {
    if (status !== 'downloading' || paused) return;
    const timer = setInterval(() => {
      setDots(d => (d % 3) + 1);
    }, 400);
    return () => clearInterval(timer);
  }, [status, paused]);

  const dotsStr = '.'.repeat(dots).padEnd(3, ' ');
  const statusIcon = status === 'done' ? '✓' : status === 'error' ? '✗' : '↓';
  const statusColor = status === 'done' ? 'green' : status === 'error' ? 'red' : 'cyan';

  // Parse and clean progress text
  const rawProgress = progress || message || '';
  const progressText = status === 'downloading' && rawProgress ? parseProgress(rawProgress) : rawProgress;

  return (
    <Box marginY={1} paddingLeft={2}>
      <Text color={statusColor}>{statusIcon} </Text>
      <Text>Downloading </Text>
      <Text bold>{model.length > 30 ? model.slice(0, 30) + '...' : model}</Text>
      {status === 'downloading' && !progressText && <Text dimColor>{dotsStr}</Text>}
      {progressText && <Text dimColor> {progressText}</Text>}
    </Box>
  );
}

// Tool name to human-readable description mapping
const TOOL_DESCRIPTIONS: Record<string, { icon: string; action: string }> = {
  // File operations
  read_file: { icon: '[R]', action: 'Reading file' },
  write_file: { icon: '[W]', action: 'Writing file' },
  edit_file: { icon: '[E]', action: 'Editing file' },
  glob: { icon: '[G]', action: 'Searching files' },
  grep: { icon: '[S]', action: 'Searching content' },

  // Bash
  bash: { icon: '[>]', action: 'Running command' },
  execute_bash: { icon: '[>]', action: 'Running command' },

  // Web
  web_search: { icon: '[?]', action: 'Searching web' },
  web_fetch: { icon: '[~]', action: 'Fetching URL' },

  // Todo
  todo_read: { icon: '[T]', action: 'Reading todos' },
  todo_write: { icon: '[T]', action: 'Updating todos' },
};

function getToolInfo(name: string): { icon: string; action: string } {
  return TOOL_DESCRIPTIONS[name] || { icon: '[*]', action: `Running ${name}` };
}

interface ToolActivityProps {
  name: string;
  args?: string;
}

export function ToolActivity({ name, args }: ToolActivityProps): React.ReactElement {
  const [frame, setFrame] = useState(0);
  const { icon, action } = getToolInfo(name);
  const paused = useScrollPaused();

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => {
      setFrame(f => (f + 1) % SPINNER_FRAMES.length);
    }, 100);
    return () => clearInterval(timer);
  }, [paused]);

  // Extract meaningful info from args
  let detail = '';
  let content = '';
  let oldString = '';
  let newString = '';

  if (args) {
    try {
      const parsed = JSON.parse(args);
      if (parsed.path) detail = parsed.path;
      else if (parsed.pattern) detail = parsed.pattern;
      else if (parsed.query) detail = parsed.query;
      else if (parsed.url) detail = parsed.url;
      else if (parsed.command) detail = parsed.command.slice(0, 40);

      content = parsed.content || '';
      oldString = parsed.old_string || '';
      newString = parsed.new_string || '';
    } catch {
      // ignore parse errors
    }
  }

  // Generate diff preview for file operations
  const isFileWrite = name === 'write_file' && content;
  const isFileEdit = name === 'edit_file' && oldString && newString;
  let diffLines: { text: string; type: 'add' | 'remove' | 'info' }[] = [];
  let stats: { added: number; removed: number } | null = null;

  if (isFileWrite) {
    const lines = content.split('\n');
    stats = { added: lines.length, removed: 0 };
    diffLines = lines.map(l => ({ text: `+ ${l}`, type: 'add' as const }));
  } else if (isFileEdit) {
    const oldLines = oldString.split('\n');
    const newLines = newString.split('\n');
    const oldSet = new Set(oldLines);
    const newSet = new Set(newLines);

    let added = 0, removed = 0;
    for (const line of oldLines) {
      if (!newSet.has(line)) {
        diffLines.push({ text: `- ${line}`, type: 'remove' });
        removed++;
      }
    }
    for (const line of newLines) {
      if (!oldSet.has(line)) {
        diffLines.push({ text: `+ ${line}`, type: 'add' });
        added++;
      }
    }
    stats = { added, removed };
  }

  return (
    <Box flexDirection="column" marginY={1}>
      <Box>
        <Text color="yellow">{icon} </Text>
        <Text color="cyan">{SPINNER_FRAMES[frame]} </Text>
        <Text bold>{action}</Text>
        {detail && (
          <Text color="cyan"> {detail.length > 50 ? detail.slice(0, 50) + '...' : detail}</Text>
        )}
        {stats && (
          <>
            {stats.added > 0 && <Text color="green"> +{stats.added}</Text>}
            {stats.removed > 0 && <Text color="red"> -{stats.removed}</Text>}
          </>
        )}
      </Box>
      {diffLines.length > 0 && (
        <Box flexDirection="column" paddingLeft={4}>
          {diffLines.map((line, i) => (
            <Text
              key={i}
              color={line.type === 'add' ? 'green' : line.type === 'remove' ? 'red' : undefined}
            >
              {line.text}
            </Text>
          ))}
        </Box>
      )}
    </Box>
  );
}

export function ToolExecuting({ name }: { name: string }): React.ReactElement {
  return <ToolActivity name={name} />;
}
