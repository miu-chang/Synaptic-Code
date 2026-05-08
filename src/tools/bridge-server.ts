/**
 * Embedded Browser Bridge HTTP/WebSocket server.
 *
 * Listens on BRIDGE_PORT (19222) and provides:
 *  - GET  /health          : status + LM Studio model info
 *  - POST /execute         : forward tool call to connected Chrome extension via WS
 *  - POST /chat            : streaming SSE chat to LM Studio with session memory
 *  - GET  /models          : list available + currently loaded LM Studio model
 *  - POST /models/load     : load model in LM Studio via `lms` CLI
 *  - POST /chat/clear      : clear chat session memory
 *
 * The Chrome extension connects via WebSocket; only one socket is kept at a time.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { WebSocketServer, WebSocket } from 'ws';

const BRIDGE_PORT = 19222;

interface SynapticSettings {
  baseUrl: string;
  model: string;
}

interface PendingRequest {
  resolve: (result: unknown) => void;
  reject: (err: Error) => void;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatSession {
  messages: ChatMessage[];
  model: string;
}

let chromeSocket: WebSocket | null = null;
let requestCounter = 0;
const pendingRequests: Map<number, PendingRequest> = new Map();
const chatSessions: Map<string, ChatSession> = new Map();
let serverRunning = false;

function loadSynapticSettings(): SynapticSettings {
  try {
    const configPath = join(homedir(), '.synaptic', 'config.json');
    if (existsSync(configPath)) {
      const data = JSON.parse(readFileSync(configPath, 'utf-8'));
      return {
        baseUrl: data.providers?.lmstudio?.baseUrl || 'http://localhost:1234/v1',
        model: data.providers?.lmstudio?.model || '',
      };
    }
  } catch {
    /* ignore */
  }
  return { baseUrl: 'http://localhost:1234/v1', model: '' };
}

async function getLoadedModel(baseUrl: string): Promise<string | null> {
  try {
    const res = await fetch(`${baseUrl}/models`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const data = (await res.json()) as { data?: Array<{ id: string }> };
    if (data.data && data.data.length > 0) return data.data[0].id;
  } catch {
    /* ignore */
  }
  return null;
}

function parseBody<T = unknown>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        resolve(JSON.parse(body) as T);
      } catch (e) {
        reject(e as Error);
      }
    });
    req.on('error', reject);
  });
}

function sendJSON(res: ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

export function sendToChrome(
  tool: string,
  params: Record<string, unknown>,
  timeout = 15000
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (!chromeSocket || chromeSocket.readyState !== WebSocket.OPEN) {
      reject(new Error('Chrome extension not connected'));
      return;
    }
    const requestId = ++requestCounter;
    const timer = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error(`Timeout (${timeout}ms)`));
    }, timeout);
    pendingRequests.set(requestId, {
      resolve: (r) => {
        clearTimeout(timer);
        resolve(r);
      },
      reject: (e) => {
        clearTimeout(timer);
        reject(e);
      },
    });
    chromeSocket.send(JSON.stringify({ type: 'execute', requestId, tool, params }));
  });
}

