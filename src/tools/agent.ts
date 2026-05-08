/**
 * Agent Tools - Allow LLM to spawn sub-agents for task distribution
 * Sub-agents run in background and auto-report completion
 */

import type { ToolHandler, ToolRegistry } from './registry.js';
import type { LLMClient } from '../llm/types.js';
import { Agent, type AgentState, type AgentStep } from '../core/agent.js';

// Sub-agent status for UI display
export interface SubAgentStatus {
  id: string;
  goal: string;
  status: AgentState['status'];
  currentStep: string;
  iterations: number;
  startedAt: number;
  result?: string;
  error?: string;
}

// Completion notification for LLM
export interface AgentCompletion {
  agentId: string;
  status: 'completed' | 'failed' | 'cancelled';
  result?: string;
  error?: string;
  iterations: number;
  elapsedMs: number;
}

// Shared context for agent communication
export interface SharedContext {
  key: string;
  value: string;
  fromAgent: string;
  timestamp: number;
}

// Store for tracking sub-agents
interface SubAgentTracker {
  client: LLMClient | null;
  model: string;
  tools: ToolRegistry | null;
  maxConcurrent: number;
  runningAgents: Map<string, Agent>;
  statuses: Map<string, SubAgentStatus>;
  completionQueue: AgentCompletion[];
  sharedContext: Map<string, SharedContext>;
  onStatusUpdate?: (statuses: Map<string, SubAgentStatus>) => void;
  onCompletion?: (completion: AgentCompletion) => void;
}

const tracker: SubAgentTracker = {
  client: null,
  model: '',
  tools: null,
  maxConcurrent: 3,
  runningAgents: new Map(),
  statuses: new Map(),
  completionQueue: [],
  sharedContext: new Map(),
};

/**
 * Initialize the agent tools with required dependencies
 */
export function initAgentTools(
  client: LLMClient,
  model: string,
  tools: ToolRegistry,
  options?: {
    maxConcurrent?: number;
    onStatusUpdate?: (statuses: Map<string, SubAgentStatus>) => void;
    onCompletion?: (completion: AgentCompletion) => void;
  }
): void {
  tracker.client = client;
  tracker.model = model;
  tracker.tools = tools;
  tracker.maxConcurrent = options?.maxConcurrent ?? 3;
  tracker.onStatusUpdate = options?.onStatusUpdate;
  tracker.onCompletion = options?.onCompletion;
}

/**
 * Update model (when user changes model)
 */
export function updateAgentModel(model: string): void {
  tracker.model = model;
}

/**
 * Get current sub-agent statuses for UI
 */
export function getSubAgentStatuses(): Map<string, SubAgentStatus> {
  return new Map(tracker.statuses);
}

/**
 * Pop pending completions (consumed by UI on poll)
 */
export function popCompletions(): AgentCompletion[] {
  return tracker.completionQueue.splice(0, tracker.completionQueue.length);
}

/**
 * Share data between agents
 */
export function shareContext(key: string, value: string, fromAgent: string): void {
  tracker.sharedContext.set(key, {
    key,
    value,
    fromAgent,
    timestamp: Date.now(),
  });
}

/**
 * Get shared context
 */
export function getSharedContext(key?: string): SharedContext[] {
  if (key) {
    const ctx = tracker.sharedContext.get(key);
    return ctx ? [ctx] : [];
  }
  return Array.from(tracker.sharedContext.values());
}

// Helper: Update status and notify
function updateStatus(id: string, update: Partial<SubAgentStatus>): void {
  const current = tracker.statuses.get(id);
  if (current) {
    const updated = { ...current, ...update };
    tracker.statuses.set(id, updated);
    tracker.onStatusUpdate?.(tracker.statuses);
  }
}

// Helper: Format step as one-line status
function formatStepStatus(step: AgentStep): string {
  if (step.toolName) {
    const toolInfo = step.toolName;
    const content = step.content.slice(0, 40);
    return `${toolInfo}: ${content}`;
  }
  return step.content.slice(0, 60);
}

// ============ Tool Definitions ============

