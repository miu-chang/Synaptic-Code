import type { ToolHandler } from './registry.js';

export const webFetchTool: ToolHandler = {
  definition: {
    type: 'function',
    function: {
      name: 'web_fetch',
      description:
        'Fetch content from a URL. Supports GET (default) and POST/PUT/DELETE/PATCH with optional body and headers.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The URL to fetch' },
          method: {
            type: 'string',
            description: 'HTTP method: GET, POST, PUT, DELETE, PATCH (default: GET)',
          },
          body: {
            type: 'string',
            description:
              'Request body for POST/PUT/PATCH (string or JSON-stringified object)',
          },
          headers: {
            type: 'object',
            description: 'Additional HTTP headers as key-value pairs',
          },
          selector: {
            type: 'string',
            description: 'CSS selector to extract specific content (optional)',
          },
        },
        required: ['url'],
      },
    },
  },
  async execute(args) {
    const {
      url,
      method = 'GET',
      body: reqBody,
      headers: extraHeaders,
    } = args as {
      url: string;
      method?: string;
      body?: string;
      headers?: Record<string, string>;
      selector?: string;
    };
    const upperMethod = (method || 'GET').toUpperCase();

    try {
      let content = '';
      let contentType = '';

      try {
        const headers: Record<string, string> = {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9,ja;q=0.8',
          ...(extraHeaders || {}),
        };
        const init: RequestInit = { method: upperMethod, headers };
        if (reqBody && upperMethod !== 'GET' && upperMethod !== 'HEAD') {
          init.body = reqBody;
          if (!headers['Content-Type'] && !headers['content-type']) {
            const trimmed = reqBody.trim();
            if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
              headers['Content-Type'] = 'application/json';
            }
          }
        }
        const response = await fetch(url, init);
        if (response.ok) {
          contentType = response.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const json = await response.json();
            content = JSON.stringify(json, null, 2);
          } else {
            content = await response.text();
          }
        }
      } catch {}

      if (!content) {
        try {
          const { execSync } = await import('child_process');
          const { platform } = await import('os');
          const isWin = platform() === 'win32';
          const curlCmd = `curl -s -L -m 15 "${url}" -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"`;
          content = execSync(curlCmd, {
            encoding: 'utf-8',
            timeout: 20000,
            shell: isWin ? 'cmd.exe' : undefined,
          });
        } catch {
          return JSON.stringify({
            error: 'Fetch failed: Unable to connect',
            url,
          });
        }
      }

      if (!contentType.includes('application/json')) {
        content = htmlToText(content);
      }

      const maxLength = 20000;
      if (content.length > maxLength) {
        content = content.slice(0, maxLength) + '\n\n... [content truncated]';
      }

      return JSON.stringify({
        url,
        contentType,
        length: content.length,
        content,
      });
    } catch (error) {
      return JSON.stringify({
        error: `Fetch failed: ${error instanceof Error ? error.message : String(error)}`,
        url,
      });
    }
  },
};

export const webSearchTool: ToolHandler = {
  definition: {
    type: 'function',
    function: {
      name: 'web_search',
      description:
        'Search the web using DuckDuckGo. Returns search results with titles and URLs.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query',
          },
          maxResults: {
            type: 'number',
            description: 'Maximum number of results (default: 10)',
          },
        },
        required: ['query'],
      },
    },
  },
  async execute(args) {
    const { query, maxResults = 10 } = args as {
      query: string;
      maxResults?: number;
    };

    try {
      let html = '';
      try {
        const searchUrl = 'https://html.duckduckgo.com/html/';
        const response = await fetch(searchUrl, {
          method: 'POST',
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            'Content-Type': 'application/x-www-form-urlencoded',
            Referer: 'https://html.duckduckgo.com/',
            'Accept-Language': 'en-US,en;q=0.9,ja;q=0.8',
          },
          body: `q=${encodeURIComponent(query)}`,
        });
        if (response.ok) {
          html = await response.text();
        }
      } catch {}

      if (html.length < 1000) {
        try {
          const { execSync } = await import('child_process');
          const { platform } = await import('os');
          const isWin = platform() === 'win32';
          const curlCmd = isWin
            ? `curl -s -X POST "https://html.duckduckgo.com/html/" -d "q=${encodeURIComponent(query)}" -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" -H "Referer: https://html.duckduckgo.com/"`
            : `curl -s -X POST 'https://html.duckduckgo.com/html/' -d 'q=${encodeURIComponent(query)}' -H 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36' -H 'Referer: https://html.duckduckgo.com/'`;
          html = isWin
            ? execSync(curlCmd, {
                encoding: 'utf-8',
                timeout: 15000,
                shell: 'cmd.exe',
              })
            : execSync(curlCmd, { encoding: 'utf-8', timeout: 15000 });
        } catch {}
      }

      const results = parseDuckDuckGoResults(html, maxResults);
      return JSON.stringify({
        query,
        resultCount: results.length,
        results,
      });
    } catch (error) {
      return JSON.stringify({
        error: `Search failed: ${error instanceof Error ? error.message : String(error)}`,
        query,
      });
    }
  },
};

function htmlToText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDuckDuckGoResults(
  html: string,
  maxResults: number
): { title: string; url: string; snippet: string }[] {
  const results: { title: string; url: string; snippet: string }[] = [];
  const resultRegex =
    /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;

  let match;
  while ((match = resultRegex.exec(html)) !== null && results.length < maxResults) {
    const [, url, title, snippet] = match;
    if (url && title) {
      results.push({
        title: htmlToText(title),
        url: decodeURIComponent(url.replace(/.*uddg=/, '').split('&')[0] || url),
        snippet: htmlToText(snippet || ''),
      });
    }
  }

  if (results.length === 0) {
    const linkRegex = /<a[^>]*href="(https?:\/\/[^"]*)"[^>]*>([^<]+)<\/a>/gi;
    while ((match = linkRegex.exec(html)) !== null && results.length < maxResults) {
      const [, url, title] = match;
      if (!url.includes('duckduckgo.com')) {
        results.push({
          title: htmlToText(title),
          url,
          snippet: '',
        });
      }
    }
  }

  return results;
}

export const webTools = [webFetchTool, webSearchTool];
