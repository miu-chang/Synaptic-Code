/**
 * Synaptic Ecosystem Integration
 * ==============================
 * Connects Synaptic Code CLI to Blender and Unity.
 */

export * from './client.js';
export * from './mention.js';
export * from './tools.js';
export * from './history.js';

import * as client from './client.js';
import * as mention from './mention.js';
import { getSynapticTools } from './tools.js';

import type { ToolHandler } from '../tools/registry.js';

/**
 * Initialize Synaptic ecosystem connection
 * Call this on CLI startup
 */
export async function initSynaptic(): Promise<{
  blender: boolean;
  unity: boolean;
  toolCount: number;
  message: string;
  tools: ToolHandler[];
}> {
  const { servers, toolCount } = await client.init();

  const blenderConnected = servers.some(s => s.type === 'blender');
  const unityConnected = servers.some(s => s.type === 'unity');

  let message = '';
  if (blenderConnected && unityConnected) {
    message = `Synaptic: Blender + Unity connected (${toolCount} tools)`;
  } else if (blenderConnected) {
    message = `Synaptic: Blender connected (${toolCount} tools)`;
  } else if (unityConnected) {
    message = `Synaptic: Unity connected (${toolCount} tools)`;
  } else {
    message = 'Synaptic: No servers detected';
  }

  // Get LLM tools for connected servers
  const tools = getSynapticTools();

  return {
    blender: blenderConnected,
    unity: unityConnected,
    toolCount,
    message,
    tools,
  };
}

/**
 * Process user input for @mentions
 * Returns execution results if mentions found
 */
export async function processMentions(input: string): Promise<{
  handled: boolean;
  results?: Array<{ command: mention.MentionCommand; result: client.ExecuteResult }>;
  remainingText: string;
  formatted?: string;
}> {
  if (!mention.hasMention(input)) {
    return { handled: false, remainingText: input };
  }

  const { results, remainingText } = await mention.executeAllMentions(input);

  // Format results for display
  const formatted = results
    .map(({ command, result }) => mention.formatResult(command, result))
    .join('\n\n');

  return {
    handled: true,
    results,
    remainingText,
    formatted,
  };
}

/**
 * Get ecosystem status for display
 */
export function getEcosystemStatus(): string {
  const status = client.getStatus();
  const parts: string[] = [];

  if (status.blender) {
    parts.push(`Blender:${status.blender.port} (${status.blender.toolCount} tools)`);
  }
  if (status.unity) {
    parts.push(`Unity:${status.unity.port} (${status.unity.toolCount} tools)`);
  }

  if (parts.length === 0) {
    return 'Synaptic: disconnected';
  }

  return `Synaptic: ${parts.join(' | ')}`;
}
