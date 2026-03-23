# Synaptic Code - Architecture Documentation

## Overview

Synaptic Code is a local LLM-powered coding assistant CLI. It connects to LM Studio, Ollama, or cloud APIs (OpenAI/Anthropic/Google) and provides an interactive terminal interface with tool execution capabilities.

**Total: ~15,000 lines of TypeScript**

---

## Directory Structure

```
src/
├── index.ts              # CLI entry point (Commander.js)
├── config/
│   └── settings.ts       # Settings management, system detection
├── llm/
│   ├── types.ts          # LLM message/tool types
│   └── client.ts         # API clients (LMStudio, Ollama, OpenAI, Anthropic, Google, Remote)
├── core/
│   ├── agent.ts          # Autonomous agent mode
│   ├── compression.ts    # Context compression
│   ├── conversation.ts   # Message management
│   ├── planner.ts        # Task planning
│   ├── undo.ts           # Undo/restore system
│   └── todo.ts           # Todo list management
├── tools/
│   ├── registry.ts       # Tool registration/execution
│   ├── file.ts           # read_file, write_file, edit_file, glob, grep
│   ├── bash.ts           # bash, bash_background
│   ├── web.ts            # web_fetch, web_search
│   ├── todo.ts           # todo_add, todo_update
│   ├── lmstudio.ts       # LM Studio model management
│   └── agent.ts          # Sub-agent spawning
├── lms/
│   └── client.ts         # LM Studio CLI wrapper (lms commands)
├── server/
│   └── index.ts          # API server for remote access
├── synaptic/
│   ├── index.ts          # Blender/Unity integration
│   ├── client.ts         # MCP client
│   ├── tools.ts          # Synaptic tools
│   ├── mention.ts        # @blender/@unity mentions
│   └── history.ts        # History management
├── cli/
│   ├── setup.ts          # First-run wizard
│   ├── ink-app.tsx       # Ink app wrapper
│   ├── components/
│   │   ├── App.tsx       # Main app component (1460 lines)
│   │   ├── Input.tsx     # Text input with autocomplete
│   │   ├── StatusBar.tsx # Bottom status bar
│   │   ├── ToolCall.tsx  # Tool execution display
│   │   ├── TodoList.tsx  # Todo sidebar
│   │   └── ...
│   └── ...
├── i18n/
│   └── index.ts          # Japanese/English translations
└── license/
    └── index.ts          # License management
```

---

## Key Components

### 1. LLM Clients (`src/llm/client.ts`)

```typescript
// All clients implement LLMClient interface
interface LLMClient {
  chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
  chatStream(request, onChunk, signal): Promise<StreamResponse>;
  listModels(): Promise<string[]>;
}

// Available clients:
- OpenAICompatibleClient  // LM Studio, OpenAI-compatible servers
- OllamaClient            // Ollama API
- OpenAICloudClient       // OpenAI API
- AnthropicClient         // Claude API
- GeminiClient            // Google Gemini API
- RemoteClient            // Synaptic remote server
```

### 2. Tool System (`src/tools/registry.ts`)

```typescript
interface ToolHandler {
  definition: ToolDefinition;  // OpenAI function calling format
  execute: (args: Record<string, unknown>) => Promise<string>;
}

// Tool Registry manages all tools
class ToolRegistry {
  register(handler: ToolHandler): void;
  execute(toolCall: ToolCall): Promise<string>;
  getDefinitions(): ToolDefinition[];
}
```

**Built-in Tools:**
- `read_file` - Read file with line numbers
- `write_file` - Create/overwrite file
- `edit_file` - Search & replace in file
- `glob` - Find files by pattern
- `grep` - Search content in files
- `bash` - Execute shell commands
- `bash_background` - Run command in background
- `web_fetch` - Fetch URL content
- `web_search` - Search the web
- `todo_add/update` - Manage todo list
- `lms_*` - LM Studio model management

### 3. Agent Mode (`src/core/agent.ts`)

Autonomous task execution with loop:
1. Send goal to LLM
2. LLM returns tool calls or text
3. Execute tools, add results to context
4. Repeat until `[DONE]` or max iterations

```typescript
const agent = new Agent(client, model, tools, {
  maxIterations: 30,
  stopOnError: false,
});
await agent.run("Create a React component for...");
```

### 4. Undo System (`src/core/undo.ts`)

Tracks file states at each turn:
- Creates snapshot before processing user message
- Can restore files to any previous point
- Supports conversation forking (restore with message history)

