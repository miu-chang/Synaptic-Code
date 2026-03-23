/**
 * LM Studio CLI (lms) integration
 * Wraps lms commands for server/model management
 */
export interface LmsModel {
    name: string;
    params: string;
    arch: string;
    size: string;
    loaded: boolean;
}
export interface LmsStatus {
    serverRunning: boolean;
    loadedModels: string[];
}
/**
 * Check if lms CLI is installed
 */
export declare function isLmsInstalled(): boolean;
/**
 * Check if LM Studio server is running
 */
export declare function isServerRunning(): Promise<boolean>;
/**
 * Start LM Studio server
 */
export declare function startServer(): Promise<{
    success: boolean;
    message: string;
}>;
/**
 * Stop LM Studio server
 */
export declare function stopServer(): Promise<{
    success: boolean;
    message: string;
}>;
/**
 * List installed models (lms ls)
 */
export declare function listModels(): LmsModel[];
export interface LoadedModelInfo {
    identifier: string;
    model: string;
    context: number;
}
/**
 * List loaded models (lms ps)
 */
export declare function listLoadedModels(): string[];
/**
 * Get detailed info about loaded models including context length
 */
export declare function getLoadedModelsInfo(): LoadedModelInfo[];
export interface LoadModelOptions {
    contextLength?: number;
    gpu?: 'off' | 'max' | number;
}
/**
 * Load a model
 */
export declare function loadModel(modelName: string, options?: LoadModelOptions): Promise<{
    success: boolean;
    message: string;
}>;
/**
 * Unload current model (or all models)
 */
export declare function unloadModel(all?: boolean): Promise<{
    success: boolean;
    message: string;
}>;
/**
 * Download a model using lms get
 * @param modelName - Model identifier (e.g., "qwen3.5-35b-a3b")
 * @param onProgress - Optional callback for progress updates
 */
export declare function downloadModel(modelName: string, onProgress?: (line: string) => void): Promise<{
    success: boolean;
    message: string;
}>;
/**
 * Search for models - Note: lms get is interactive, so we just validate the query format
 * The actual search happens during download with -y flag
 */
export declare function searchModels(query: string, _limit?: number): string[];
/**
 * Get full status
 */
export declare function getStatus(): Promise<LmsStatus>;
/**
 * Ensure server is running and model is loaded
 */
export declare function ensureReady(defaultModel?: string, options?: LoadModelOptions): Promise<{
    success: boolean;
    message: string;
    actions: string[];
}>;
/**
 * Check if loaded model has sufficient context, reload if needed
 * @param requiredContext - minimum context length required
 * @param targetModel - optional model name to check (from settings)
 * @returns info about what happened
 */
export declare function ensureContextLength(requiredContext: number, targetModel?: string): Promise<{
    ok: boolean;
    reloaded: boolean;
    model?: string;
    context?: number;
    message: string;
}>;
//# sourceMappingURL=client.d.ts.map