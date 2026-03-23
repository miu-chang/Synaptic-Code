import type { ToolHandler } from './registry.js';
export declare function markFileAsRead(path: string): void;
export declare function hasFileBeenRead(path: string): boolean;
export declare function getFileModifiedExternally(path: string): boolean;
export declare function clearReadCache(): void;
export declare function getReadFiles(): string[];
export declare const readFileTool: ToolHandler;
export declare const writeFileTool: ToolHandler;
export declare const editFileTool: ToolHandler;
export declare const globTool: ToolHandler;
export declare const grepTool: ToolHandler;
export declare const fileTools: ToolHandler[];
//# sourceMappingURL=file.d.ts.map