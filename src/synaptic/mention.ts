/**
 * @mention Parser for Synaptic Ecosystem
 * --------------------------------------
 * Parses @blender and @unity mentions in user input.
 * Supports pipe chains for sequential tool execution.
 *
 * Examples:
 *   @blender create_cube name=MyCube
 *   @unity unity_create_gameobject name=Player type=capsule
 *   @blender export_fbx path=/tmp/model.fbx
 *
 * Pipe chains (pass previous result to next tool):
 *   @unity unity_create_gameobject name=Cube type=cube | unity_set_transform position={0,5,0}
 *   @blender create_cube | set_material name=Red | export_fbx path=/tmp/out.fbx
 */

import * as client from './client.js';

export interface MentionCommand {
  server: 'blender' | 'unity';
  tool: string;
  params: Record<string, string>;
  raw: string;
  /** If true, this command receives output from previous command in chain */
  isPiped?: boolean;
}

export interface ParseResult {
  hasMention: boolean;
  commands: MentionCommand[];
  textWithoutMentions: string;
}

/**
 * Parse a single tool call (tool_name key=value ...)
 */
function parseToolCall(
  toolStr: string,
  server: 'blender' | 'unity',
  isPiped: boolean
): MentionCommand {
  const parts = toolStr.trim().split(/\s+/);
  const tool = parts[0];
  const paramsStr = parts.slice(1).join(' ');

  const params: Record<string, string> = {};
  if (paramsStr) {
    // Match key=value or key="value with spaces" or key={json}
    const paramRegex = /(\w+)=(?:"([^"]+)"|'([^']+)'|\{([^}]+)\}|(\S+))/g;
    let paramMatch;
    while ((paramMatch = paramRegex.exec(paramsStr)) !== null) {
      const [, key, quotedDouble, quotedSingle, braced, unquoted] = paramMatch;
      params[key] = quotedDouble || quotedSingle || (braced ? `{${braced}}` : '') || unquoted;
    }
  }

  return {
    server,
    tool,
    params,
    raw: toolStr.trim(),
    isPiped,
  };
}

/**
 * Parse @mentions from input text (supports pipe chains)
 */
export function parseMentions(input: string): ParseResult {
  const commands: MentionCommand[] = [];
  let textWithoutMentions = input;

  // Match @blender or @unity followed by tool chain (may include pipes)
  // Pattern: @(blender|unity) tool1 params | tool2 params | ...
  const mentionRegex = /@(blender|unity)\s+(.+?)(?=@(?:blender|unity)\s|\s*$)/gi;

  let match;
  while ((match = mentionRegex.exec(input)) !== null) {
    const [fullMatch, serverType, toolChain] = match;
    const server = serverType.toLowerCase() as 'blender' | 'unity';

    // Split by pipe, but not pipes inside quotes or braces
    const pipeSegments = toolChain.split(/\s*\|\s*/);

    pipeSegments.forEach((segment, index) => {
      const trimmed = segment.trim();
      if (trimmed) {
        commands.push(parseToolCall(trimmed, server, index > 0));
      }
    });

    textWithoutMentions = textWithoutMentions.replace(fullMatch, '').trim();
  }

  return {
    hasMention: commands.length > 0,
    commands,
    textWithoutMentions,
  };
}

/**
 * Check if input starts with @blender or @unity
 */
export function hasMention(input: string): boolean {
  return /^@(blender|unity)\s/i.test(input.trim());
}

/**
 * Execute a single mention command
 */
export async function executeMention(command: MentionCommand): Promise<client.ExecuteResult> {
  // Check if server is connected
  if (!client.isServerConnected(command.server)) {
    return {
      success: false,
      error: `${command.server} is not connected. Run server discovery first.`,
      server: command.server,
    };
  }

  return client.execute(command.server, command.tool, command.params);
}

/**
 * Execute all mentions in input (supports pipe chains)
 * For piped commands, the previous result is passed as context
 */
export async function executeAllMentions(input: string): Promise<{
  results: Array<{ command: MentionCommand; result: client.ExecuteResult }>;
  remainingText: string;
}> {
  const parsed = parseMentions(input);
  const results: Array<{ command: MentionCommand; result: client.ExecuteResult }> = [];

  let previousResult: client.ExecuteResult | null = null;

  for (const command of parsed.commands) {
    // If this is a piped command, inject previous result into params
    if (command.isPiped && previousResult?.success && previousResult.result) {
      const prev = previousResult.result as Record<string, unknown>;

      // Auto-inject common fields from previous result
      // e.g., created object name -> target for next command
      if (prev.name && !command.params.name && !command.params.gameObject && !command.params.target) {
        command.params.gameObject = String(prev.name);
      }
      if (prev.gameObject && !command.params.gameObject && !command.params.target) {
        command.params.gameObject = String(prev.gameObject);
      }
      if (prev.object_name && !command.params.name && !command.params.target) {
        command.params.name = String(prev.object_name);
      }

      // Store full previous result for tools that need it
      command.params._previousResult = JSON.stringify(prev);
    }

    const result = await executeMention(command);
    results.push({ command, result });

    // Store for next piped command
    previousResult = result;

    // If a piped command fails, stop the chain
    if (command.isPiped && !result.success) {
      break;
    }
  }

  return {
    results,
    remainingText: parsed.textWithoutMentions,
  };
}

/**
 * Format execution result for display
 */
export function formatResult(command: MentionCommand, result: client.ExecuteResult): string {
  const prefix = result.success ? '✓' : '✗';
  const pipeIndicator = command.isPiped ? '  ↳ ' : '';
  const serverTag = command.isPiped ? '' : `@${command.server} `;

  if (result.success) {
    const resultStr = typeof result.result === 'object'
      ? JSON.stringify(result.result, null, 2)
      : String(result.result);
    return `${pipeIndicator}${prefix} ${serverTag}${command.tool}\n${resultStr}`;
  } else {
    return `${pipeIndicator}${prefix} ${serverTag}${command.tool} - Error: ${result.error}`;
  }
}

/**
 * Get autocomplete suggestions for @mentions
 */
export function getAutocompleteSuggestions(
  partial: string
): Array<{ text: string; description: string }> {
  const suggestions: Array<{ text: string; description: string }> = [];

  // If just typed @, suggest servers
  if (partial === '@' || partial === '') {
    if (client.isServerConnected('blender')) {
      suggestions.push({ text: '@blender ', description: 'Blender tools' });
    }
    if (client.isServerConnected('unity')) {
      suggestions.push({ text: '@unity ', description: 'Unity tools' });
    }
    return suggestions;
  }

  // If typed @b or @u, complete server name
  if (partial.match(/^@b/i) && client.isServerConnected('blender')) {
    suggestions.push({ text: '@blender ', description: 'Blender tools' });
  }
  if (partial.match(/^@u/i) && client.isServerConnected('unity')) {
    suggestions.push({ text: '@unity ', description: 'Unity tools' });
  }

  // If typed @blender or @unity + partial tool name, suggest tools
  const toolMatch = partial.match(/^@(blender|unity)\s+(\S*)$/i);
  if (toolMatch) {
    const [, server, partialTool] = toolMatch;
    const serverType = server.toLowerCase() as 'blender' | 'unity';
    const serverInfo = client.getServer(serverType);

    if (serverInfo?.tools) {
      const matchingTools = serverInfo.tools
        .filter(t => t.toLowerCase().startsWith(partialTool.toLowerCase()))
        .slice(0, 10);

      for (const tool of matchingTools) {
        suggestions.push({
          text: `@${serverType} ${tool} `,
          description: tool,
        });
      }
    }
  }

  return suggestions;
}
