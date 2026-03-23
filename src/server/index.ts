/**
 * Synaptic API Server
 * Provides OpenAI-compatible API for remote access to local LLMs
 */

import http from 'http';
import { URL } from 'url';
import { randomBytes, createHash } from 'crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const CONFIG_DIR = join(homedir(), '.synaptic');
const API_KEYS_FILE = join(CONFIG_DIR, 'api-keys.json');

export interface ApiKey {
  key: string;
  name: string;
  created: string;
  lastUsed?: string;
  usageTokens: number;
}

export interface ServerConfig {
  port: number;
  host: string;
  lmStudioUrl: string;
  corsOrigins: string[];
}

const DEFAULT_CONFIG: ServerConfig = {
  port: 8080,
  host: '0.0.0.0',
  lmStudioUrl: 'http://localhost:1234',
  corsOrigins: ['*'],
};

/**
 * Load API keys from file
 */
function loadApiKeys(): ApiKey[] {
  if (!existsSync(API_KEYS_FILE)) {
    return [];
  }
  try {
    return JSON.parse(readFileSync(API_KEYS_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

/**
 * Save API keys to file
 */
function saveApiKeys(keys: ApiKey[]): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  writeFileSync(API_KEYS_FILE, JSON.stringify(keys, null, 2));
}

/**
 * Generate a new API key
 */
export function generateApiKey(name: string): ApiKey {
  const rawKey = randomBytes(32).toString('base64url');
  const key = `sk-syn-${rawKey}`;

  const apiKey: ApiKey = {
    key,
    name,
    created: new Date().toISOString(),
    usageTokens: 0,
  };

  const keys = loadApiKeys();
  keys.push(apiKey);
  saveApiKeys(keys);

  return apiKey;
}

/**
 * List all API keys (hashed for display)
 */
export function listApiKeys(): Array<Omit<ApiKey, 'key'> & { keyPreview: string }> {
  const keys = loadApiKeys();
  return keys.map(k => ({
    keyPreview: k.key.slice(0, 12) + '...' + k.key.slice(-4),
    name: k.name,
    created: k.created,
    lastUsed: k.lastUsed,
    usageTokens: k.usageTokens,
  }));
}

/**
 * Validate API key
 */
function validateApiKey(authHeader: string | undefined): ApiKey | null {
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const key = authHeader.slice(7);
  const keys = loadApiKeys();
  const found = keys.find(k => k.key === key);

  if (found) {
    // Update last used
    found.lastUsed = new Date().toISOString();
    saveApiKeys(keys);
  }

  return found || null;
}

/**
 * Update token usage for an API key
 */
function updateUsage(key: string, tokens: number): void {
  const keys = loadApiKeys();
  const found = keys.find(k => k.key === key);
  if (found) {
    found.usageTokens += tokens;
    saveApiKeys(keys);
  }
}

/**
 * Revoke an API key by preview
 */
export function revokeApiKey(keyPreview: string): boolean {
  const keys = loadApiKeys();
  const index = keys.findIndex(k =>
    k.key.slice(0, 12) + '...' + k.key.slice(-4) === keyPreview ||
    k.key === keyPreview
  );

  if (index >= 0) {
    keys.splice(index, 1);
    saveApiKeys(keys);
    return true;
  }
  return false;
}

/**
 * Create and start the API server
 */
export function createServer(config: Partial<ServerConfig> = {}): http.Server {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  const server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', cfg.corsOrigins.join(', '));
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const path = url.pathname;

    // Health check (no auth required)
    if (path === '/health' || path === '/') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', version: '1.0.0' }));
      return;
    }

    // Validate API key for all other endpoints
    const apiKey = validateApiKey(req.headers.authorization);
    if (!apiKey) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'Invalid API key', type: 'invalid_request_error' } }));
      return;
    }

    // Proxy to LM Studio
    try {
      if (path === '/v1/models' || path === '/v1/chat/completions' || path === '/v1/completions') {
        await proxyToLmStudio(req, res, cfg.lmStudioUrl, apiKey);
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'Not found', type: 'invalid_request_error' } }));
      }
    } catch (error) {
      console.error('Proxy error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: {
          message: error instanceof Error ? error.message : 'Internal server error',
          type: 'server_error'
        }
      }));
    }
  });

  return server;
}

/**
 * Proxy request to LM Studio
 */
async function proxyToLmStudio(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  lmStudioUrl: string,
  apiKey: ApiKey
): Promise<void> {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const targetUrl = `${lmStudioUrl}${url.pathname}${url.search}`;

  // Read request body
  let body = '';
  for await (const chunk of req) {
    body += chunk;
  }

  // Check if streaming requested
  let isStreaming = false;
  if (body) {
    try {
      const parsed = JSON.parse(body);
      isStreaming = parsed.stream === true;
    } catch {
      // Not JSON, continue anyway
    }
  }

  // Forward to LM Studio
  const response = await fetch(targetUrl, {
    method: req.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    body: body || undefined,
  });

  // Copy status and headers
  res.writeHead(response.status, {
    'Content-Type': response.headers.get('Content-Type') || 'application/json',
  });

  if (isStreaming && response.body) {
    // Stream response
    const reader = response.body.getReader();
    let totalTokens = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        res.write(value);

        // Try to extract token count from SSE data
        const text = new TextDecoder().decode(value);
        const usageMatch = text.match(/"usage":\s*{[^}]*"total_tokens":\s*(\d+)/);
        if (usageMatch) {
          totalTokens = parseInt(usageMatch[1]);
        }
      }
    } finally {
      reader.releaseLock();
      if (totalTokens > 0) {
        updateUsage(apiKey.key, totalTokens);
      }
    }
    res.end();
  } else {
    // Non-streaming response
    const text = await response.text();

    // Extract token usage
    try {
      const data = JSON.parse(text);
      if (data.usage?.total_tokens) {
        updateUsage(apiKey.key, data.usage.total_tokens);
      }
    } catch {
      // Not JSON, skip usage tracking
    }

    res.end(text);
  }
}

/**
 * Start the server
 */
export async function startServer(config: Partial<ServerConfig> = {}): Promise<{
  server: http.Server;
  address: string;
  port: number;
}> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const server = createServer(cfg);

  return new Promise((resolve, reject) => {
    server.on('error', reject);

    server.listen(cfg.port, cfg.host, () => {
      const addr = server.address();
      const port = typeof addr === 'object' ? addr?.port || cfg.port : cfg.port;
      const host = cfg.host === '0.0.0.0' ? 'localhost' : cfg.host;

      resolve({
        server,
        address: `http://${host}:${port}`,
        port,
      });
    });
  });
}
