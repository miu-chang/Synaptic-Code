/**
 * Plan Mode - Claude Code style
 * Extracts plan from LLM response before executing tools
 */

import { resolve, relative } from 'path';
import type { ToolCall } from '../llm/types.js';

// Project root is set on startup
let projectRoot = process.cwd();

export function setProjectRoot(root: string): void {
  projectRoot = resolve(root);
}

export function getProjectRoot(): string {
  return projectRoot;
}

/**
 * Check if a path is outside the project root
 */
export function isOutsideProject(targetPath: string): boolean {
  if (!targetPath) return false;
  const resolved = resolve(targetPath);
  const rel = relative(projectRoot, resolved);
  // If relative path starts with ".." it's outside
  return rel.startsWith('..');
}

export interface PlanStep {
  id: number;
  action: string;
  tool?: string;
  toolArgs?: string;
  status: 'pending' | 'approved' | 'rejected' | 'executing' | 'completed';
  outsideProject?: boolean;  // Warning flag for outside-project access
}

export interface ExecutionPlan {
  steps: PlanStep[];
  reasoning?: string;
}

/**
 * Extract target path from tool arguments
 */
function extractTargetPath(toolName: string, argsJson: string): string | null {
  try {
    const args = JSON.parse(argsJson);
    // File operations
    if (['read_file', 'write_file', 'edit_file', 'create_file', 'delete_file'].includes(toolName)) {
      return args.path || null;
    }
    // Bash/shell - check cwd
    if (['bash', 'run_shell', 'bash_background'].includes(toolName)) {
      return args.cwd || null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Extract plan from tool calls
 * Converts tool_calls into human-readable plan steps
 */
export function extractPlanFromToolCalls(toolCalls: ToolCall[]): ExecutionPlan {
  const steps: PlanStep[] = toolCalls.map((tc, index) => {
    const toolName = tc.function.name;
    let action = formatToolAction(toolName, tc.function.arguments);

    // Check if target is outside project
    const targetPath = extractTargetPath(toolName, tc.function.arguments);
    const outsideProject = targetPath ? isOutsideProject(targetPath) : false;

    return {
      id: index + 1,
      action,
      tool: toolName,
      toolArgs: tc.function.arguments,
      status: 'pending' as const,
      outsideProject,
    };
  });

  return { steps };
}

/**
 * Format tool call into human-readable action
 */
function formatToolAction(toolName: string, argsJson: string): string {
  try {
    const args = JSON.parse(argsJson);

    // File operations
    if (toolName === 'read_file') {
      return `Read file: ${args.path}`;
    }
    if (toolName === 'write_file') {
      return `Write to: ${args.path}`;
    }
    if (toolName === 'edit_file') {
      return `Edit: ${args.path}`;
    }
    if (toolName === 'create_file') {
      return `Create: ${args.path}`;
    }
    if (toolName === 'delete_file') {
      return `Delete: ${args.path}`;
    }

    // Shell
    if (toolName === 'run_shell') {
      const cmd = args.command?.slice(0, 60) || '';
      return `Run: ${cmd}${args.command?.length > 60 ? '...' : ''}`;
    }

    // Search
    if (toolName === 'search_files') {
      return `Search for: "${args.pattern}" in ${args.path || '.'}`;
    }
    if (toolName === 'grep') {
      return `Grep: "${args.pattern}"`;
    }

    // Blender/Unity
    if (toolName.startsWith('blender_')) {
      return `Blender: ${toolName.replace('blender_', '')}`;
    }
    if (toolName.startsWith('unity_')) {
      return `Unity: ${toolName.replace('unity_', '')}`;
    }

    // TODO
    if (toolName === 'todo_add') {
      return `Add TODO: ${args.task?.slice(0, 40) || ''}`;
    }
    if (toolName === 'todo_complete') {
      return `Complete TODO #${args.id}`;
    }

    // Agent
    if (toolName === 'spawn_agent') {
      return `Spawn agent "${args.agent_id}": ${args.goal?.slice(0, 40) || ''}`;
    }

    // Default: show tool name with first arg
    const firstArg = Object.values(args)[0];
    const argPreview = typeof firstArg === 'string'
      ? firstArg.slice(0, 40)
      : JSON.stringify(firstArg).slice(0, 40);
    return `${toolName}: ${argPreview}`;

  } catch {
    return `${toolName}`;
  }
}

/**
 * Check if plan mode should be used for these tool calls
 * Returns true for potentially destructive or important operations
 */
export function shouldRequireApproval(toolCalls: ToolCall[]): boolean {
  const sensitiveTools = [
    'write_file',
    'edit_file',
    'create_file',
    'delete_file',
    'run_shell',
    'bash',
    'bash_background',
    'spawn_agent',
  ];

  return toolCalls.some(tc => sensitiveTools.includes(tc.function.name));
}
