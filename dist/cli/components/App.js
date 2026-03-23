import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { Banner } from './Banner.js';
import { StatusBar } from './StatusBar.js';
import { Input } from './Input.js';
import { CommandPalette, COMMAND_NAMES } from './CommandPalette.js';
import { ModelSelector } from './ModelSelector.js';
import { ThinkingIndicator, CompactingIndicator, DownloadIndicator } from './Spinner.js';
import { ToolCallDisplay } from './ToolCall.js';
import { TodoList, TodoBar } from './TodoList.js';
import { UndoSelector } from './UndoSelector.js';
import { LanguageSelector } from './LanguageSelector.js';
import { ProviderSelector } from './ProviderSelector.js';
import { AgentView } from './AgentView.js';
import { SubAgentBar } from './SubAgentBar.js';
import { PlanView } from './PlanView.js';
import { HistorySelector } from './HistorySelector.js';
import { LicenseView } from './LicenseView.js';
import { TimelineView } from './TimelineView.js';
import { DiffView } from './DiffView.js';
import { ScrollContext } from './ScrollContext.js';
import { getTextContent, isContentEmpty } from '../../llm/types.js';
import { saveSettings, getProviderModel, setProviderModel, getClientArgs, isCloudProvider, setCloudProviderApiKey, } from '../../config/settings.js';
import { ConversationManager } from '../../core/conversation.js';
import { TodoManager } from '../../core/todo.js';
import { setTodoManager } from '../../tools/todo.js';
import { createClient } from '../../llm/client.js';
import { undoManager } from '../../core/undo.js';
import { Agent } from '../../core/agent.js';
import { extractPlanFromToolCalls, shouldRequireApproval } from '../../core/planner.js';
import { initAgentTools, updateAgentModel, agentTools, } from '../../tools/agent.js';
import * as synaptic from '../../synaptic/index.js';
import { lmsTools, lmsEvents } from '../../tools/lmstudio.js';
import { ensureContextLength, loadModel, unloadModel } from '../../lms/client.js';
import { t, format, setLanguage } from '../../i18n/index.js';
import { extractImagePaths, loadImageFromFile, getClipboardImage, toDataUrl, formatImageInfo, } from '../../utils/image.js';
/**
 * Get today's date in YYYY-MM-DD (weekday) format (local timezone)
 */
function getTodayDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weekday = weekdays[now.getDay()];
    return `${year}-${month}-${day} (${weekday})`;
}
/**
 * Set terminal tab title using escape sequences
 */
function setTerminalTitle(title) {
    // OSC 0 - Set window title (works on most terminals)
    const sanitized = title.replace(/[\x00-\x1f]/g, '').slice(0, 60);
    process.stdout.write(`\x1b]0;${sanitized}\x07`);
}
/**
 * Set terminal tab activity indicator (blue dot on macOS Terminal/iTerm2)
 * Uses progress reporting escape sequences
 */
