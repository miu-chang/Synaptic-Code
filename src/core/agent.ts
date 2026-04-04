/**
 * Agent Mode - Autonomous task execution
 * Runs LLM in a loop to complete complex goals automatically.
 */

import type { LLMClient, Message, ToolCall } from '../llm/types.js';
import { getTextContent } from '../llm/types.js';
import type { ToolRegistry } from '../tools/registry.js';

// ============ Types ============

export interface AgentStep {
  id: number;
  type: 'thinking' | 'tool_call' | 'tool_result' | 'complete' | 'error';
  content: string;
  toolName?: string;
  toolArgs?: string;
  timestamp: number;
}

export interface AgentConfig {
  maxIterations: number;
  stopOnError: boolean;
  verbose: boolean;
  isSubAgent: boolean;
  appendSystemPrompt?: string;
}

export interface AgentState {
  goal: string;
  status: 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';
  steps: AgentStep[];
  iterations: number;
  startedAt: number;
  completedAt?: number;
  result?: string;
  error?: string;
}

export type AgentEventHandler = (step: AgentStep, state: AgentState) => void;

const DEFAULT_CONFIG: AgentConfig = {
  maxIterations: 30,
  stopOnError: false,
  verbose: true,
  isSubAgent: false,
};

// ============ Agent System Prompt ============

interface AgentPromptOptions {
  maxIterations?: number;
  isSubAgent?: boolean;
}

function getAgentSystemPrompt(
  goal: string,
  cwd: string,
  toolList: string[],
  options: AgentPromptOptions = {}
): string {
  const { maxIterations = 30, isSubAgent = false } = options;

  const subAgentNote = isSubAgent
    ? `\n\nIMPORTANT: You are a sub-agent with limited iterations (${maxIterations}). Work efficiently and output [DONE] as soon as the task is complete. Do not over-research.`
    : '';

  return `You are an autonomous AI agent. Your goal is to complete the following task:

<goal>
${goal}
</goal>

## Rules
1. Work step by step toward the goal
2. Use available tools to gather information and make changes
3. After each action, evaluate progress and decide next step
4. If you encounter an error, try alternative approaches
5. Keep responses concise - focus on actions, not explanations
6. You have a maximum of ${maxIterations} iterations - use them wisely

## CRITICAL: Completion
- When the goal is FULLY complete, you MUST respond with exactly: [DONE] followed by a brief summary
- If the goal is impossible or cannot be completed, respond with: [FAILED] followed by reason
- Do NOT continue working after the goal is achieved - output [DONE] immediately
${subAgentNote}

## Current Directory
${cwd}

## Available Tools (${toolList.length})
${toolList.slice(0, 30).join(', ')}${toolList.length > 30 ? '...' : ''}

Start working on the goal now. Remember to output [DONE] when finished.`;
}

// ============ Agent Class ============

export class Agent {
  private client: LLMClient;
  private model: string;
  private tools: ToolRegistry;
  private config: AgentConfig;
  private state: AgentState;
  private messages: Message[] = [];
  private eventHandler?: AgentEventHandler;
  private cancelled = false;

  constructor(
    client: LLMClient,
    model: string,
    tools: ToolRegistry,
    config: Partial<AgentConfig> = {}
  ) {
    this.client = client;
    this.model = model;
    this.tools = tools;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = this.createInitialState('');
  }

  private createInitialState(goal: string): AgentState {
    return {
      goal,
      status: 'idle',
      steps: [],
      iterations: 0,
      startedAt: Date.now(),
    };
  }

  private addStep(step: Omit<AgentStep, 'id' | 'timestamp'>): AgentStep {
    const fullStep: AgentStep = {
      ...step,
      id: this.state.steps.length,
      timestamp: Date.now(),
    };
    this.state.steps.push(fullStep);

    if (this.eventHandler) {
      this.eventHandler(fullStep, this.state);
    }

    return fullStep;
  }

  /** Subscribe to step events */
  onStep(handler: AgentEventHandler): void {
    this.eventHandler = handler;
  }

