import {
  readFileSync,
  writeFileSync,
  existsSync,
  statSync,
  readdirSync,
} from 'fs';
import { join, resolve, relative } from 'path';
import { glob } from 'glob';
import type { ToolHandler } from './registry.js';
import { undoManager } from '../core/undo.js';

// Track which files have been read in this session
// Key: absolute path, Value: { readTime, mtime at read time }
const readFileCache = new Map<string, { readTime: number; mtime: number }>();

// How long a read is valid (5 minutes)
const READ_CACHE_TTL = 5 * 60 * 1000;

export function markFileAsRead(path: string): void {
  const fullPath = resolve(path);
  try {
    const stats = statSync(fullPath);
    readFileCache.set(fullPath, {
      readTime: Date.now(),
      mtime: stats.mtimeMs,
    });
  } catch {
    // File might not exist, still mark as read
    readFileCache.set(fullPath, { readTime: Date.now(), mtime: 0 });
  }
}

export function hasFileBeenRead(path: string): boolean {
  const fullPath = resolve(path);
  const cached = readFileCache.get(fullPath);
  if (!cached) return false;

  // Check if cache is still valid (within TTL)
  if (Date.now() - cached.readTime > READ_CACHE_TTL) {
    readFileCache.delete(fullPath);
    return false;
  }

  // Check if file was modified since we read it
  try {
    const stats = statSync(fullPath);
    if (stats.mtimeMs > cached.mtime) {
      // File was modified externally - invalidate cache
      readFileCache.delete(fullPath);
      return false;
    }
  } catch {
    // File might have been deleted
    readFileCache.delete(fullPath);
    return false;
  }

  return true;
}

export function getFileModifiedExternally(path: string): boolean {
  const fullPath = resolve(path);
  const cached = readFileCache.get(fullPath);
  if (!cached) return false;

  try {
    const stats = statSync(fullPath);
    return stats.mtimeMs > cached.mtime;
  } catch {
    return false;
  }
}

export function clearReadCache(): void {
  readFileCache.clear();
}

export function getReadFiles(): string[] {
  return Array.from(readFileCache.keys());
}

