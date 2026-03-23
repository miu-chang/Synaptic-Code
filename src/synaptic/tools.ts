/**
 * Synaptic Tools for LLM
 * ----------------------
 * Dynamically registers Blender/Unity tools based on connection status.
 */

import * as client from './client.js';
import * as history from './history.js';
import type { ToolHandler } from '../tools/registry.js';

/**
 * Create a tool handler for executing Synaptic tools
 */
function createSynapticToolHandler(
  server: 'blender' | 'unity',
  toolName: string,
  description: string,
  inputSchema: { type: 'object'; properties: Record<string, unknown>; required?: string[] }
): ToolHandler {
  return {
    definition: {
      type: 'function',
      function: {
        name: toolName,
        description: `[${server.toUpperCase()}] ${description}`,
        parameters: inputSchema,
      },
    },
    async execute(args) {
      const result = await client.execute(server, toolName, args as Record<string, unknown>);
      if (result.success) {
        return JSON.stringify({ success: true, result: result.result });
      } else {
        return JSON.stringify({ error: result.error });
      }
    },
  };
}

/**
 * Meta-tool: Execute any Blender tool by name
 */
export const blenderExecuteTool: ToolHandler = {
  definition: {
    type: 'function',
    function: {
      name: 'blender_execute',
      description: 'Execute a Blender tool. Use this to control Blender - create objects, modify scenes, render, etc. Call blender_list_tools first to see available tools.',
      parameters: {
        type: 'object',
        properties: {
          tool: {
            type: 'string',
            description: 'The Blender tool name to execute (e.g., "create_cube", "set_location")',
          },
          params: {
            type: 'object',
            description: 'Parameters to pass to the tool',
            additionalProperties: true,
          },
        },
        required: ['tool'],
      },
    },
  },
  async execute(args) {
    const { tool, params = {} } = args as { tool: string; params?: Record<string, unknown> };

    if (!client.isServerConnected('blender')) {
      return JSON.stringify({ error: 'Blender is not connected' });
    }

    const result = await client.execute('blender', tool, params);
    if (result.success) {
      return JSON.stringify({ success: true, result: result.result });
    } else {
      return JSON.stringify({ error: result.error });
    }
  },
};

/**
 * Meta-tool: Execute any Unity tool by name
 */
export const unityExecuteTool: ToolHandler = {
  definition: {
    type: 'function',
    function: {
      name: 'unity_execute',
      description: `Execute a Unity tool. Common tools:
- unity_create_gameobject: Create objects. params: {name: string, type: "cube"|"sphere"|"cylinder"|"plane"|"capsule"|"empty", position?: {x,y,z}}
- unity_delete_gameobject: Delete object. params: {name: string}
- unity_set_transform: Move/rotate/scale. params: {gameObject: string, position?: {x,y,z}, rotation?: {x,y,z}, scale?: {x,y,z}}
- unity_get_scene_summary: Get scene info (lightweight)
- unity_get_gameobject_detail: Get object details. params: {nameOrId: string}
Call unity_list_tools for full list.`,
      parameters: {
        type: 'object',
        properties: {
          tool: {
            type: 'string',
            description: 'Tool name (e.g., "unity_create_gameobject")',
          },
          params: {
            type: 'object',
            description: 'Tool parameters',
            additionalProperties: true,
          },
        },
        required: ['tool'],
      },
    },
  },
  async execute(args) {
    const { tool, params = {} } = args as { tool: string; params?: Record<string, unknown> };

    if (!client.isServerConnected('unity')) {
      return JSON.stringify({ error: 'Unity is not connected' });
    }

    const result = await client.execute('unity', tool, params);
    if (result.success) {
      return JSON.stringify({ success: true, result: result.result });
    } else {
      return JSON.stringify({ error: result.error });
    }
  },
};

/**
 * Tool to list available Blender tools/categories
 */
export const blenderListToolsTool: ToolHandler = {
  definition: {
    type: 'function',
    function: {
      name: 'blender_list_tools',
      description: 'List available Blender tools. Use category parameter to filter, or leave empty to see all categories.',
      parameters: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            description: 'Optional: filter by category name',
          },
        },
      },
    },
  },
  async execute(args) {
    const { category } = args as { category?: string };

    if (!client.isServerConnected('blender')) {
      return JSON.stringify({ error: 'Blender is not connected' });
    }

    if (category) {
      const tools = await client.getToolsByCategory('blender', category);
      return JSON.stringify({ category, tools, count: tools.length });
    } else {
      const categories = await client.getCategories('blender');
      return JSON.stringify({ categories, total: categories.length });
    }
  },
};

