/**
 * LM Studio tools for model management
 */
import { EventEmitter } from 'events';
import type { ToolHandler } from './registry.js';
export declare const lmsEvents: EventEmitter<[never]>;
export interface LmsDownloadProgress {
    model: string;
    status: 'searching' | 'downloading' | 'done' | 'error';
    progress?: string;
    message?: string;
}
export interface LmsModelChange {
    model: string;
    action: 'loaded' | 'unloaded';
}
/**
 * Download models to LM Studio
 */
export declare const lmsGetModel: ToolHandler;
/**
 * List installed models in LM Studio
 */
export declare const lmsListModels: ToolHandler;
/**
 * Load a model in LM Studio
 */
export declare const lmsLoadModel: ToolHandler;
/**
 * Unload current model in LM Studio
 */
export declare const lmsUnloadModel: ToolHandler;
/**
 * All LM Studio tools
 */
export declare const lmsTools: ToolHandler[];
//# sourceMappingURL=lmstudio.d.ts.map