export const readFileTool: ToolHandler = {
  definition: {
    type: 'function',
    function: {
      name: 'read_file',
      description:
        'Read the contents of a file. Returns the file content with line numbers.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'The path to the file to read',
          },
          offset: {
            type: 'number',
            description: 'Line number to start reading from (1-based)',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of lines to read',
          },
        },
        required: ['path'],
      },
    },
  },
  async execute(args) {
    const { path, offset = 1, limit } = args as {
      path: string;
      offset?: number;
      limit?: number;
    };

    const fullPath = resolve(path);

    if (!existsSync(fullPath)) {
      return JSON.stringify({ error: `File not found: ${path}` });
    }

    try {
      const content = readFileSync(fullPath, 'utf-8');
      const lines = content.split('\n');
      const start = Math.max(0, offset - 1);
      const end = limit ? start + limit : lines.length;
      const selectedLines = lines.slice(start, end);

      const numberedLines = selectedLines
        .map((line, i) => `${start + i + 1}\t${line}`)
        .join('\n');

      // Mark file as read for edit_file safety check
      markFileAsRead(fullPath);

      return JSON.stringify({
        path: fullPath,
        totalLines: lines.length,
        showing: { from: start + 1, to: Math.min(end, lines.length) },
        content: numberedLines,
        note: 'Line numbers are for display only. When using edit_file, do NOT include line numbers in old_string.',
      });
    } catch (error) {
      return JSON.stringify({
        error: `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  },
};

export const writeFileTool: ToolHandler = {
  definition: {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Write content to a file. Creates the file if it does not exist.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'The path to the file to write',
          },
          content: {
            type: 'string',
            description: 'The content to write to the file',
          },
        },
        required: ['path', 'content'],
      },
    },
  },
  async execute(args) {
    const { path, content } = args as { path: string; content: string };
    const fullPath = resolve(path);

    try {
      // Track file before modification for undo
      undoManager.trackFile(fullPath);

      const isNew = !existsSync(fullPath);
      writeFileSync(fullPath, content, 'utf-8');

      // Update undo manager state
      if (isNew) {
        undoManager.markAsNew(fullPath);
      } else {
        undoManager.updateFileState(fullPath, content);
      }

      return JSON.stringify({
        success: true,
        path: fullPath,
        bytes: Buffer.byteLength(content, 'utf-8'),
      });
    } catch (error) {
      return JSON.stringify({
        error: `Failed to write file: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  },
};

export const editFileTool: ToolHandler = {
  definition: {
    type: 'function',
    function: {
      name: 'edit_file',
      description:
        'Edit a file by replacing a specific string with new content. The old_string must match exactly what is in the file (WITHOUT line numbers - line numbers shown by read_file are for display only). The old_string must be unique in the file.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'The path to the file to edit',
          },
          old_string: {
            type: 'string',
            description: 'The exact string to replace (do NOT include line numbers from read_file output)',
          },
          new_string: {
            type: 'string',
            description: 'The new string to replace with',
          },
          replace_all: {
            type: 'boolean',
            description: 'Replace all occurrences (default: false)',
          },
        },
        required: ['path', 'old_string', 'new_string'],
      },
    },
  },
  async execute(args) {
    const { path, old_string, new_string, replace_all = false } = args as {
      path: string;
      old_string: string;
      new_string: string;
      replace_all?: boolean;
    };

    const fullPath = resolve(path);

    if (!existsSync(fullPath)) {
      return JSON.stringify({ error: `File not found: ${path}` });
    }

    // Safety check: require read_file before edit_file
    // Also detects if file was modified externally since last read
    if (!hasFileBeenRead(fullPath)) {
      const wasModified = getFileModifiedExternally(fullPath);
      return JSON.stringify({
        error: wasModified
          ? 'File was modified externally since you last read it. Re-read to get current content.'
          : 'You must use read_file before edit_file. This ensures you have the current file content.',
        suggestion: `Call read_file with path "${path}" first, then retry edit_file.`,
      });
    }

    try {
      // Track file before modification for undo
      undoManager.trackFile(fullPath);

      let content = readFileSync(fullPath, 'utf-8');
      const occurrences = (content.match(new RegExp(escapeRegex(old_string), 'g')) || []).length;

      if (occurrences === 0) {
        return JSON.stringify({ error: 'String not found in file' });
      }

      if (occurrences > 1 && !replace_all) {
        return JSON.stringify({
          error: `String found ${occurrences} times. Use replace_all=true or provide more context.`,
        });
      }

      if (replace_all) {
        content = content.split(old_string).join(new_string);
      } else {
        content = content.replace(old_string, new_string);
      }

      writeFileSync(fullPath, content, 'utf-8');

      // Update undo manager state
      undoManager.updateFileState(fullPath, content);

      return JSON.stringify({
        success: true,
        path: fullPath,
        replacements: replace_all ? occurrences : 1,
      });
    } catch (error) {
      return JSON.stringify({
        error: `Failed to edit file: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  },
};

export const globTool: ToolHandler = {
  definition: {
    type: 'function',
    function: {
      name: 'glob',
      description: 'Find files matching a glob pattern',
      parameters: {
        type: 'object',
        properties: {
          pattern: {
            type: 'string',
            description: 'Glob pattern (e.g., "**/*.ts", "src/**/*.js")',
          },
          cwd: {
            type: 'string',
            description: 'Working directory for the search',
          },
        },
        required: ['pattern'],
      },
    },
  },
  async execute(args) {
    const { pattern, cwd = process.cwd() } = args as {
      pattern: string;
      cwd?: string;
    };

    try {
      const files = await glob(pattern, {
        cwd: resolve(cwd),
        ignore: ['node_modules/**', '.git/**'],
      });

      return JSON.stringify({
        pattern,
        cwd: resolve(cwd),
        count: files.length,
        files: files.slice(0, 100), // Limit results
      });
    } catch (error) {
      return JSON.stringify({
        error: `Glob failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  },
};

export const grepTool: ToolHandler = {
  definition: {
    type: 'function',
    function: {
      name: 'grep',
      description: 'Search for a pattern in files',
      parameters: {
        type: 'object',
        properties: {
          pattern: {
            type: 'string',
            description: 'Regular expression pattern to search for',
          },
          path: {
            type: 'string',
            description: 'File or directory to search in',
          },
          include: {
            type: 'string',
            description: 'Glob pattern for files to include (e.g., "*.ts")',
          },
        },
        required: ['pattern'],
      },
    },
  },
  async execute(args) {
    const { pattern, path = '.', include } = args as {
      pattern: string;
      path?: string;
      include?: string;
    };

    const searchPath = resolve(path);
    const results: { file: string; line: number; content: string }[] = [];
    const regex = new RegExp(pattern, 'gi');

    try {
      const searchFiles = async (dir: string) => {
        const entries = readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = join(dir, entry.name);

          if (entry.name.startsWith('.') || entry.name === 'node_modules') {
            continue;
          }

          if (entry.isDirectory()) {
            await searchFiles(fullPath);
          } else if (entry.isFile()) {
            if (include && !minimatch(entry.name, include)) {
              continue;
            }

            try {
              const content = readFileSync(fullPath, 'utf-8');
              const lines = content.split('\n');

              lines.forEach((line, i) => {
                if (regex.test(line)) {
                  results.push({
                    file: relative(process.cwd(), fullPath),
                    line: i + 1,
                    content: line.trim().slice(0, 200),
                  });
                }
                regex.lastIndex = 0; // Reset regex
              });
            } catch {
              // Skip binary/unreadable files
            }
          }
        }
      };

      if (statSync(searchPath).isDirectory()) {
        await searchFiles(searchPath);
      } else {
        const content = readFileSync(searchPath, 'utf-8');
        content.split('\n').forEach((line, i) => {
          if (regex.test(line)) {
            results.push({
              file: relative(process.cwd(), searchPath),
              line: i + 1,
              content: line.trim().slice(0, 200),
            });
          }
          regex.lastIndex = 0;
        });
      }

      return JSON.stringify({
        pattern,
        matches: results.length,
        results: results.slice(0, 50),
      });
    } catch (error) {
      return JSON.stringify({
        error: `Grep failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  },
};

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function minimatch(filename: string, pattern: string): boolean {
  const regex = pattern
    .replace(/\./g, '\\.')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${regex}$`).test(filename);
}

export const fileTools = [
  readFileTool,
  writeFileTool,
  editFileTool,
  globTool,
  grepTool,
];