```typescript
undoManager.createUndoPoint(userMessage, messageCount, messages);
undoManager.restoreFiles(pointId);
```

### 5. Context Compression (`src/core/compression.ts`)

When context gets too long:
- Summarizes older messages
- Keeps recent messages intact
- Auto-triggers at threshold

### 6. Settings (`src/config/settings.ts`)

```typescript
interface Settings {
  provider: 'ollama' | 'lmstudio' | 'openai-local' | 'openai' | 'anthropic' | 'google';
  mode: 'local' | 'remote';
  remote?: { url: string; apiKey: string; model?: string };
  maxContextTokens: number;
  autoCompactThreshold: number;
  language: 'en' | 'ja';
  // ... provider configs
}
```

**Auto-detection:**
- RAM/CPU for context limits
- Apple Silicon (M1-M4) optimization
- GPU detection (NVIDIA/AMD)

### 7. Remote Server (`src/server/index.ts`)

OpenAI-compatible API proxy:
```bash
synaptic serve --port 8080
```

Features:
- API key authentication (`sk-syn-xxx`)
- Proxies to LM Studio
- Usage tracking
- CORS support

---

## CLI Commands

```bash
synaptic                    # Start chat (default)
synaptic chat              # Interactive chat
synaptic chat --remote <url> --api-key <key>  # Remote mode

synaptic serve             # Start API server
synaptic serve -p 8080     # Custom port

synaptic config            # Show config
synaptic config mode remote
synaptic config remote.url http://server:8080
synaptic config remote.apiKey sk-syn-xxx

synaptic apikey create     # Generate API key
synaptic apikey list       # List keys

synaptic models            # List available models
synaptic models --installed
synaptic models --loaded

synaptic server start/stop/status
synaptic load <model>
synaptic setup             # Run setup wizard
```

---

## Key Features

### Slash Commands (in chat)
- `/help` - Show commands
- `/new` - New conversation
- `/history` - Load past conversation
- `/undo` - Restore to previous turn
- `/compact` - Compress context
- `/model` - Change model
- `/provider` - Change provider
- `/agent <goal>` - Start agent mode
- `/plan <task>` - Create task plan
- `/todo` - Toggle todo list

### Keyboard Shortcuts
- `Shift+Tab` - Toggle auto-accept mode
- `Esc` - Cancel current request
- `Esc Esc` - Open undo selector
- `Ctrl+C Ctrl+C` - Exit

### Synaptic Ecosystem
- `@blender <command>` - Execute Blender operations
- `@unity <command>` - Execute Unity operations
- Auto-connects to running Synaptic servers (port 9876)

---

## Data Flow

```
User Input
    │
    ▼
┌─────────────┐
│ App.tsx     │ ── Slash commands ──▶ Handle locally
│             │
│             │ ── @mentions ──▶ Synaptic servers
│             │
│             │ ── Regular text ──▼
└─────────────┘
    │
    ▼
┌─────────────┐
│ LLM Client  │ ── Stream response
│             │
│             │ ── Tool calls ──▼
└─────────────┘
    │
    ▼
┌─────────────┐
│ Tool        │
│ Registry    │ ── Execute tools
│             │ ── Return results ──▶ Back to LLM
└─────────────┘
```

---

## Remote Mode Architecture

```
┌─────────────────────────────────────┐
│  Server PC (Mac Studio, etc.)      │
│                                     │
│  ┌─────────────┐  ┌──────────────┐ │
│  │ LM Studio   │  │ synaptic     │ │
│  │ :1234       │◀─│ serve :8080  │ │
│  │ (LLM)       │  │ (API proxy)  │ │
│  └─────────────┘  └──────────────┘ │
└─────────────────────────────────────┘
            ▲
            │ HTTPS + API Key
            │
┌───────────┴───────────┐
│  Client Device        │
│                       │
│  synaptic --remote    │
│  http://server:8080   │
└───────────────────────┘
```

---

## File Locations

- Config: `~/.synaptic/config.json`
- API Keys: `~/.synaptic/api-keys.json`
- History: `~/.synaptic/history/`

---

## Development

```bash
npm run dev      # Run with tsx (hot reload)
npm run build    # Compile TypeScript
npm run watch    # Watch mode
```

---

## Version History

- v0.1.0 - Initial release
  - LM Studio / Ollama / Cloud API support
  - File/Bash/Web tools
  - Agent mode
  - Undo system
  - i18n (English/Japanese)
  - Remote server mode
  - Synaptic ecosystem integration
