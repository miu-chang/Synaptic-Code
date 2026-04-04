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
      description: `List available Blender tools by category. Main categories:
- Object: Create/delete/transform objects
- Mesh: Edit vertices, edges, faces
- MeshCleanup/MeshAnalysis: Clean geometry, analyze topology
- Transform: Move, rotate, scale
- Modifiers: Subdivision, mirror, etc.
- Materials: PBR materials setup
- Texture/TextureMat: Texture operations
- UV: UV mapping, unwrap
- Armature: Bones, rigging
- WeightPainting/WeightFeedback: Vertex weights
- Animation/AnimationExt/AnimationFeedback: Keyframes, NLA
- ShapeKeys: Blend shapes
- Camera: Camera setup
- Lighting: Lights, HDRI
- Rendering: Render settings
- Scene: Scene management
- Batch: Batch operations
- ImportExport: FBX, OBJ, GLTF
- VRMExport: VRM export
- AvatarEdit/BodyMod: Avatar editing
- ClothingFitting: Clothing transfer
- AccessoryHair: Hair accessories
- Baking/AuxiliaryMaps: Texture baking
- GameDev: Game development tools
- Procedural: Procedural generation
- RiggingFeedback: Rigging analysis
- SmartOperations: Smart auto tools
- StateDiff/Inspection: State comparison
- VisualFeedback/CustomView: Visual helpers
- WorkflowGuide/RegionFocus: Workflow assistance
Use category parameter for full tool schemas.`,
      parameters: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            description: 'Category name (e.g., "Mesh", "Materials", "Animation"). Use exact category name.',
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
      // Handle "all" category - fetch from all categories
      if (category.toLowerCase() === 'all') {
        const categories = await client.getCategories('blender');
        const allTools: Array<{ name: string; description: string; category: string }> = [];
        for (const cat of categories) {
          const tools = await client.getToolsByCategory('blender', cat.name);
          for (const t of tools) {
            allTools.push({ name: t.name, description: t.description, category: cat.name });
          }
        }
        return JSON.stringify({ category: 'all', tools: allTools, count: allTools.length });
      }

      const tools = await client.getToolsByCategory('blender', category);
      // Include full tool info with inputSchema for LLM to understand parameters
      const toolsWithSchema = tools.map(t => ({
        name: t.name,
        description: t.description,
        parameters: t.inputSchema?.properties
          ? Object.entries(t.inputSchema.properties).map(([k, v]) => ({
              name: k,
              ...(v as Record<string, unknown>),
              required: t.inputSchema?.required?.includes(k) ?? false,
            }))
          : [],
      }));
      return JSON.stringify({ category, tools: toolsWithSchema, count: tools.length });
    } else {
      const categories = await client.getCategories('blender');
      return JSON.stringify({
        categories,
        total: categories.length,
        hint: 'Call blender_list_tools with a category name to see tools and their parameters',
      });
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
      description: `List available Unity tools by category. Main categories:
- GameObject: Create/delete GameObjects, prefabs, components
- Transform: Position, rotation, scale
- Scene: Scene management, hierarchy
- Camera/Cinemachine: Cameras, virtual cameras, dolly
- Animation/Timeline: Animator, clips, timeline
- Physics: Rigidbody, colliders, raycasts
- Material/Shader: Materials, shaders
- Lighting: Lights, shadows, GI
- Audio: AudioSource, mixer
- UI: Canvas, buttons, text
- VFX: Particle systems, effects
- AI/GOAP/GameSystems: AI behaviors, GOAP
- Scripting: C# scripts
- Build: Build settings
- Debug/Monitoring: Console logs, performance
- AssetManagement: Asset operations
- Input: Input system setup
- Optimization: Performance tools
- Screenshot: Capture screenshots
- Weather/TimeOfDay: Weather, day-night
- Editor: Editor utilities
- Package: Package manager
- Batch: Batch operations
- Utility/Other: Misc utilities
Use category parameter for full tool schemas.`,
      parameters: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            description: 'Category name (e.g., "GameObject", "Animation", "VFX"). Use exact category name.',
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
      // Handle "all" category - fetch from all categories
      if (category.toLowerCase() === 'all') {
        const categories = await client.getCategories('unity');
        const allTools: Array<{ name: string; description: string; category: string }> = [];
        for (const cat of categories) {
          const tools = await client.getToolsByCategory('unity', cat.name);
          for (const t of tools) {
            allTools.push({ name: t.name, description: t.description, category: cat.name });
          }
        }
        return JSON.stringify({ category: 'all', tools: allTools, count: allTools.length });
      }

      const tools = await client.getToolsByCategory('unity', category);
      // Include full tool info with inputSchema for LLM to understand parameters
      const toolsWithSchema = tools.map(t => ({
        name: t.name,
        description: t.description,
        parameters: t.inputSchema?.properties
          ? Object.entries(t.inputSchema.properties).map(([k, v]) => ({
              name: k,
              ...(v as Record<string, unknown>),
              required: t.inputSchema?.required?.includes(k) ?? false,
            }))
          : [],
      }));
      return JSON.stringify({ category, tools: toolsWithSchema, count: tools.length });
    } else {
      const categories = await client.getCategories('unity');
      return JSON.stringify({
        categories,
        total: categories.length,
        hint: 'Call unity_list_tools with a category name to see tools and their parameters',
      });
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
