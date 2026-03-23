/**
 * LM Studio tools for model management
 */
import { EventEmitter } from 'events';
import { downloadModel, listModels, listLoadedModels, loadModel, unloadModel, isLmsInstalled, } from '../lms/client.js';
import { loadSettings } from '../config/settings.js';
// Event emitter for download progress
export const lmsEvents = new EventEmitter();
/**
 * Download models to LM Studio
 */
export const lmsGetModel = {
    definition: {
        type: 'function',
        function: {
            name: 'lms_get_model',
            description: 'Download a model to LM Studio. Use this when the user asks to install, download, or get a model. The best matching model will be automatically selected and downloaded. Examples: "qwen3.5 9b", "llama 3.1 8b", "gemma 2b".',
            parameters: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'Search query for the model. Be specific with model name and size (e.g., "qwen3.5 9b", "llama 3.1 70b", "gemma2 2b")',
                    },
                },
                required: ['query'],
            },
        },
    },
    execute: async (args) => {
        const query = args.query;
        if (!isLmsInstalled()) {
            return JSON.stringify({
                error: 'LM Studio CLI (lms) not found. Please install LM Studio from https://lmstudio.ai',
            });
        }
        if (!query.trim()) {
            return JSON.stringify({
                error: 'Please specify a model to download (e.g., "qwen3.5 9b")',
            });
        }
        // Emit download start event
        lmsEvents.emit('progress', {
            model: query,
            status: 'searching',
            message: 'Searching...',
        });
        const downloadResult = await downloadModel(query, (line) => {
            // Emit progress updates
            lmsEvents.emit('progress', {
                model: query,
                status: 'downloading',
                progress: line,
            });
        });
        if (downloadResult.success) {
            lmsEvents.emit('progress', {
                model: query,
                status: 'done',
                message: 'Download complete',
            });
            return JSON.stringify({
                success: true,
                message: downloadResult.message,
            });
        }
        else {
            lmsEvents.emit('progress', {
                model: query,
                status: 'error',
                message: downloadResult.message,
            });
            return JSON.stringify({
                error: downloadResult.message,
                suggestion: 'Try a more specific query like "qwen3.5 9b" or "llama 3.1 8b"',
            });
        }
    },
};
/**
 * List installed models in LM Studio
 */
export const lmsListModels = {
    definition: {
        type: 'function',
        function: {
            name: 'lms_list_models',
            description: 'List all models installed in LM Studio. Shows model name, size, architecture, and whether it is currently loaded.',
            parameters: {
                type: 'object',
                properties: {},
                required: [],
            },
        },
    },
    execute: async () => {
        if (!isLmsInstalled()) {
            return JSON.stringify({
                error: 'LM Studio CLI (lms) not found',
            });
        }
        const models = listModels();
        const loadedModels = listLoadedModels();
        return JSON.stringify({
            models: models.map((m) => ({
                ...m,
                loaded: loadedModels.includes(m.name),
            })),
            total: models.length,
            loaded: loadedModels,
        });
    },
};
/**
 * Load a model in LM Studio
 */
export const lmsLoadModel = {
    definition: {
        type: 'function',
        function: {
            name: 'lms_load_model',
            description: 'Load a model into memory in LM Studio. Can specify context length and GPU offload. Use this when user wants to change context size or reload a model with different settings.',
            parameters: {
                type: 'object',
                properties: {
                    model: {
                        type: 'string',
                        description: 'The model name or path to load',
                    },
                    context_length: {
                        type: 'number',
                        description: 'Context length in tokens (e.g., 8192, 16384, 32768, 65536, 131072). Larger = more memory but longer context.',
                    },
                    gpu: {
                        type: 'string',
                        description: 'GPU offload: "off" (CPU only), "max" (full GPU), or 0-1 ratio (e.g., "0.5" for 50%)',
                    },
                },
                required: ['model'],
            },
        },
    },
    execute: async (args) => {
        const model = args.model;
        let contextLength = args.context_length;
        const gpu = args.gpu;
        if (!isLmsInstalled()) {
            return JSON.stringify({ error: 'LM Studio CLI (lms) not found' });
        }
        // If no context length specified, use settings with 10% buffer
        if (!contextLength) {
            const settings = loadSettings();
            // Add 10% buffer for system prompt and overhead
            contextLength = Math.round(settings.maxContextTokens * 1.1);
        }
        // Parse GPU option
        let gpuOption;
        if (gpu === 'off' || gpu === 'max') {
            gpuOption = gpu;
        }
        else if (gpu) {
            const num = parseFloat(gpu);
            if (!isNaN(num) && num >= 0 && num <= 1) {
                gpuOption = num;
            }
        }
        // Unload current model first to free memory
        await unloadModel();
        const result = await loadModel(model, {
            contextLength,
            gpu: gpuOption,
        });
        // Emit model change event so UI can update
        if (result.success) {
            lmsEvents.emit('modelChange', { model, action: 'loaded' });
        }
        return JSON.stringify(result);
    },
};
/**
 * Unload current model in LM Studio
 */
export const lmsUnloadModel = {
    definition: {
        type: 'function',
        function: {
            name: 'lms_unload_model',
            description: 'Unload the currently loaded model from LM Studio to free up memory.',
            parameters: {
                type: 'object',
                properties: {},
                required: [],
            },
        },
    },
    execute: async () => {
        if (!isLmsInstalled()) {
            return JSON.stringify({ error: 'LM Studio CLI (lms) not found' });
        }
        const result = await unloadModel();
        return JSON.stringify(result);
    },
};
/**
 * All LM Studio tools
 */
export const lmsTools = [
    lmsGetModel,
    lmsListModels,
    lmsLoadModel,
    lmsUnloadModel,
];
//# sourceMappingURL=lmstudio.js.map