import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { useScrollPaused } from './ScrollContext.js';

// Blinking dot for executing state
const DOT_FRAMES = ['●', '○'];

// Tool name to human-readable description mapping
const TOOL_INFO: Record<string, { icon: string; label: string }> = {
  read_file: { icon: '[R]', label: 'Read' },
  write_file: { icon: '[W]', label: 'Write' },
  edit_file: { icon: '[E]', label: 'Edit' },
  glob: { icon: '[G]', label: 'Glob' },
  grep: { icon: '[S]', label: 'Search' },
  bash: { icon: '[>]', label: 'Bash' },
  execute_bash: { icon: '[>]', label: 'Bash' },
  web_search: { icon: '[?]', label: 'WebSearch' },
  web_fetch: { icon: '[~]', label: 'Fetch' },
  todo_read: { icon: '[T]', label: 'TodoRead' },
  todo_write: { icon: '[T]', label: 'TodoWrite' },
  synaptic_history: { icon: '[H]', label: 'History' },
};

/**
 * Get tool info with smart detection for external tools
 */
function getToolInfo(name: string, args?: string): { icon: string; label: string; detail?: string } {
  // Check exact match first
  if (TOOL_INFO[name]) {
    return TOOL_INFO[name];
  }

  // Parse args once
  let parsed: Record<string, unknown> | null = null;
  if (args) {
    try {
      parsed = JSON.parse(args);
    } catch { /* ignore */ }
  }

  // Synaptic HTTP tools: blender_execute / unity_execute
  // args: {tool: "create_cube", params: {...}}
  if (name === 'blender_execute') {
    const detail = parsed?.tool as string | undefined;
    return { icon: '[B]', label: 'Blender', detail };
  }

  if (name === 'unity_execute') {
    const tool = (parsed?.tool as string) || '';
    const detail = tool.replace(/^unity_/, '');
    return { icon: '[U]', label: 'Unity', detail };
  }

  // List tools: show category being searched
  // args: {category: "Mesh"}
  if (name === 'blender_list_tools') {
    const category = parsed?.category as string | undefined;
    const detail = category ? `category:${category}` : 'categories';
    return { icon: '[B]', label: 'Blender', detail };
  }

  if (name === 'unity_list_tools') {
    const category = parsed?.category as string | undefined;
    const detail = category ? `category:${category}` : 'categories';
    return { icon: '[U]', label: 'Unity', detail };
  }

  // Synaptic logs: show server and log type
  // args: {server: "unity", logType: "error"}
  if (name === 'synaptic_logs') {
    const server = parsed?.server as string | undefined;
    const logType = parsed?.logType as string | undefined;
    const detail = [server, logType].filter(Boolean).join(' ');
    return { icon: '[L]', label: 'Logs', detail };
  }

  return { icon: '[*]', label: name };
}

interface ToolCallDisplayProps {
  name: string;
  args?: string;
  result?: string;
  isError?: boolean;
  isExecuting?: boolean;
}

/**
 * Format bytes to human readable (KB, MB)
 */
function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
  } else if (bytes >= 1024) {
    return (bytes / 1024).toFixed(1) + 'KB';
  }
  return bytes + 'B';
}

/**
 * Format tool result for compact display
 */
function formatToolResult(result: string, toolName: string): string {
  try {
    const parsed = JSON.parse(result);

    // Unity/Blender list_tools - show categories or tool names
    if (toolName.includes('list_tools')) {
      if (parsed.categories) {
        const names = parsed.categories.map((c: { name: string }) => c.name).slice(0, 5);
        const suffix = parsed.categories.length > 5 ? ` +${parsed.categories.length - 5} more` : '';
        return names.join(', ') + suffix;
      }
      if (parsed.tools) {
        const count = parsed.count || parsed.tools.length;
        return `${count} tools`;
      }
    }

    // Synaptic history
    if (toolName === 'synaptic_history' && parsed.recent) {
      return `${parsed.recent.length} recent operations`;
    }

    // Unity scene info
    if (parsed.gameObjectCount !== undefined) {
      return `${parsed.gameObjectCount} objects`;
    }

    // Success with result
    if (parsed.success && parsed.result) {
      const r = typeof parsed.result === 'string' ? parsed.result : JSON.stringify(parsed.result);
      return r.slice(0, 60) + (r.length > 60 ? '...' : '');
    }

    // Error
    if (parsed.error) {
      return parsed.error.slice(0, 80);
    }

    // Generic
    return result.slice(0, 80) + (result.length > 80 ? '...' : '');
  } catch {
    return result.slice(0, 80) + (result.length > 80 ? '...' : '');
  }
}

/**
 * Parse fetch result for status and size
 */
function parseFetchResult(result: string): { status?: number; size?: number; ok: boolean } {
  // Try to detect HTTP status from result
  const statusMatch = result.match(/(?:status|code)[:\s]*(\d{3})/i) ||
                      result.match(/^(\d{3})\s/) ||
                      result.match(/HTTP\/\d\.\d\s+(\d{3})/);
  const status = statusMatch ? parseInt(statusMatch[1]) : undefined;

  // Calculate content size
  const size = new TextEncoder().encode(result).length;

  // Determine if successful
  const ok = !result.toLowerCase().includes('error') &&
             !result.toLowerCase().includes('failed') &&
             (!status || (status >= 200 && status < 400));

  return { status, size, ok };
}

/**
 * Calculate simple line diff stats
 */
