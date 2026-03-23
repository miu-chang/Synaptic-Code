import React from 'react';
import { render } from 'ink';
import { App } from './components/App.js';
import type { LLMClient } from '../llm/types.js';
import type { ToolRegistry } from '../tools/registry.js';
import type { Settings } from '../config/settings.js';
import type { LicenseInfo } from '../license/index.js';

export interface InkAppConfig {
  settings: Settings;
  client: LLMClient;
  tools: ToolRegistry;
  licenseStatus?: LicenseInfo;
  isGitRepo?: boolean;
  synapticStatus?: string;
  initialMessages?: Array<{ type: 'info' | 'error'; content: string }>;
}

// Synchronized Output sequences (DEC Mode 2026)
const BEGIN_SYNC = '\x1b[?2026h';
const END_SYNC = '\x1b[?2026l';

// Wrap stdout to use synchronized output for all writes
function wrapStdoutWithSync(): () => void {
  const originalWrite = process.stdout.write.bind(process.stdout);
  let pendingSync = false;
  let syncTimer: NodeJS.Timeout | null = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  process.stdout.write = function(chunk: any, encoding?: any, callback?: any): boolean {
    // Start sync mode if not already
    if (!pendingSync) {
      pendingSync = true;
      originalWrite(BEGIN_SYNC);
    }

    // Clear existing timer
    if (syncTimer) {
      clearTimeout(syncTimer);
    }

    // End sync mode after a small delay (batch multiple writes)
    syncTimer = setTimeout(() => {
      originalWrite(END_SYNC);
      pendingSync = false;
      syncTimer = null;
    }, 16); // ~60fps

    // Call original write
    return originalWrite(chunk, encoding, callback);
  } as typeof process.stdout.write;

  // Return cleanup function
  return () => {
    process.stdout.write = originalWrite;
    if (syncTimer) {
      clearTimeout(syncTimer);
    }
    if (pendingSync) {
      originalWrite(END_SYNC);
    }
  };
}

export async function startInkApp(config: InkAppConfig): Promise<void> {
  // Disabled synchronized output - was causing double rendering issues
  // const cleanup = wrapStdoutWithSync();

  const { waitUntilExit } = render(
    <App
      settings={config.settings}
      client={config.client}
      tools={config.tools}
      licenseStatus={config.licenseStatus}
      isGitRepo={config.isGitRepo}
      synapticStatus={config.synapticStatus}
      initialMessages={config.initialMessages}
    />,
    {
      exitOnCtrlC: false, // Handle Ctrl+C manually (double-press to exit)
    }
  );

  await waitUntilExit();
  // cleanup();
}
