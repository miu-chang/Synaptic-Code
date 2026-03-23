/**
 * Agent Tools - Allow LLM to spawn sub-agents for task distribution
 * Sub-agents run in background and auto-report completion
 */
import { Agent } from '../core/agent.js';
const tracker = {
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
export function initAgentTools(client, model, tools, options) {
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
export function updateAgentModel(model) {
    tracker.model = model;
}
/**
 * Get current sub-agent statuses for UI
 */
export function getSubAgentStatuses() {
    return new Map(tracker.statuses);
}
/**
 * Get and clear completion queue (for injecting into LLM context)
 */
export function popCompletions() {
    const completions = [...tracker.completionQueue];
    tracker.completionQueue = [];
    return completions;
}
/**
 * Check if there are pending completions
 */
export function hasCompletions() {
    return tracker.completionQueue.length > 0;
}
/**
 * Get running agent count
 */
export function getRunningCount() {
    return tracker.runningAgents.size;
}
/**
 * Share data between agents
 */
export function shareContext(key, value, fromAgent) {
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
export function getSharedContext(key) {
    if (key) {
        const ctx = tracker.sharedContext.get(key);
        return ctx ? [ctx] : [];
    }
    return Array.from(tracker.sharedContext.values());
}
/**
 * Clear shared context
 */
export function clearSharedContext() {
    tracker.sharedContext.clear();
}
// Helper: Update status and notify
function updateStatus(id, update) {
    const current = tracker.statuses.get(id);
    if (current) {
        const updated = { ...current, ...update };
        tracker.statuses.set(id, updated);
        tracker.onStatusUpdate?.(tracker.statuses);
    }
}
// Helper: Format step as one-line status
function formatStepStatus(step) {
    if (step.toolName) {
        // Extract key info from tool call
        const toolInfo = step.toolName;
        const content = step.content.slice(0, 40);
        return `${toolInfo}: ${content}`;
    }
    return step.content.slice(0, 60);
}
// ============ Tool Definitions ============
const spawnAgentTool = {
    definition: {
        type: 'function',
        function: {
            name: 'spawn_agent',
            description: `Spawn a sub-agent to handle a task autonomously in the background.

The sub-agent runs independently and you'll be automatically notified when it completes.
NO NEED to call check_agent - completions are reported automatically.

Use cases:
- Parallel tasks: spawn agents for independent work
- Research: spawn agent to gather info while you continue
- Complex sub-tasks: delegate portions of the goal

Limits: Max ${tracker.maxConcurrent} concurrent agents. Sub-agents get 15 iterations max.`,
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
    async execute(args) {
        const agentId = args.agent_id;
        const goal = args.goal;
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
        // Create sub-agent with explicit sub-agent flag
        const subAgent = new Agent(tracker.client, tracker.model, tracker.tools, {
            maxIterations: 15,
            stopOnError: false,
            isSubAgent: true, // Enables stricter completion prompting
        });
        // Initialize status
        const status = {
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
        // Track steps in real-time
        subAgent.onStep((step, state) => {
            updateStatus(agentId, {
                currentStep: formatStepStatus(step),
                iterations: state.iterations,
                status: state.status,
            });
        });
        // Run async and handle completion
        subAgent.run(goal).then((finalState) => {
            tracker.runningAgents.delete(agentId);
            // Update final status
            updateStatus(agentId, {
                status: finalState.status,
                currentStep: finalState.status === 'completed'
                    ? '✓ Done'
                    : `✗ ${finalState.error?.slice(0, 30) || 'Failed'}`,
                result: finalState.result,
                error: finalState.error,
            });
            // Queue completion for LLM
            const completion = {
                agentId,
                status: finalState.status,
                result: finalState.result,
                error: finalState.error,
                iterations: finalState.iterations,
                elapsedMs: (finalState.completedAt || Date.now()) - finalState.startedAt,
            };
            tracker.completionQueue.push(completion);
            tracker.onCompletion?.(completion);
            // Clean up status after a delay
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
const cancelAgentTool = {
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
    async execute(args) {
        const agentId = args.agent_id;
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
const shareResultTool = {
    definition: {
        type: 'function',
        function: {
            name: 'share_result',
            description: `Share data/results with other agents. Use this to pass information between parallel agents.

Examples:
- share_result("api_docs", "The API uses REST with JSON...", "research-agent")
- share_result("file_list", "main.ts, utils.ts, config.ts", "scanner")

Other agents can read this with get_shared_results.`,
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
    async execute(args) {
        const key = args.key;
        const value = args.value;
        const fromAgent = args.from_agent || 'main';
        shareContext(key, value, fromAgent);
        return JSON.stringify({
            status: 'shared',
            key,
            from: fromAgent,
            size: value.length,
        });
    },
};
const getSharedResultsTool = {
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
    async execute(args) {
        const key = args.key;
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
export const agentTools = [
    spawnAgentTool,
    cancelAgentTool,
    shareResultTool,
    getSharedResultsTool,
];
//# sourceMappingURL=agent.js.map