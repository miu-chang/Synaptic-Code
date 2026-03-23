import type { ToolHandler } from './registry.js';

export const webFetchTool: ToolHandler = {
  definition: {
    type: 'function',
    function: {
      name: 'web_fetch',
      description: 'Fetch content from a URL and extract text',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The URL to fetch',
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
    const { url } = args as { url: string; selector?: string };

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; LocalCode/1.0)',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      if (!response.ok) {
        return JSON.stringify({
          error: `HTTP ${response.status}: ${response.statusText}`,
          url,
        });
      }

      const contentType = response.headers.get('content-type') || '';
      let content: string;

      if (contentType.includes('application/json')) {
        const json = await response.json();
        content = JSON.stringify(json, null, 2);
      } else {
        const html = await response.text();
        // Simple HTML to text conversion
        content = htmlToText(html);
      }

      // Truncate if too long
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
      // Use DuckDuckGo HTML search (no API key required)
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; LocalCode/1.0)',
        },
      });

      if (!response.ok) {
        return JSON.stringify({
          error: `Search failed: HTTP ${response.status}`,
          query,
        });
      }

      const html = await response.text();
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
    // Remove scripts and styles
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    // Remove HTML tags
    .replace(/<[^>]+>/g, ' ')
    // Decode HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Clean up whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDuckDuckGoResults(
  html: string,
  maxResults: number
): { title: string; url: string; snippet: string }[] {
  const results: { title: string; url: string; snippet: string }[] = [];

  // Simple regex-based parsing for DuckDuckGo HTML results
  const resultRegex =
    /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([^<]*)/gi;

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

  // Fallback: try alternative parsing
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
