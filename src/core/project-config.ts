/**
 * Project Configuration - Load SYNAPTIC.md for project-specific guidelines
 *
 * Similar to CLAUDE.md, this file contains project-specific instructions,
 * coding standards, and context that should be included in every conversation.
 *
 * Location: synaptic/SYNAPTIC.md in the project root
 *
 * Example SYNAPTIC.md:
 * ```markdown
 * # Project Guidelines
 *
 * ## Tech Stack
 * - React 18 with TypeScript
 * - Tailwind CSS for styling
 * - Zustand for state management
 *
 * ## Coding Standards
 * - Use functional components with hooks
 * - Prefer const over let
 * - Use descriptive variable names
 *
 * ## Project Structure
 * - src/components/ - React components
 * - src/hooks/ - Custom hooks
 * - src/utils/ - Utility functions
 * ```
 */

import * as fs from 'fs';
import * as path from 'path';

const CONFIG_PATHS = [
  'synaptic/SYNAPTIC.md',
  'SYNAPTIC.md',
  '.synaptic/SYNAPTIC.md',
];

/**
 * Load project configuration from SYNAPTIC.md
 * Searches in multiple locations for flexibility
 */
export function loadProjectConfig(cwd: string = process.cwd()): string | null {
  for (const configPath of CONFIG_PATHS) {
    const fullPath = path.join(cwd, configPath);

    if (fs.existsSync(fullPath)) {
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        return content.trim();
      } catch {
        // Ignore read errors
      }
    }
  }

  return null;
}

/**
 * Get the path where SYNAPTIC.md was found (for display purposes)
 */
export function getProjectConfigPath(cwd: string = process.cwd()): string | null {
  for (const configPath of CONFIG_PATHS) {
    const fullPath = path.join(cwd, configPath);

    if (fs.existsSync(fullPath)) {
      return configPath;
    }
  }

  return null;
}

/**
 * Check if project has a SYNAPTIC.md configuration
 */
export function hasProjectConfig(cwd: string = process.cwd()): boolean {
  return getProjectConfigPath(cwd) !== null;
}
