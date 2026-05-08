/**
 * Chrome browser tools.
 *
 * These tools control a Chrome extension via the embedded bridge server
 * (see ./bridge-server.ts). The bridge server listens on BRIDGE_PORT (19222)
 * for HTTP requests, and forwards `execute` calls to a connected Chrome
 * extension over WebSocket.
 *
 * `startBridgeServer()` is called once at agent startup; if no external
 * bridge is already listening on the port, the embedded one is launched.
 * `isBridgeConnected()` reports whether the Chrome extension itself is
 * actually connected (not just whether the bridge HTTP server is up).
 */

import type { ToolHandler } from './registry.js';
import { startEmbeddedBridgeServer, BRIDGE_PORT } from './bridge-server.js';

const BRIDGE_URL = `http://localhost:${BRIDGE_PORT}`;
const EXECUTE_TIMEOUT = 20_000;

async function isBridgeRunning(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(`${BRIDGE_URL}/health`, { signal: controller.signal });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Ensure a bridge server is running (external or embedded). Returns true
 * once /health responds OK, false if startup failed within the retry window.
 */
export async function startBridgeServer(): Promise<boolean> {
  if (await isBridgeRunning()) return true;
  try {
    const started = await startEmbeddedBridgeServer();
    if (started) {
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => setTimeout(r, 300));
        if (await isBridgeRunning()) return true;
      }
    }
  } catch {
    /* ignore */
  }
  return false;
}

/**
 * True only if the Chrome extension WebSocket is currently connected to
 * the bridge. Used by the UI to show "Browser connected" state.
 */
export async function isBridgeConnected(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(`${BRIDGE_URL}/health`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return false;
    const data = (await res.json()) as { chromeConnected?: boolean };
    return data.chromeConnected === true;
  } catch {
    return false;
  }
}

async function executeBrowserTool(
  tool: string,
  params: Record<string, unknown> = {}
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EXECUTE_TIMEOUT);
  try {
    const res = await fetch(`${BRIDGE_URL}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool, params }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      const err = (await res.json()) as { error?: string };
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return await res.json();
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Browser bridge timeout');
    }
    throw error;
  }
}

/**
 * Helper to build a chrome_* ToolHandler that simply forwards to the bridge.
 */
function makeChromeTool(
  name: string,
  description: string,
  parameters: { type: 'object'; properties: Record<string, unknown>; required?: string[] }
): ToolHandler {
  return {
    definition: {
      type: 'function',
      function: { name, description, parameters },
    },
    execute: async (args) => {
      const result = await executeBrowserTool(name, args);
      return JSON.stringify(result);
    },
  };
}

export const chromeTools: ToolHandler[] = [
  makeChromeTool(
    'chrome_get_page',
    'Get current browser page content (title, URL, text, headings).',
    {
      type: 'object',
      properties: {
        format: {
          type: 'string',
          enum: ['text', 'html'],
          description:
            'Output format: "text" (default, clean readable text) or "html" (raw HTML, truncated)',
        },
      },
    }
  ),
  makeChromeTool(
    'chrome_click',
    'Click an element on the page by CSS selector.',
    {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector of the element to click',
        },
      },
      required: ['selector'],
    }
  ),
  makeChromeTool(
    'chrome_type',
    'Type text into an input field or textarea on the page.',
    {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector of the input element',
        },
        text: {
          type: 'string',
          description: 'Text to type',
        },
        clear: {
          type: 'boolean',
          description: 'Clear existing content before typing (default: false)',
        },
      },
      required: ['selector', 'text'],
    }
  ),
  makeChromeTool(
    'chrome_navigate',
    'Navigate the browser to a URL.',
    {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to navigate to' },
      },
      required: ['url'],
    }
  ),
  makeChromeTool(
    'chrome_screenshot',
    'Take a screenshot of the current browser tab. Returns a base64 PNG data URL.',
    {
      type: 'object',
      properties: {},
    }
  ),
  makeChromeTool(
    'chrome_get_tabs',
    'List all open browser tabs with their titles and URLs.',
    {
      type: 'object',
      properties: {},
    }
  ),
  makeChromeTool(
    'chrome_switch_tab',
    'Switch to a specific browser tab by its ID.',
    {
      type: 'object',
      properties: {
        tabId: {
          type: 'string',
          description: 'Tab ID (get from chrome_get_tabs)',
        },
      },
      required: ['tabId'],
    }
  ),
  makeChromeTool(
    'chrome_get_elements',
    'Find elements matching a CSS selector.',
    {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector to match elements',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of elements to return (default: 10)',
        },
      },
      required: ['selector'],
    }
  ),
  makeChromeTool(
    'chrome_scroll',
    'Scroll page by direction/amount, or scroll element into view.',
    {
      type: 'object',
      properties: {
        direction: {
          type: 'string',
          enum: ['up', 'down', 'top', 'bottom'],
          description: 'Scroll direction (default: "down")',
        },
        amount: {
          type: 'number',
          description: 'Pixels to scroll (default: 500)',
        },
        selector: {
          type: 'string',
          description: 'CSS selector to scroll into view (overrides direction/amount)',
        },
      },
    }
  ),
  makeChromeTool(
    'chrome_eval',
    'Execute JavaScript code in the current page context. Use with caution.',
    {
      type: 'object',
      properties: {
        script: {
          type: 'string',
          description: 'JavaScript code to execute',
        },
      },
      required: ['script'],
    }
  ),
];