  /** Get current state */
  getState(): AgentState {
    return { ...this.state };
  }

  /** Cancel running agent */
  cancel(): void {
    this.cancelled = true;
    if (this.state.status === 'running') {
      this.state.status = 'cancelled';
      this.addStep({ type: 'error', content: 'Cancelled by user' });
    }
  }

  /** Run agent to complete goal */
  async run(goal: string): Promise<AgentState> {
    this.state = this.createInitialState(goal);
    this.state.status = 'running';
    this.cancelled = false;

    const toolList = this.tools.list();

    // Initialize conversation
    let systemPrompt = getAgentSystemPrompt(goal, process.cwd(), toolList, {
      maxIterations: this.config.maxIterations,
      isSubAgent: this.config.isSubAgent,
    });

    // Append additional system prompt if provided
    if (this.config.appendSystemPrompt) {
      systemPrompt = `${systemPrompt}\n\n${this.config.appendSystemPrompt}`;
    }

    this.messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Goal: ${goal}\n\nStart now. Remember: output [DONE] when complete.` },
    ];

    this.addStep({ type: 'thinking', content: `Goal: ${goal}` });

    try {
      while (this.state.iterations < this.config.maxIterations) {
        if (this.cancelled) break;

        this.state.iterations++;

        // Call LLM
        const response = await this.client.chat({
          model: this.model,
          messages: this.messages,
          tools: this.tools.getDefinitions(),
          tool_choice: 'auto',
        });

        const assistantMessage = response.choices[0]?.message;
        if (!assistantMessage) {
          this.state.status = 'failed';
          this.state.error = 'No response from LLM';
          break;
        }

        this.messages.push(assistantMessage);
        const content = getTextContent(assistantMessage.content || '');

        // Check for completion
        if (content.includes('[DONE]')) {
          this.state.status = 'completed';
          this.state.result = content.replace('[DONE]', '').trim();
          this.addStep({ type: 'complete', content: this.state.result || 'Task completed' });
          break;
        }

        if (content.includes('[FAILED]')) {
          this.state.status = 'failed';
          this.state.error = content.replace('[FAILED]', '').trim();
          this.addStep({ type: 'error', content: this.state.error });
          break;
        }

        // No tool calls = thinking/intermediate response
        if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
          if (content) {
            this.addStep({ type: 'thinking', content: content.slice(0, 300) });
          }
          // Ask LLM to continue
          this.messages.push({ role: 'user', content: 'Continue working on the goal.' });
          continue;
        }

        // Execute tool calls
        for (const tc of assistantMessage.tool_calls) {
          if (this.cancelled) break;

          const toolName = tc.function.name;
          const toolArgs = tc.function.arguments;

          this.addStep({
            type: 'tool_call',
            content: toolName,
            toolName,
            toolArgs,
          });

          try {
            const result = await this.tools.execute(tc);

            this.messages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: result,
            });

            const isError = result.toLowerCase().includes('"error"');
            this.addStep({
              type: 'tool_result',
              content: result.slice(0, 200) + (result.length > 200 ? '...' : ''),
              toolName,
            });

            if (isError && this.config.stopOnError) {
              this.state.status = 'failed';
              this.state.error = `Tool error: ${result}`;
              break;
            }
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);

            this.messages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: JSON.stringify({ error: errorMsg }),
            });

            this.addStep({ type: 'error', content: errorMsg, toolName });

            if (this.config.stopOnError) {
              this.state.status = 'failed';
              this.state.error = errorMsg;
              break;
            }
          }
        }

        if (this.state.status !== 'running') break;
      }

      // Max iterations reached
      if (this.state.status === 'running') {
        this.state.status = 'failed';
        this.state.error = `Max iterations (${this.config.maxIterations}) reached`;
        this.addStep({ type: 'error', content: this.state.error });
      }

    } catch (error) {
      this.state.status = 'failed';
      this.state.error = error instanceof Error ? error.message : String(error);
      this.addStep({ type: 'error', content: this.state.error });
    }

    this.state.completedAt = Date.now();
    return this.state;
  }
}