export function startEmbeddedBridgeServer(): Promise<boolean> {
  if (serverRunning) return Promise.resolve(true);
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }
      const url = new URL(req.url || '/', `http://localhost:${BRIDGE_PORT}`);

      if (url.pathname === '/health') {
        const settings = loadSynapticSettings();
        const model = await getLoadedModel(settings.baseUrl);
        sendJSON(res, {
          status: 'ok',
          server: 'Synaptic Browser Bridge (embedded)',
          port: BRIDGE_PORT,
          chromeConnected: chromeSocket !== null && chromeSocket.readyState === WebSocket.OPEN,
          model: model || settings.model || 'none',
          lmStudioUrl: settings.baseUrl,
        });
        return;
      }

      if (url.pathname === '/execute' && req.method === 'POST') {
        try {
          const { tool, params } = await parseBody<{ tool: string; params?: Record<string, unknown> }>(req);
          if (!chromeSocket || chromeSocket.readyState !== WebSocket.OPEN) {
            sendJSON(res, { error: 'Chrome extension not connected' }, 503);
            return;
          }
          const result = await sendToChrome(tool, params || {});
          sendJSON(res, result);
        } catch (error) {
          sendJSON(res, { error: error instanceof Error ? error.message : String(error) }, 500);
        }
        return;
      }

      if (url.pathname === '/chat' && req.method === 'POST') {
        try {
          const { message, sessionId, pageContext } = await parseBody<{
            message: string;
            sessionId?: string;
            pageContext?: { title: string; url: string };
          }>(req);
          const sid = sessionId || 'default';
          const settings = loadSynapticSettings();
          const model = (await getLoadedModel(settings.baseUrl)) || settings.model;
          if (!model) {
            sendJSON(res, { error: 'No model loaded in LM Studio' }, 503);
            return;
          }
          if (!chatSessions.has(sid)) {
            chatSessions.set(sid, {
              messages: [
                {
                  role: 'system',
                  content: `You are Synaptic Code, a helpful coding and browsing assistant running in the browser sidebar. Keep responses concise. Current date: ${new Date().toISOString().split('T')[0]}`,
                },
              ],
              model,
            });
          }
          const session = chatSessions.get(sid)!;
          let userMessage = message;
          if (pageContext) {
            userMessage = `[Current page: ${pageContext.title} - ${pageContext.url}]\n\n${message}`;
          }
          session.messages.push({ role: 'user', content: userMessage });

          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          });

          const llmRes = await fetch(`${settings.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, messages: session.messages, stream: true }),
          });
          if (!llmRes.ok) {
            res.write(`data: ${JSON.stringify({ error: `LLM error: ${llmRes.status}` })}\n\n`);
            res.end();
            return;
          }

          let fullContent = '';
          const reader = llmRes.body?.getReader();
          if (!reader) {
            res.end();
            return;
          }
          const decoder = new TextDecoder();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter((l) => l.startsWith('data: '));
            for (const line of lines) {
              const data = line.slice(6);
              if (data === '[DONE]') {
                res.write(`data: [DONE]\n\n`);
                continue;
              }
              try {
                const parsed = JSON.parse(data) as {
                  choices?: Array<{ delta?: { content?: string } }>;
                };
                const delta = parsed.choices?.[0]?.delta?.content;
                if (delta) {
                  fullContent += delta;
                  res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
                }
              } catch {
                /* ignore */
              }
            }
          }
          if (fullContent) session.messages.push({ role: 'assistant', content: fullContent });
          res.end();
        } catch (error) {
          if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
        }
        return;
      }

      if (url.pathname === '/models' && req.method === 'GET') {
        try {
          const settings = loadSynapticSettings();
          const apiRes = await fetch(`${settings.baseUrl}/models`);
          const apiData = (await apiRes.json()) as { data?: Array<{ id: string }> };
          const loaded = await getLoadedModel(settings.baseUrl);
          sendJSON(res, { loaded, available: (apiData.data || []).map((m) => m.id) });
        } catch (error) {
          sendJSON(res, { error: error instanceof Error ? error.message : String(error) }, 500);
        }
        return;
      }

      if (url.pathname === '/models/load' && req.method === 'POST') {
        try {
          const { model, contextLength } = await parseBody<{
            model: string;
            contextLength?: number;
          }>(req);
          if (!model) {
            sendJSON(res, { error: 'model is required' }, 400);
            return;
          }
          const { execSync } = await import('child_process');
          const lmsPath = join(homedir(), '.lmstudio', 'bin', 'lms');
          try {
            execSync(`"${lmsPath}" unload --all`, { timeout: 10_000 });
          } catch {
            /* ignore */
          }
          const ctx = contextLength || 32768;
          const output = execSync(
            `"${lmsPath}" load "${model}" --context-length ${ctx} --gpu max -y`,
            { encoding: 'utf-8', timeout: 60_000 }
          );
          const settings = loadSynapticSettings();
          const loaded = await getLoadedModel(settings.baseUrl);
          sendJSON(res, { success: true, loaded, output: output.trim() });
        } catch (error) {
          sendJSON(res, { error: error instanceof Error ? error.message : String(error) }, 500);
        }
        return;
      }

      if (url.pathname === '/chat/clear' && req.method === 'POST') {
        try {
          const { sessionId } = await parseBody<{ sessionId?: string }>(req);
          chatSessions.delete(sessionId || 'default');
        } catch {
          /* ignore */
        }
        sendJSON(res, { success: true });
        return;
      }

      sendJSON(res, { error: 'Not found' }, 404);
    });

    const wss = new WebSocketServer({ server });
    wss.on('connection', (ws) => {
      // Replace any existing chrome socket (only one extension at a time)
      if (chromeSocket) {
        try {
          chromeSocket.close();
        } catch {
          /* ignore */
        }
      }
      chromeSocket = ws;
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString()) as {
            type: string;
            requestId: number;
            result: unknown;
          };
          if (message.type === 'result' && pendingRequests.has(message.requestId)) {
            const { resolve: resolveReq } = pendingRequests.get(message.requestId)!;
            pendingRequests.delete(message.requestId);
            resolveReq(message.result);
          }
        } catch {
          /* ignore */
        }
      });
      ws.on('close', () => {
        if (chromeSocket === ws) chromeSocket = null;
        for (const [id, { reject }] of pendingRequests) {
          reject(new Error('Chrome extension disconnected'));
          pendingRequests.delete(id);
        }
      });
    });

    server.on('error', (err: NodeJS.ErrnoException) => {
      // EADDRINUSE means another instance owns the port, treat as success
      if (err.code === 'EADDRINUSE') {
        resolve(true);
      } else {
        resolve(false);
      }
    });

    server.listen(BRIDGE_PORT, () => {
      serverRunning = true;
      resolve(true);
    });
  });
}

export { BRIDGE_PORT };