/**
 * Tool to list available Unity tools/categories
 */
export const unityListToolsTool: ToolHandler = {
  definition: {
    type: 'function',
    function: {
      name: 'unity_list_tools',
      description: 'List available Unity tools. Use category parameter to filter, or leave empty to see all categories.',
      parameters: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            description: 'Optional: filter by category name',
          },
        },
      },
    },
  },
  async execute(args) {
    const { category } = args as { category?: string };

    if (!client.isServerConnected('unity')) {
      return JSON.stringify({ error: 'Unity is not connected' });
    }

    if (category) {
      const tools = await client.getToolsByCategory('unity', category);
      return JSON.stringify({ category, tools, count: tools.length });
    } else {
      const categories = await client.getCategories('unity');
      return JSON.stringify({ categories, total: categories.length });
    }
  },
};

/**
 * Tool to get recent Synaptic execution history
 */
export const synapticHistoryTool: ToolHandler = {
  definition: {
    type: 'function',
    function: {
      name: 'synaptic_history',
      description: 'Get recent Blender/Unity operations. Use this to refer to "the object I just created", "what I did before", etc.',
      parameters: {
        type: 'object',
        properties: {
          count: {
            type: 'number',
            description: 'Number of recent operations to retrieve (default: 5)',
          },
        },
      },
    },
  },
  async execute(args) {
    const { count = 5 } = args as { count?: number };
    const recent = history.getRecentExecutions(count);

    if (recent.length === 0) {
      return JSON.stringify({ message: 'No recent Synaptic operations.' });
    }

    const summary = recent.map(r => ({
      id: r.id,
      server: r.server,
      tool: r.tool,
      summary: r.summary,
      createdObjects: r.createdObjects,
      success: r.success,
      secondsAgo: Math.round((Date.now() - r.timestamp) / 1000),
    }));

    return JSON.stringify({ recent: summary });
  },
};

/**
 * Tool to get console logs/errors from Unity/Blender
 */
export const synapticLogsTool: ToolHandler = {
  definition: {
    type: 'function',
    function: {
      name: 'synaptic_logs',
      description: 'Get console logs/errors from Unity or Blender. Use this to debug issues, check for errors, or see warnings.',
      parameters: {
        type: 'object',
        properties: {
          server: {
            type: 'string',
            enum: ['unity', 'blender'],
            description: 'Which server to get logs from',
          },
          logType: {
            type: 'string',
            enum: ['all', 'error', 'warning', 'log'],
            description: 'Filter by log type (default: error)',
          },
          limit: {
            type: 'number',
            description: 'Max number of logs to retrieve (default: 10)',
          },
        },
        required: ['server'],
      },
    },
  },
  async execute(args) {
    const { server, logType = 'error', limit = 10 } = args as {
      server: 'blender' | 'unity';
      logType?: string;
      limit?: number;
    };

    if (!client.isServerConnected(server)) {
      return JSON.stringify({ error: `${server} is not connected` });
    }

    // Unity uses unity_analyze_console_logs tool
    if (server === 'unity') {
      const result = await client.execute('unity', 'unity_analyze_console_logs', {
        logType,
        limit,
        includeStackTrace: true,
      });
      return JSON.stringify(result);
    }

    // Blender - get console logs
    if (server === 'blender') {
      const result = await client.execute('blender', 'get_console_logs', { limit });
      return JSON.stringify(result);
    }

    return JSON.stringify({ error: 'Unknown server' });
  },
};

/**
 * Get all Synaptic tools based on current connection status
 */
export function getSynapticTools(): ToolHandler[] {
  const tools: ToolHandler[] = [];

  // Always add history and logs tools if any server is connected
  if (client.isServerConnected('blender') || client.isServerConnected('unity')) {
    tools.push(synapticHistoryTool);
    tools.push(synapticLogsTool);
  }

  if (client.isServerConnected('blender')) {
    tools.push(blenderExecuteTool);
    tools.push(blenderListToolsTool);
  }

  if (client.isServerConnected('unity')) {
    tools.push(unityExecuteTool);
    tools.push(unityListToolsTool);
  }

  return tools;
}

/**
 * Check if any Synaptic server is connected
 */
export function hasSynapticConnection(): boolean {
  return client.isServerConnected('blender') || client.isServerConnected('unity');
}