function setTabActivity(active) {
    if (active) {
        // OSC 9 - iTerm2 notification / activity
        // Also set "working" state for terminal tabs
        process.stdout.write('\x1b]1337;RequestAttention=yes\x07');
        // Progress indicator (shows spinner/dot on some terminals)
        process.stdout.write('\x1b]9;4;1;\x07');
    }
    else {
        // Clear activity
        process.stdout.write('\x1b]1337;RequestAttention=no\x07');
        process.stdout.write('\x1b]9;4;0;\x07');
    }
}
export function App({ settings: initialSettings, client: initialClient, tools, licenseStatus, isGitRepo: initialIsGitRepo, synapticStatus: initialSynapticStatus, initialMessages }) {
    const { exit } = useApp();
    // Set language from settings on mount
    useEffect(() => {
        setLanguage(initialSettings.language);
    }, [initialSettings.language]);
    const [settings, setSettings] = useState(initialSettings);
    const [client, setClient] = useState(initialClient);
    const [viewMode, setViewMode] = useState('chat');
    const [isLoading, setIsLoading] = useState(false);
    const [loadingStartedAt, setLoadingStartedAt] = useState(null);
    const [isCompacting, setIsCompacting] = useState(false);
    const [compactingStartedAt, setCompactingStartedAt] = useState(null);
    const [messages, setMessages] = useState(() => initialMessages?.map((m, i) => ({ ...m, key: i })) ?? []);
    const [models, setModels] = useState([]);
    const [modelsLoading, setModelsLoading] = useState(false);
    const [todoManager] = useState(() => {
        const tm = new TodoManager();
        setTodoManager(tm);
        return tm;
    });
    const [conversationManager] = useState(() => {
        // Set language before creating conversation
        setLanguage(initialSettings.language);
        const cm = new ConversationManager(initialSettings);
        cm.create(format(t().systemPrompt, { cwd: process.cwd(), date: getTodayDate() }));
        return cm;
    });
    const [streamingText, setStreamingText] = useState('');
    const [lastUsage, setLastUsage] = useState(null);
    const [conversationTitle, setConversationTitle] = useState('Synaptic Code');
    const [synapticStatus, setSynapticStatus] = useState(initialSynapticStatus ?? '');
    const [todos, setTodos] = useState(todoManager.getAll());
    const [todoExpanded, setTodoExpanded] = useState(false);
    const [agentState, setAgentState] = useState(null);
    const agentRef = useRef(null);
    const [subAgentStatuses, setSubAgentStatuses] = useState(new Map());
    const completionQueueRef = useRef([]);
    const [pendingPlan, setPendingPlan] = useState(null);
    const pendingToolCallsRef = useRef(null); // Store tool calls waiting for approval
    const pendingMessageRef = useRef(null); // Store message waiting for approval
    const [autoAccept, setAutoAccept] = useState(true); // true = auto execute, false = require approval
    const [lmsDownload, setLmsDownload] = useState(null);
    const [scrollPaused, setScrollPaused] = useState(false); // Pause auto-scroll during response
    const scrollPausedRef = useRef(false); // Ref for use in callbacks
    const [isGitRepo, setIsGitRepo] = useState(initialIsGitRepo ?? false);
    // Check if current directory is a git repo (only if not provided via props)
    useEffect(() => {
        if (initialIsGitRepo !== undefined)
            return; // Skip if already provided
        import('fs').then(fs => {
            fs.access('.git', fs.constants.F_OK, (err) => {
                setIsGitRepo(!err);
            });
        });
    }, [initialIsGitRepo]);
    // Reset scroll pause when loading ends
    useEffect(() => {
        if (!isLoading) {
            setScrollPaused(false);
            scrollPausedRef.current = false;
        }
    }, [isLoading]);
    // Sync scrollPaused to ref
    useEffect(() => {
        scrollPausedRef.current = scrollPaused;
    }, [scrollPaused]);
    // Double-Esc detection
    const lastEscRef = useRef(0);
    const DOUBLE_ESC_THRESHOLD = 500; // ms
    // Double Ctrl+C detection
    const lastCtrlCRef = useRef(0);
    const DOUBLE_CTRLC_THRESHOLD = 2000; // ms
    // Ref for settings (for use in event handlers that need latest value)
    const settingsRef = useRef(settings);
    useEffect(() => {
        settingsRef.current = settings;
    }, [settings]);
    // Set initial terminal title and activity indicator
    useEffect(() => {
        setTerminalTitle('Synaptic Code');
        setTabActivity(true);
        // Initialize Synaptic ecosystem (discover Blender/Unity)
        // Skip if already provided via props to avoid re-render
        if (!initialSynapticStatus) {
            synaptic.initSynaptic().then(({ message, tools: synapticTools }) => {
                setSynapticStatus(message);
                // Register Synaptic tools dynamically
                if (synapticTools.length > 0) {
                    tools.registerMultiple(synapticTools);
                }
            });
        }
        // Register LM Studio tools for local providers
        if (!isCloudProvider(initialSettings.provider)) {
            tools.registerMultiple(lmsTools);
            // Model loading is now done before Ink starts (in index.ts)
        }
        // Initialize agent tools (for sub-agent spawning)
        initAgentTools(client, getProviderModel(initialSettings), tools, {
            maxConcurrent: 3,
            onStatusUpdate: (statuses) => {
                setSubAgentStatuses(new Map(statuses));
            },
            onCompletion: (completion) => {
                completionQueueRef.current.push(completion);
                // Show completion as info message
                const msg = completion.status === 'completed'
                    ? `Agent "${completion.agentId}" completed: ${completion.result?.slice(0, 100) || 'Done'}`
                    : `Agent "${completion.agentId}" failed: ${completion.error?.slice(0, 100) || 'Error'}`;
                setMessages(prev => [...prev, { type: 'info', content: msg }]);
            },
        });
        tools.registerMultiple(agentTools);
        // Listen for LMS download progress
        const handleLmsProgress = (progress) => {
            setLmsDownload(progress);
            // Clear after done/error
            if (progress.status === 'done' || progress.status === 'error') {
                setTimeout(() => setLmsDownload(null), 3000);
            }
        };
        lmsEvents.on('progress', handleLmsProgress);
        // Listen for model changes from tools
        const handleModelChange = (change) => {
            if (change.action === 'loaded') {
                // Update settings with new model (use ref for latest value)
                const currentSettings = settingsRef.current;
                const newSettings = { ...currentSettings };
                setProviderModel(newSettings, change.model);
                setSettings(newSettings);
                saveSettings(newSettings);
                // Update client
                const { baseUrlOrApiKey, model } = getClientArgs(newSettings);
                setClient(createClient(newSettings.provider, baseUrlOrApiKey, model));
                // Update agent tools model
                updateAgentModel(change.model);
            }
        };
        lmsEvents.on('modelChange', handleModelChange);
        return () => {
            lmsEvents.off('progress', handleLmsProgress);
            lmsEvents.off('modelChange', handleModelChange);
            // Save conversation on exit (Ctrl+C, etc.)
            if (conversationManager.getMessageCount() > 1) {
                conversationManager.save();
            }
            // Reset on unmount
            setTerminalTitle('Terminal');
            setTabActivity(false);
        };
    }, [tools, conversationManager]);
    // AbortController for cancelling requests
    const abortControllerRef = useRef(null);
    // Throttle streaming updates to prevent flickering
    const streamBufferRef = useRef('');
    const lastUpdateRef = useRef(0);
    const UPDATE_INTERVAL = 50; // ms
    const updateStreamingText = useCallback((text) => {
        streamBufferRef.current = text;
        // Don't update UI when scroll is paused (allows terminal scrollback)
        if (scrollPausedRef.current)
            return;
        const now = Date.now();
        if (now - lastUpdateRef.current >= UPDATE_INTERVAL) {
            lastUpdateRef.current = now;
            setStreamingText(text);
        }
    }, []);
    // Flush remaining buffer
    const flushStreamingText = useCallback(() => {
        if (streamBufferRef.current) {
            setStreamingText(streamBufferRef.current);
            streamBufferRef.current = '';
        }
    }, []);
    function getSystemPrompt() {
        return format(t().systemPrompt, { cwd: process.cwd(), date: getTodayDate() });
    }
    const addMessage = useCallback((msg) => {
        // Skip empty assistant messages
        if (msg.type === 'assistant' && (!msg.content || !msg.content.trim())) {
            return;
        }
        setMessages(prev => [...prev, msg]);
    }, []);
    // Execute tool calls and add results to conversation
    const executeToolCalls = useCallback(async (msg) => {
        if (!msg.tool_calls)
            return;
        conversationManager.addMessage(msg);
        for (const tc of msg.tool_calls) {
            setMessages(prev => [...prev, {
                    type: 'tool',
                    content: tc.function.arguments,
                    toolName: tc.function.name,
                    isExecuting: true,
                }]);
            const result = await tools.execute(tc);
            // Update tool message with result
            setMessages(prev => prev.map((m, i) => i === prev.length - 1 && m.isExecuting
                ? { ...m, isExecuting: false, result }
                : m));
            setTodos(todoManager.getAll());
            conversationManager.addMessage({
                role: 'tool',
                tool_call_id: tc.id,
                content: result,
            });
        }
    }, [tools, conversationManager, todoManager]);
    // Continue conversation after tool execution
    const continueAfterTools = useCallback(async (signal) => {
        setIsLoading(true);
        // Don't reset loadingStartedAt - keep counting from initial request
        let fullResponse = '';
        streamBufferRef.current = '';
        const followUp = await client.chatStream({
            model: getProviderModel(settings),
            messages: conversationManager.getContextMessages(),
            tools: tools.getDefinitions(),
        }, (chunk) => {
            fullResponse += chunk;
            updateStreamingText(fullResponse);
        }, signal);
        setStreamingText('');
        streamBufferRef.current = '';
        const { message: followUpMessage, usage: followUpUsage } = followUp;
        if (followUpUsage) {
            setLastUsage({ prompt: followUpUsage.prompt_tokens, completion: followUpUsage.completion_tokens });
            conversationManager.updateTokenCount(followUpUsage.prompt_tokens, followUpUsage.completion_tokens);
        }
        // Check if there are more tool calls
        if (followUpMessage.tool_calls && followUpMessage.tool_calls.length > 0) {
            if (followUpMessage.content && !isContentEmpty(followUpMessage.content)) {
                addMessage({ type: 'assistant', content: getTextContent(followUpMessage.content) });
                followUpMessage.content = '';
            }
            return followUpMessage;
        }
        // Final response
        const finalContent = getTextContent(followUpMessage.content || '') || fullResponse;
        if (finalContent && finalContent.trim()) {
            addMessage({ type: 'assistant', content: finalContent });
            conversationManager.addMessage({ ...followUpMessage, content: finalContent });
        }
        else {
            // Empty response from model after tool execution - prompt for continuation
            // This can happen with smaller models (9B etc.) that struggle after multiple tool calls
            addMessage({ type: 'info', content: '(waiting for response...)' });
            // Add a nudge message to prompt the model
            conversationManager.addMessage({
                role: 'user',
                content: 'Please summarize the results from the tools above.',
            });
            // Retry once
            const retry = await client.chatStream({
                model: getProviderModel(settings),
                messages: conversationManager.getContextMessages(),
                tools: tools.getDefinitions(),
            }, (chunk) => {
                fullResponse += chunk;
                updateStreamingText(fullResponse);
            }, signal);
            setStreamingText('');
            const retryContent = getTextContent(retry.message.content || '');
            if (retryContent && retryContent.trim()) {
                // Remove the nudge message from display
                setMessages(prev => prev.filter(m => m.content !== '(waiting for response...)'));
                addMessage({ type: 'assistant', content: retryContent });
                conversationManager.addMessage(retry.message);
            }
        }
        setIsLoading(false);
        setLoadingStartedAt(null);
        return followUpMessage;
    }, [client, settings, tools, conversationManager, updateStreamingText, addMessage]);
    // Handle plan approval
    const handlePlanApproval = useCallback(async () => {
        if (!pendingToolCallsRef.current || !pendingMessageRef.current)
            return;
        setViewMode('chat');
        setIsLoading(true);
        setLoadingStartedAt(Date.now());
        try {
            const abortController = new AbortController();
            abortControllerRef.current = abortController;
            await executeToolCalls(pendingMessageRef.current);
            let currentMessage = await continueAfterTools(abortController.signal);
            while (currentMessage.tool_calls && currentMessage.tool_calls.length > 0) {
                if (shouldRequireApproval(currentMessage.tool_calls)) {
                    const plan = extractPlanFromToolCalls(currentMessage.tool_calls);
                    setPendingPlan(plan.steps);
                    pendingToolCallsRef.current = currentMessage.tool_calls;
                    pendingMessageRef.current = currentMessage;
                    setViewMode('approval');
                    setIsLoading(false);
                    return;
                }
                await executeToolCalls(currentMessage);
                currentMessage = await continueAfterTools(abortController.signal);
            }
            // Create undo point after successful tool execution
            undoManager.createUndoPoint('Tool execution', conversationManager.getMessageCount(), conversationManager.getMessages());
        }
        catch (error) {
            addMessage({
                type: 'error',
                content: `Error: ${error instanceof Error ? error.message : String(error)}`,
            });
        }
        finally {
            abortControllerRef.current = null;
            setIsLoading(false);
            setLoadingStartedAt(null);
            setPendingPlan(null);
            pendingToolCallsRef.current = null;
            pendingMessageRef.current = null;
        }
    }, [executeToolCalls, continueAfterTools, addMessage, conversationManager]);
    // Handle plan rejection
    const handlePlanRejection = useCallback(() => {
        setViewMode('chat');
        setPendingPlan(null);
        pendingToolCallsRef.current = null;
        pendingMessageRef.current = null;
        addMessage({ type: 'info', content: t().messages.planRejected });
    }, [addMessage]);
    const handleSubmit = useCallback(async (input) => {
        if (!input.trim())
            return;
        // Check for slash command
        if (input.startsWith('/')) {
            const [cmdPart] = input.slice(1).split(/\s+/);
            if (COMMAND_NAMES.has(cmdPart.toLowerCase())) {
                await handleCommand(input.slice(1));
                return;
            }
            // Not a known command, treat as regular message (e.g., /path/to/file)
        }
        // Check for @blender or @unity mentions - direct execution
        if (input.trim().startsWith('@blender') || input.trim().startsWith('@unity')) {
            addMessage({ type: 'user', content: input });
            const { handled, results, remainingText, formatted } = await synaptic.processMentions(input);
            if (handled && results) {
                // Show execution results
                for (const { command, result } of results) {
                    if (result.success) {
                        addMessage({
                            type: 'info',
                            content: `@${command.server} ${command.tool}: ${JSON.stringify(result.result)}`,
                        });
                    }
                    else {
                        addMessage({
                            type: 'error',
                            content: `@${command.server} ${command.tool}: ${result.error}`,
                        });
                    }
                }
                // If there's remaining text, continue to LLM
                if (!remainingText.trim()) {
                    return;
                }
                // Fall through with remaining text
            }
        }
        // Check for image paths in input
        const imagePaths = extractImagePaths(input);
        const images = [];
        for (const imgPath of imagePaths) {
            const img = loadImageFromFile(imgPath);
            if (img) {
                images.push(img);
                addMessage({ type: 'info', content: formatImageInfo(img) });
            }
        }
        // Check for /paste command to get clipboard image
        if (input.trim() === '/paste' || input.includes('@clipboard')) {
            const clipImg = getClipboardImage();
            if (clipImg) {
                images.push(clipImg);
                addMessage({ type: 'info', content: formatImageInfo(clipImg) });
            }
            else {
                addMessage({ type: 'error', content: 'No image in clipboard' });
                if (input.trim() === '/paste')
                    return;
            }
        }
        // Build message content (text + images)
        let messageContent;
        const textContent = input
            .replace(/@clipboard/g, '')
            .replace(/\/paste/g, '')
            .trim();
        if (images.length > 0) {
            // Multimodal message
            const parts = [];
            if (textContent) {
                parts.push({ type: 'text', text: textContent });
            }
            for (const img of images) {
                parts.push({
                    type: 'image_url',
                    image_url: { url: toDataUrl(img), detail: 'auto' },
                });
            }
            messageContent = parts;
            addMessage({ type: 'user', content: textContent || `[${images.length} image(s)]` });
        }
        else {
            messageContent = input;
            addMessage({ type: 'user', content: input });
        }
        conversationManager.addMessage({ role: 'user', content: messageContent });
        // Update terminal title with user message (conversation topic)
        // Always update to show current topic
        const title = input.length > 40 ? input.slice(0, 40) + '...' : input;
        setConversationTitle(title);
        setTerminalTitle(`Synaptic: ${title}`);
        // Track files for undo (snapshot will be created after response)
        // We create undo point after successful response so fork restores complete turn
        // Create new AbortController for this request
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;
        setIsLoading(true);
        setLoadingStartedAt(Date.now());
        setStreamingText('');
        try {
            // For LM Studio, ensure model has sufficient context length
            if (settings.provider === 'lmstudio') {
                const requiredContext = Math.round(settings.maxContextTokens * 1.1);
                const targetModel = getProviderModel(settings);
                const ctxResult = await ensureContextLength(requiredContext, targetModel);
                if (ctxResult.reloaded) {
                    addMessage({ type: 'info', content: `Model reloaded with context: ${ctxResult.context}` });
                }
                else if (!ctxResult.ok) {
                    addMessage({ type: 'error', content: ctxResult.message });
                }
            }
            const contextMessages = conversationManager.getContextMessages();
            let fullResponse = '';
            const response = await client.chatStream({
                model: getProviderModel(settings),
                messages: contextMessages,
                tools: tools.getDefinitions(),
            }, (chunk) => {
                fullResponse += chunk;
                updateStreamingText(fullResponse);
            }, signal);
            const { message, usage } = response;
            // Update usage display and actual token count
            if (usage) {
                setLastUsage({ prompt: usage.prompt_tokens, completion: usage.completion_tokens });
                conversationManager.updateTokenCount(usage.prompt_tokens, usage.completion_tokens);
            }
            // Process tool calls in a loop (LLM may call multiple rounds of tools)
            let currentMessage = message;
            while (currentMessage.tool_calls && currentMessage.tool_calls.length > 0) {
                // Clear streaming text before processing tool calls
                setStreamingText('');
                // Save any text content before tool calls (LLM may explain what it's doing)
                if (currentMessage.content && !isContentEmpty(currentMessage.content)) {
                    addMessage({ type: 'assistant', content: getTextContent(currentMessage.content) });
                }
                // Check if approval is needed (only when autoAccept is off)
                if (!autoAccept && shouldRequireApproval(currentMessage.tool_calls)) {
                    // Extract plan and show for approval
                    const plan = extractPlanFromToolCalls(currentMessage.tool_calls);
                    setPendingPlan(plan.steps);
                    pendingToolCallsRef.current = currentMessage.tool_calls;
                    pendingMessageRef.current = currentMessage;
                    setViewMode('approval');
                    setIsLoading(false);
                    return; // Wait for approval callback
                }
                // Execute tools directly
                await executeToolCalls(currentMessage);
                currentMessage = await continueAfterTools(signal);
                if (!currentMessage.tool_calls || currentMessage.tool_calls.length === 0) {
                    break;
                }
            }
            // No tool calls - just text response
            if (!message.tool_calls || message.tool_calls.length === 0) {
                flushStreamingText();
                setStreamingText('');
                if (message.content && !isContentEmpty(message.content)) {
                    const textContent = getTextContent(message.content);
                    addMessage({ type: 'assistant', content: textContent });
                    conversationManager.addMessage(message);
                }
            }
            // Auto-compact for local providers when threshold exceeded
            if (!isCloudProvider(settings.provider)) {
                const tokenCount = conversationManager.getTokenCount();
                const threshold = settings.autoCompactThreshold || 8000;
                if (tokenCount > threshold && !conversationManager.isCompressed()) {
                    setIsCompacting(true);
                    setCompactingStartedAt(Date.now());
                    try {
                        const result = await conversationManager.compactWithLLM(client, getProviderModel(settings));
                        if (result.removed > 0) {
                            addMessage({
                                type: 'info',
                                content: `Auto-compacted: ${result.before} → ${result.after} messages`,
                            });
                        }
                    }
                    catch (compactError) {
                        // Silent fail - don't interrupt the user
                        console.error('Auto-compact failed:', compactError);
                    }
                    finally {
                        setIsCompacting(false);
                        setCompactingStartedAt(null);
                    }
                }
            }
            // Create undo point AFTER successful response (so fork restores complete turn including this response)
            undoManager.createUndoPoint(input, conversationManager.getMessageCount(), conversationManager.getMessages());
        }
        catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                // Request was cancelled - message already shown by cancelRequest
                // Add partial response if any
                if (streamBufferRef.current) {
                    conversationManager.addMessage({
                        role: 'assistant',
                        content: streamBufferRef.current + ' [cancelled]',
                    });
                }
            }
            else {
                addMessage({
                    type: 'error',
                    content: `Error: ${error instanceof Error ? error.message : String(error)}`,
                });
            }
        }
        finally {
            abortControllerRef.current = null;
            setIsLoading(false);
            setLoadingStartedAt(null);
            setStreamingText('');
        }
    }, [client, settings, tools, conversationManager, addMessage, updateStreamingText, flushStreamingText]);
    const handleCommand = async (cmd) => {
        const [command, ...args] = cmd.split(' ');
        switch (command.toLowerCase()) {
            case 'quit':
            case 'q':
            case 'exit':
                // Save conversation before exiting
                if (conversationManager.getMessageCount() > 1) {
                    conversationManager.save();
                }
                // Unload model to free memory (LM Studio)
                if (settings.provider === 'lmstudio') {
                    addMessage({ type: 'info', content: 'Unloading model...' });
                    await unloadModel();
                }
                exit();
                break;
            case 'clear':
            case 'c':
                setMessages([]);
                break;
            case 'new':
            case 'n':
                // Save current conversation before starting new one
                if (conversationManager.getMessageCount() > 1) {
                    conversationManager.save();
                }
                conversationManager.create(getSystemPrompt());
                setMessages([]);
                setConversationTitle('Synaptic Code');
                setTerminalTitle('Synaptic Code');
                undoManager.clear(); // Clear undo history on new conversation
                addMessage({ type: 'info', content: 'Started new conversation' });
                break;
            case 'model':
            case 'm':
                setModelsLoading(true);
                setViewMode('models');
                try {
                    const modelList = await client.listModels();
                    setModels(modelList);
                }
                catch {
                    addMessage({ type: 'error', content: 'Failed to fetch models' });
                    setViewMode('chat');
                }
                finally {
                    setModelsLoading(false);
                }
                break;
            case 'todo':
            case 'todos':
                setViewMode('todo');
                break;
            case 'compact': {
                // Extract optional focus from args: /compact focus on API changes
                const focus = args.length > 0 ? args.join(' ') : undefined;
                setIsLoading(true);
                addMessage({ type: 'info', content: 'Compacting conversation...' });
                try {
                    const result = await conversationManager.compactWithLLM(client, getProviderModel(settings), focus);
                    if (result.removed > 0) {
                        addMessage({
                            type: 'info',
                            content: `Compacted: ${result.before} → ${result.after} messages (${result.removed} removed)\n\nSummary:\n${result.summary.slice(0, 500)}${result.summary.length > 500 ? '...' : ''}`,
                        });
                    }
                    else {
                        addMessage({
                            type: 'info',
                            content: 'Nothing to compact (need more context or conversation turns)',
                        });
                    }
                }
                catch (error) {
                    addMessage({
                        type: 'error',
                        content: `Compact failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    });
                }
                finally {
                    setIsLoading(false);
                }
                break;
            }
            case 'agent':
            case 'a': {
                // Agent mode: /agent <goal>
                const goal = args.join(' ');
                if (!goal) {
                    addMessage({
                        type: 'info',
                        content: 'Usage: /agent <goal>\nExample: /agent Create a red cube in Blender at position (0,0,1)',
                    });
                    break;
                }
                // Create and start agent
                const agent = new Agent(client, getProviderModel(settings), tools, {
                    maxIterations: 30,
                    stopOnError: false,
                });
                agentRef.current = agent;
                // Set up event handler for real-time updates
                agent.onStep((_step, state) => {
                    setAgentState({ ...state });
                });
                setViewMode('agent');
                setAgentState(agent.getState());
                // Run agent asynchronously
                agent.run(goal).then((finalState) => {
                    setAgentState(finalState);
                    agentRef.current = null;
                    // Add result to messages
                    if (finalState.status === 'completed') {
                        addMessage({
                            type: 'info',
                            content: `Agent completed: ${finalState.result || 'Task done'}`,
                        });
                    }
                    else if (finalState.status === 'failed') {
                        addMessage({
                            type: 'error',
                            content: `Agent failed: ${finalState.error || 'Unknown error'}`,
                        });
                    }
                });
                break;
            }
            case 'help':
            case 'h':
            case '?':
                addMessage({
                    type: 'info',
                    content: `Commands: /model, /provider, /new, /clear, /compact, /agent, /todo, /language, /tools, /config, /synaptic, /quit\n/agent <goal> - Run autonomous agent mode\n@blender <tool> - Execute Blender tool\n@unity <tool> - Execute Unity tool\n\nNote: Destructive operations (file writes, shell commands) require approval.`,
                });
                break;
            case 'synaptic':
            case 'syn':
                // Refresh Synaptic connection
                setIsLoading(true);
                synaptic.initSynaptic().then(({ message, blender, unity, tools: synapticTools }) => {
                    setSynapticStatus(message);
                    // Re-register Synaptic tools
                    tools.unregisterMultiple(['blender_execute', 'blender_list_tools', 'unity_execute', 'unity_list_tools']);
                    if (synapticTools.length > 0) {
                        tools.registerMultiple(synapticTools);
                    }
                    addMessage({
                        type: 'info',
                        content: `${message}\nBlender: ${blender ? 'connected' : 'disconnected'}\nUnity: ${unity ? 'connected' : 'disconnected'}\nLLM tools: ${synapticTools.map(t => t.definition.function.name).join(', ') || 'none'}`,
                    });
                    setIsLoading(false);
                });
                break;
            case 'tools':
                addMessage({
                    type: 'info',
                    content: `Available tools: ${tools.list().join(', ')}`,
                });
                break;
            case 'config':
                addMessage({
                    type: 'info',
                    content: `Provider: ${settings.provider}, Model: ${getProviderModel(settings)}`,
                });
                break;
            case 'language':
            case 'lang':
            case 'l':
                setViewMode('language');
                break;
            case 'provider':
            case 'p':
                setViewMode('provider');
                break;
            case 'history':
            case 'hist':
                setViewMode('history');
                break;
            case 'timeline':
            case 'tl':
                setViewMode('timeline');
                break;
            case 'diff':
                setViewMode('diff');
                break;
            case 'license':
                setViewMode('license');
                break;
            case 'self':
            case 'meta': {
                // Load Synaptic Code system documentation into context for LLM self-awareness
                // Dynamically resolve root from the running script location
                const path = await import('path');
                const url = await import('url');
                const __filename = url.fileURLToPath(import.meta.url);
                const synapticRoot = path.resolve(path.dirname(__filename), '..', '..', '..');
                const systemDoc = `${synapticRoot}/SYNAPTIC_SYSTEM.md`;
                const archDoc = `${synapticRoot}/ARCHITECTURE.md`;
                let docContent = '';
                try {
                    const fs = await import('fs');
                    if (fs.existsSync(systemDoc)) {
                        docContent += fs.readFileSync(systemDoc, 'utf-8');
                    }
                    if (fs.existsSync(archDoc)) {
                        docContent += '\n\n---\n\n' + fs.readFileSync(archDoc, 'utf-8');
                    }
                }
                catch {
                    docContent = 'Failed to read system documentation.';
                }
                // Add to conversation as system context
                const selfPrompt = `You are now aware of your own implementation. Here is your system documentation:\n\n${docContent}\n\nYou can now:\n1. Modify your own code in ${synapticRoot}/src/\n2. Add new tools or features\n3. Fix bugs in your implementation\n4. Explain your architecture to the user`;
                conversationManager.addMessage({ role: 'user', content: selfPrompt });
                addMessage({
                    type: 'info',
                    content: `Self-awareness mode activated.\nLoaded: SYNAPTIC_SYSTEM.md, ARCHITECTURE.md\nRoot: ${synapticRoot}\n\nYou can now ask me to modify my own code.`,
                });
                break;
            }
            default:
                addMessage({ type: 'error', content: `Unknown command: ${command}` });
        }
    };
    const handleLanguageSelect = (lang) => {
        setLanguage(lang);
        const newSettings = { ...settings, language: lang };
        setSettings(newSettings);
        saveSettings(newSettings);
        // Update system prompt for new language
        conversationManager.updateSystemPrompt(format(t().systemPrompt, { cwd: process.cwd(), date: getTodayDate() }));
        addMessage({ type: 'info', content: `Language changed to: ${t().languageName}` });
        setViewMode('chat');
    };
    const handleModelSelect = async (model) => {
        setViewMode('chat');
        const newSettings = { ...settings };
        setProviderModel(newSettings, model);
        setSettings(newSettings);
        saveSettings(newSettings);
        const { baseUrlOrApiKey, model: newModel } = getClientArgs(newSettings);
        setClient(createClient(newSettings.provider, baseUrlOrApiKey, newModel));
        // Update agent tools model
        updateAgentModel(model);
        // For LM Studio, unload current model and load new one
        if (newSettings.provider === 'lmstudio') {
            // Unload current model first to free memory
            addMessage({ type: 'info', content: 'Unloading current model...' });
            await unloadModel();
            const contextLength = Math.round(newSettings.maxContextTokens * 1.1);
            addMessage({ type: 'info', content: `Loading ${model} (ctx: ${contextLength})...` });
            const result = await loadModel(model, { contextLength });
            if (result.success) {
                addMessage({ type: 'info', content: `Model loaded: ${model}` });
            }
            else {
                addMessage({ type: 'error', content: `Failed to load: ${result.message}` });
            }
        }
        else {
            addMessage({ type: 'info', content: `Model changed to: ${model}` });
        }
    };
    const handleProviderSelect = (provider, apiKey) => {
        const newSettings = { ...settings, provider };
        // Save API key if provided
        if (apiKey && isCloudProvider(provider)) {
            setCloudProviderApiKey(newSettings, provider, apiKey);
        }
        setSettings(newSettings);
        saveSettings(newSettings);
        const { baseUrlOrApiKey, model } = getClientArgs(newSettings);
        setClient(createClient(provider, baseUrlOrApiKey, model));
        addMessage({
            type: 'info',
            content: `Provider changed to: ${provider}${isCloudProvider(provider) ? ' (cloud)' : ' (local)'}\nModel: ${model}`,
        });
        setViewMode('chat');
    };
    // History management
    const getHistoryList = useCallback(() => {
        return conversationManager.list();
    }, [conversationManager]);
    const handleHistorySelect = useCallback((id) => {
        const loaded = conversationManager.load(id);
        if (loaded) {
            // Rebuild display messages from loaded conversation
            const displayMsgs = [];
            for (const msg of loaded.messages) {
                if (msg.role === 'user') {
                    displayMsgs.push({ type: 'user', content: getTextContent(msg.content) });
                }
                else if (msg.role === 'assistant') {
                    const content = getTextContent(msg.content);
                    if (content) {
                        displayMsgs.push({ type: 'assistant', content });
                    }
                }
            }
            setMessages(displayMsgs);
            setConversationTitle(loaded.title);
            setTerminalTitle(loaded.title);
            undoManager.clear();
            addMessage({ type: 'info', content: `Loaded: ${loaded.title}` });
        }
        else {
            addMessage({ type: 'error', content: 'Failed to load conversation' });
        }
        setViewMode('chat');
    }, [conversationManager, addMessage]);
    const handleHistoryDelete = useCallback((id) => {
        // TODO: implement delete in ConversationManager
        addMessage({ type: 'info', content: 'Delete not yet implemented' });
    }, [addMessage]);
    const handleCommandSelect = (command) => {
        setViewMode('chat');
        handleCommand(command);
    };
    const handleRestore = (pointId, mode) => {
        if (mode === 'cancel') {
            setViewMode('chat');
            return;
        }
        const results = [];
        // Undo code if requested
        if (mode === 'fork-both' || mode === 'undo-code') {
            const { restored, errors } = undoManager.restoreFiles(pointId);
            if (restored.length > 0) {
                results.push(`Restored ${restored.length} file(s)`);
            }
            if (errors.length > 0) {
                results.push(`Errors: ${errors.join(', ')}`);
            }
        }
        // Fork conversation if requested (go back to that point, but it's a new branch)
        if (mode === 'fork-both' || mode === 'fork-conversation') {
            // Try to use full snapshot first (preserves pre-compact state)
            const snapshot = undoManager.getConversationSnapshotAt(pointId);
            if (snapshot && snapshot.length > 0) {
                // Restore from full snapshot
                const currentCount = conversationManager.getMessageCount();
                const removed = currentCount - snapshot.length;
                // Replace conversation with snapshot
                conversationManager.restoreFromSnapshot(snapshot);
                // Rebuild display messages from snapshot
                const displayMsgs = [];
                for (const msg of snapshot) {
                    if (msg.role === 'user') {
                        displayMsgs.push({ type: 'user', content: getTextContent(msg.content) });
                    }
                    else if (msg.role === 'assistant') {
                        const content = getTextContent(msg.content);
                        if (content) {
                            displayMsgs.push({ type: 'assistant', content });
                        }
                    }
                    // Skip system and tool messages for display
                }
                setMessages(displayMsgs);
                // Clear undo points newer than this one (we're forking from here)
                undoManager.truncateAfterPoint(pointId);
                results.push(format(t().messages.forkedConversation, { count: Math.max(0, removed) }));
            }
            else {
                // Fallback to count-based truncation
                const targetCount = undoManager.getConversationCountAt(pointId);
                if (targetCount !== null && targetCount < messages.length) {
                    const removed = messages.length - targetCount;
                    setMessages(prev => prev.slice(0, targetCount));
                    conversationManager.truncateToCount(targetCount);
                    undoManager.truncateAfterPoint(pointId);
                    results.push(format(t().messages.forkedConversation, { count: removed }));
                }
            }
        }
        setViewMode('chat');
        addMessage({
            type: 'info',
            content: results.length > 0 ? results.join('. ') : 'Nothing to restore',
        });
    };
    // Cancel current request
    const cancelRequest = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            // Force UI update immediately
            setIsLoading(false);
            setLoadingStartedAt(null);
            setStreamingText('');
            addMessage({ type: 'info', content: t().messages.responseCancelled });
        }
    }, [addMessage]);
    // Global key handler
    useInput((input, key) => {
        if (key.escape) {
            const now = Date.now();
            if (isLoading) {
                // Cancel ongoing request
                cancelRequest();
                lastEscRef.current = 0;
            }
            else if (viewMode !== 'chat') {
                setViewMode('chat');
                lastEscRef.current = 0;
            }
            else {
                // Check for double-Esc
                if (now - lastEscRef.current < DOUBLE_ESC_THRESHOLD) {
                    // Double Esc detected - show undo selector
                    if (undoManager.hasUndoPoints()) {
                        setViewMode('undo');
                    }
                    else {
                        addMessage({ type: 'info', content: 'No undo points available' });
                    }
                    lastEscRef.current = 0;
                }
                else {
                    lastEscRef.current = now;
                }
            }
        }
        // Toggle TODO expansion with 't' key (only in chat mode, not loading)
        if (input === 't' && viewMode === 'chat' && !isLoading) {
            setTodoExpanded(prev => !prev);
        }
        // Shift+Tab to toggle auto-accept mode
        if (key.tab && key.shift && viewMode === 'chat' && !isLoading) {
            setAutoAccept(prev => {
                const newValue = !prev;
                addMessage({
                    type: 'info',
                    content: newValue ? t().messages.autoAcceptOn : t().messages.autoAcceptOff,
                });
                return newValue;
            });
        }
        // Ctrl+C to exit (double press required)
        if (input === 'c' && key.ctrl) {
            const now = Date.now();
            if (now - lastCtrlCRef.current < DOUBLE_CTRLC_THRESHOLD) {
                // Double Ctrl+C - save, unload, and exit
                if (conversationManager.getMessageCount() > 1) {
                    conversationManager.save();
                }
                // Unload model to free memory (async but don't wait)
                if (settings.provider === 'lmstudio') {
                    unloadModel();
                }
                exit();
            }
            else {
                lastCtrlCRef.current = now;
                addMessage({ type: 'info', content: 'Press Ctrl+C again to exit' });
            }
            return;
        }
        // Space to toggle scroll pause during response (loading only, so no input conflict)
        if (input === ' ' && isLoading) {
            setScrollPaused(prev => !prev);
        }
    });
    const currentModel = getProviderModel(settings);
    // Display all messages (no limit for now)
    const displayMessages = messages;
    // Helper to render a message
    const renderMessage = (msg, idx) => {
        const prevMsg = idx > 0 ? displayMessages[idx - 1] : null;
        // Add margin before:
        // - user message if previous was assistant
        // - assistant if previous was tool
        // - tool if previous was assistant or tool
        const marginBefore = (msg.type === 'user' && prevMsg?.type === 'assistant') ||
            (msg.type === 'assistant' && prevMsg?.type === 'tool') ||
            (msg.type === 'tool' && (prevMsg?.type === 'assistant' || prevMsg?.type === 'tool'));
        // Add margin after user message
        const marginAfter = msg.type === 'user';
        return (_jsxs(Box, { marginY: 0, marginTop: marginBefore ? 1 : 0, marginBottom: marginAfter ? 1 : 0, flexDirection: "column", children: [msg.type === 'user' && (_jsxs(Box, { children: [_jsx(Text, { bold: true, color: "blue", children: "\u276F " }), _jsx(Text, { children: msg.content })] })), msg.type === 'assistant' && msg.content && msg.content.trim() && (_jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { bold: true, color: "green", children: "\u25C6 Assistant" }), _jsx(Box, { paddingLeft: 2, children: _jsx(Text, { wrap: "wrap", children: msg.content.trim() }) })] })), msg.type === 'tool' && (_jsx(ToolCallDisplay, { name: msg.toolName || 'tool', args: msg.content, result: msg.result, isExecuting: msg.isExecuting })), msg.type === 'error' && (_jsxs(Text, { color: "red", children: ["\u2717 ", msg.content] })), msg.type === 'info' && (_jsxs(Text, { color: "cyan", children: ["\u2139 ", msg.content] }))] }, idx));
    };
    const scrollContextValue = useMemo(() => ({ paused: scrollPaused }), [scrollPaused]);
    return (_jsx(ScrollContext.Provider, { value: scrollContextValue, children: _jsxs(Box, { flexDirection: "column", padding: 1, children: [_jsx(Banner, { cwd: process.cwd(), isGitRepo: isGitRepo, licenseStatus: licenseStatus }), _jsx(Box, { flexDirection: "column", marginY: 1, children: displayMessages.map((msg, idx) => renderMessage(msg, idx)) }), streamingText && (_jsxs(Box, { flexDirection: "column", marginY: 1, children: [_jsx(Text, { bold: true, color: "green", children: "\u25C6 Assistant" }), scrollPaused && _jsx(Text, { dimColor: true, children: " [paused]" }), _jsx(Box, { paddingLeft: 4, children: _jsx(Text, { wrap: "wrap", children: streamingText.length > 2000
                                    ? '...' + streamingText.slice(-2000).trim()
                                    : streamingText.trim() }) })] })), isLoading && !streamingText && _jsx(ThinkingIndicator, {}), isCompacting && _jsx(CompactingIndicator, { startedAt: compactingStartedAt ?? undefined }), lmsDownload && (_jsx(DownloadIndicator, { model: lmsDownload.model, status: lmsDownload.status, progress: lmsDownload.progress, message: lmsDownload.message })), viewMode === 'commands' && (_jsx(CommandPalette, { onSelect: handleCommandSelect, onClose: () => setViewMode('chat') })), viewMode === 'models' && (_jsx(ModelSelector, { models: models, currentModel: currentModel, loading: modelsLoading, onSelect: handleModelSelect, onClose: () => setViewMode('chat') })), viewMode === 'todo' && (_jsxs(Box, { marginY: 1, children: [_jsx(TodoList, { todos: todos }), _jsx(Box, { marginTop: 1, children: _jsx(Text, { dimColor: true, children: "Press Esc to close" }) })] })), viewMode === 'undo' && (_jsx(UndoSelector, { undoPoints: undoManager.getUndoPoints(), onRestore: handleRestore, onClose: () => setViewMode('chat') })), viewMode === 'language' && (_jsx(LanguageSelector, { onSelect: handleLanguageSelect, onClose: () => setViewMode('chat') })), viewMode === 'provider' && (_jsx(ProviderSelector, { currentProvider: settings.provider, apiKeys: {
                        openai: settings.cloudProviders?.openai?.apiKey,
                        anthropic: settings.cloudProviders?.anthropic?.apiKey,
                        google: settings.cloudProviders?.google?.apiKey,
                    }, onSelect: handleProviderSelect, onClose: () => setViewMode('chat') })), viewMode === 'agent' && agentState && (_jsx(AgentView, { state: agentState, onCancel: () => {
                        agentRef.current?.cancel();
                        setViewMode('chat');
                    } })), viewMode === 'approval' && pendingPlan && (_jsx(PlanView, { items: pendingPlan, onApprove: () => handlePlanApproval(), onApproveAll: () => handlePlanApproval(), onReject: handlePlanRejection })), viewMode === 'history' && (_jsx(HistorySelector, { items: getHistoryList(), onSelect: handleHistorySelect, onClose: () => setViewMode('chat'), onDelete: handleHistoryDelete })), viewMode === 'license' && (_jsx(LicenseView, { onClose: () => setViewMode('chat'), onMessage: (type, content) => addMessage({ type, content }) })), viewMode === 'timeline' && (_jsx(TimelineView, { undoPoints: undoManager.getUndoPoints(), onClose: () => setViewMode('chat') })), viewMode === 'diff' && (_jsx(DiffView, { undoPoints: undoManager.getUndoPoints(), onClose: () => setViewMode('chat') })), viewMode === 'chat' && (_jsx(Box, { marginTop: 1, children: _jsx(Input, { onSubmit: handleSubmit, loading: isLoading, loadingStartedAt: loadingStartedAt ?? undefined, placeholder: t().ui.inputPlaceholder }) })), _jsx(StatusBar, { provider: settings.provider, model: currentModel, toolCount: tools.list().length, tokenCount: conversationManager.getTokenCount(), maxTokens: conversationManager.getMaxTokens(), isCompressed: conversationManager.isCompressed(), lastUsage: lastUsage, autoAccept: autoAccept, isLoading: isLoading }), _jsx(TodoBar, { todos: todos, expanded: todoExpanded, onToggle: () => setTodoExpanded(prev => !prev) }), subAgentStatuses.size > 0 && (_jsx(SubAgentBar, { statuses: subAgentStatuses })), synapticStatus && (_jsx(Text, { dimColor: true, color: "magenta", children: synapticStatus }))] }) }));
}
//# sourceMappingURL=App.js.map