const spawnAgentTool: ToolHandler = {
  definition: {
    type: 'function',
    function: {
      name: 'spawn_agent',
      description: `Spawn a sub-agent for autonomous background work. Auto-notifies on completion. Max ${tracker.maxConcurrent} concurrent, 15 iterations each.`,
      parameters: {
        type: 'object',
        properties: {
          agent_id: {
            type: 'string',
            description: 'Unique ID for this agent (e.g., "research", "build-ui")',
          },
          goal: {
            type: 'string',
            description: 'The specific goal for this sub-agent',
          },
        },
        required: ['agent_id', 'goal'],
      },
    },
  },

  async execute(args: Record<string, unknown>): Promise<string> {
    const agentId = args.agent_id as string;
    const goal = args.goal as string;

    if (!tracker.client || !tracker.tools) {
      return JSON.stringify({ error: 'Agent tools not initialized' });
    }

    if (tracker.runningAgents.has(agentId)) {
      return JSON.stringify({ error: `Agent "${agentId}" is already running` });
    }

    if (tracker.runningAgents.size >= tracker.maxConcurrent) {
      return JSON.stringify({
        error: `Max concurrent agents (${tracker.maxConcurrent}) reached. Wait for one to complete.`,
        running: Array.from(tracker.statuses.keys()),
      });
    }

    const subAgent = new Agent(tracker.client, tracker.model, tracker.tools, {
      maxIterations: 15,
      stopOnError: false,
      isSubAgent: true,
    });

    const status: SubAgentStatus = {
      id: agentId,
      goal,
      status: 'running',
      currentStep: 'Starting...',
      iterations: 0,
      startedAt: Date.now(),
    };
    tracker.statuses.set(agentId, status);
    tracker.runningAgents.set(agentId, subAgent);
    tracker.onStatusUpdate?.(tracker.statuses);

    subAgent.onStep((step, state) => {
      updateStatus(agentId, {
        currentStep: formatStepStatus(step),
        iterations: state.iterations,
        status: state.status,
      });
    });

    subAgent.run(goal).then((finalState) => {
      tracker.runningAgents.delete(agentId);

      updateStatus(agentId, {
        status: finalState.status,
        currentStep: finalState.status === 'completed'
          ? '✓ Done'
          : `✗ ${finalState.error?.slice(0, 30) || 'Failed'}`,
        result: finalState.result,
        error: finalState.error,
      });

      const completion: AgentCompletion = {
        agentId,
        status: finalState.status as 'completed' | 'failed' | 'cancelled',
        result: finalState.result,
        error: finalState.error,
        iterations: finalState.iterations,
        elapsedMs: (finalState.completedAt || Date.now()) - finalState.startedAt,
      };
      tracker.completionQueue.push(completion);
      tracker.onCompletion?.(completion);

      setTimeout(() => {
        tracker.statuses.delete(agentId);
        tracker.onStatusUpdate?.(tracker.statuses);
      }, 5000);
    });

    return JSON.stringify({
      status: 'spawned',
      agent_id: agentId,
      goal: goal.slice(0, 100),
      message: 'Agent started. You will be notified when it completes.',
    });
  },
};

const cancelAgentTool: ToolHandler = {
  definition: {
    type: 'function',
    function: {
      name: 'cancel_agent',
      description: 'Cancel a running sub-agent.',
      parameters: {
        type: 'object',
        properties: {
          agent_id: {
            type: 'string',
            description: 'The ID of the sub-agent to cancel',
          },
        },
        required: ['agent_id'],
      },
    },
  },

  async execute(args: Record<string, unknown>): Promise<string> {
    const agentId = args.agent_id as string;

    const agent = tracker.runningAgents.get(agentId);
    if (!agent) {
      return JSON.stringify({ error: `No running agent "${agentId}"` });
    }

    agent.cancel();

    return JSON.stringify({
      status: 'cancelled',
      agent_id: agentId,
    });
  },
};

const shareResultTool: ToolHandler = {
  definition: {
    type: 'function',
    function: {
      name: 'share_result',
      description: 'Share data between parallel agents. Other agents read with get_shared_results.',
      parameters: {
        type: 'object',
        properties: {
          key: {
            type: 'string',
            description: 'Unique key for this data (e.g., "api_docs", "file_list")',
          },
          value: {
            type: 'string',
            description: 'The data/result to share',
          },
          from_agent: {
            type: 'string',
            description: 'Your agent ID (for attribution)',
          },
        },
        required: ['key', 'value'],
      },
    },
  },

  async execute(args: Record<string, unknown>): Promise<string> {
    const key = args.key as string;
    const value = args.value as string;
    const fromAgent = (args.from_agent as string) || 'main';

    shareContext(key, value, fromAgent);

    return JSON.stringify({
      status: 'shared',
      key,
      from: fromAgent,
      size: value.length,
    });
  },
};

const getSharedResultsTool: ToolHandler = {
  definition: {
    type: 'function',
    function: {
      name: 'get_shared_results',
      description: 'Get results shared by other agents. Call without key to get all shared data.',
      parameters: {
        type: 'object',
        properties: {
          key: {
            type: 'string',
            description: 'Optional: specific key to retrieve. Omit to get all.',
          },
        },
      },
    },
  },

  async execute(args: Record<string, unknown>): Promise<string> {
    const key = args.key as string | undefined;
    const results = getSharedContext(key);

    if (results.length === 0) {
      return JSON.stringify({
        status: 'empty',
        message: key ? `No shared data with key "${key}"` : 'No shared data available',
      });
    }

    return JSON.stringify({
      status: 'found',
      count: results.length,
      results: results.map(r => ({
        key: r.key,
        value: r.value.slice(0, 500) + (r.value.length > 500 ? '...' : ''),
        from: r.fromAgent,
        age_ms: Date.now() - r.timestamp,
      })),
    });
  },
};

// Export tools
export const agentTools: ToolHandler[] = [
  spawnAgentTool,
  cancelAgentTool,
  shareResultTool,
  getSharedResultsTool,
];
