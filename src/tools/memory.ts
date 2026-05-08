/**
 * Memory Tools - Persistent memories across sessions
 * Pairs with core/memory.ts (this file: tool definitions; core/memory.ts: storage impl)
 */

import type { ToolHandler } from './registry.js';
import { saveMemory, readMemory, listMemories, deleteMemory } from '../core/memory.js';

const VALID_TYPES = ['user', 'feedback', 'project', 'reference'] as const;
type MemoryType = (typeof VALID_TYPES)[number];

export const memoryTools: ToolHandler[] = [
  {
    definition: {
      type: 'function',
      function: {
        name: 'memory_save',
        description: 'Save a persistent memory across sessions (user preferences, project context, feedback, references).',
        parameters: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Short name for the memory (e.g., "user_role", "feedback_testing", "project_deadline")',
            },
            type: {
              type: 'string',
              enum: [...VALID_TYPES],
              description: 'Type: user/feedback/project/reference',
            },
            description: {
              type: 'string',
              description: 'One-line description for relevance matching',
            },
            content: {
              type: 'string',
              description: 'The memory content. For feedback/project types, include Why and How to apply.',
            },
          },
          required: ['name', 'type', 'description', 'content'],
        },
      },
    },
    execute: async (args: Record<string, unknown>): Promise<string> => {
      const name = args.name as string;
      const type = args.type as MemoryType;
      const description = args.description as string;
      const content = args.content as string;

      if (!VALID_TYPES.includes(type)) {
        return JSON.stringify({ error: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}` });
      }

      const result = saveMemory(name, description, type, content);
      return JSON.stringify(result);
    },
  },
  {
    definition: {
      type: 'function',
      function: {
        name: 'memory_read',
        description: 'Read a specific memory by name. Use this to recall previously saved information.',
        parameters: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Name of the memory to read',
            },
          },
          required: ['name'],
        },
      },
    },
    execute: async (args: Record<string, unknown>): Promise<string> => {
      const name = args.name as string;
      const entry = readMemory(name);
      if (!entry) {
        return JSON.stringify({ error: `Memory '${name}' not found` });
      }
      return JSON.stringify({
        name: entry.name,
        type: entry.type,
        description: entry.description,
        content: entry.content,
      });
    },
  },
  {
    definition: {
      type: 'function',
      function: {
        name: 'memory_list',
        description: 'List all saved memories for this project.',
        parameters: {
          type: 'object',
          properties: {},
        },
      },
    },
    execute: async (): Promise<string> => {
      const entries = listMemories();
      if (entries.length === 0) {
        return JSON.stringify({ memories: [], message: 'No memories saved yet' });
      }
      return JSON.stringify({
        memories: entries.map(e => ({
          name: e.name,
          type: e.type,
          description: e.description,
        })),
        count: entries.length,
      });
    },
  },
  {
    definition: {
      type: 'function',
      function: {
        name: 'memory_delete',
        description: 'Delete a memory by name. Use this to remove outdated or incorrect memories.',
        parameters: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Name of the memory to delete',
            },
          },
          required: ['name'],
        },
      },
    },
    execute: async (args: Record<string, unknown>): Promise<string> => {
      const name = args.name as string;
      const result = deleteMemory(name);
      return JSON.stringify(result);
    },
  },
];