function calcDiff(oldContent: string, newContent: string): { added: number; removed: number } {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  const oldSet = new Set(oldLines);
  const newSet = new Set(newLines);

  let added = 0;
  let removed = 0;

  for (const line of newLines) {
    if (!oldSet.has(line)) added++;
  }
  for (const line of oldLines) {
    if (!newSet.has(line)) removed++;
  }

  return { added, removed };
}


export function ToolCallDisplay({
  name,
  args,
  result,
  isError = false,
  isExecuting = false,
}: ToolCallDisplayProps): React.ReactElement {
  const toolInfo = getToolInfo(name, args);
  const { label } = toolInfo;
  const externalDetail = 'detail' in toolInfo ? toolInfo.detail : undefined;
  const [frame, setFrame] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [startTime] = useState(() => Date.now());
  const paused = useScrollPaused();

  // Blinking dot animation for executing state
  useEffect(() => {
    if (!isExecuting || paused) return;
    const timer = setInterval(() => {
      setFrame(f => (f + 1) % DOT_FRAMES.length);
    }, 500);
    return () => clearInterval(timer);
  }, [isExecuting, paused]);

  // Elapsed time
  useEffect(() => {
    if (!isExecuting || paused) return;
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [isExecuting, startTime, paused]);

  // Parse args for meaningful display
  let detail = '';
  let content = '';
  let oldString = '';
  let newString = '';
  let path = '';

  if (args) {
    try {
      const parsed = JSON.parse(args);
      path = parsed.path || '';
      content = parsed.content || '';
      oldString = parsed.old_string || '';
      newString = parsed.new_string || '';

      if (path) detail = path;
      else if (parsed.pattern) detail = parsed.pattern;
      else if (parsed.query) detail = parsed.query;
      else if (parsed.url) detail = parsed.url;
      else if (parsed.command) detail = parsed.command.slice(0, 50);
    } catch {
      detail = args.slice(0, 60);
    }
  }

  // Determine if this is a file write/edit for special display
  const isFileWrite = name === 'write_file' && content;
  const isFileEdit = name === 'edit_file' && oldString && newString;
  const isFetch = name === 'web_fetch';
  const isSearch = name === 'web_search';

  // Calculate stats for file operations
  let stats: { added: number; removed: number } | null = null;
  let diffPreview: string[] = [];

  if (isFileWrite) {
    const lines = content.split('\n');
    stats = { added: lines.length, removed: 0 };
    // Show all lines
    diffPreview = lines.map(l => `+ ${l}`);
  } else if (isFileEdit) {
    stats = calcDiff(oldString, newString);
    // Show full diff
    const oldLines = oldString.split('\n');
    const newLines = newString.split('\n');
    const oldSet = new Set(oldLines);
    const newSet = new Set(newLines);

    for (const line of oldLines) {
      if (!newSet.has(line)) {
        diffPreview.push(`- ${line}`);
      }
    }
    for (const line of newLines) {
      if (!oldSet.has(line)) {
        diffPreview.push(`+ ${line}`);
      }
    }
  }

  // Determine dot color: white blinking (executing), green (success), red (error)
  const dotColor = isExecuting ? 'white' : isError ? 'red' : 'green';
  const dot = isExecuting ? DOT_FRAMES[frame] : '●';

  return (
    <Box flexDirection="column" marginY={0}>
      {/* Header */}
      <Box>
        <Text color={dotColor}>{dot} </Text>
        <Text>{label}</Text>
        {externalDetail && (
          <Text color="cyan"> {externalDetail}</Text>
        )}
        {detail && (
          <Text dimColor> {detail.length > 50 ? detail.slice(0, 50) + '...' : detail}</Text>
        )}
        {stats && (
          <Text>
            {stats.added > 0 && <Text color="green"> +{stats.added}</Text>}
            {stats.removed > 0 && <Text color="red"> -{stats.removed}</Text>}
          </Text>
        )}
        {isExecuting && elapsed > 0 && (
          <Text dimColor> ({elapsed}s)</Text>
        )}
      </Box>

      {/* Diff preview for file operations */}
      {diffPreview.length > 0 && (
        <Box flexDirection="column" paddingLeft={4} marginTop={0}>
          {diffPreview.map((line, i) => (
            <Text
              key={i}
              color={line.startsWith('+') ? 'green' : line.startsWith('-') ? 'red' : undefined}
              dimColor={line.startsWith('  ...')}
            >
              {line}
            </Text>
          ))}
        </Box>
      )}

      {/* Fetch result with status and size */}
      {result && isFetch && (() => {
        const { status, size, ok } = parseFetchResult(result);
        return (
          <Box paddingLeft={4}>
            <Text color={ok ? 'green' : 'red'}>
              {ok ? '✓ ' : '✗ '}
            </Text>
            {status && (
              <Text color={status >= 200 && status < 300 ? 'green' : status >= 400 ? 'red' : 'yellow'}>
                {status}{' '}
              </Text>
            )}
            {size && <Text dimColor>{formatBytes(size)}</Text>}
          </Box>
        );
      })()}

      {/* Search result count */}
      {result && isSearch && (
        <Box paddingLeft={4}>
          <Text color="green">✓ </Text>
          <Text dimColor>{formatBytes(new TextEncoder().encode(result).length)}</Text>
        </Box>
      )}

      {/* Result for other tools */}
      {result && !isFileWrite && !isFileEdit && !isFetch && !isSearch && (
        <Box paddingLeft={4}>
          <Text color={isError ? 'red' : 'green'}>
            {isError ? '✗ ' : '✓ '}
          </Text>
          <Text wrap="truncate" color={isError ? 'red' : undefined} dimColor={!isError}>
            {formatToolResult(result, name)}
          </Text>
        </Box>
      )}
    </Box>
  );
}
