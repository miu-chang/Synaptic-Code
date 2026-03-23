/**
 * Undo Manager - Tracks file changes and conversation state for restoration
 * Supports fork/restore to any point including before compact
 */
import type { Message } from '../llm/types.js';
export interface FileSnapshot {
    path: string;
    content: string;
    timestamp: number;
}
export interface ChangeStats {
    filesChanged: number;
    linesAdded: number;
    linesRemoved: number;
}
export interface ConversationSnapshot {
    messageCount: number;
    timestamp: number;
}
export interface UndoPoint {
    id: number;
    label: string;
    timestamp: number;
    files: FileSnapshot[];
    conversationMessageCount: number;
    conversationSnapshot?: Message[];
    stats: ChangeStats;
}
declare class UndoManager {
    private undoPoints;
    private currentFiles;
    private nextId;
    private maxPoints;
    /**
     * Called before processing a user message
     * Captures the current state as a restore point
     * @param userMessage - The user's message (used as label)
     * @param currentMessageCount - Number of messages in conversation
     * @param messages - Optional: Full message snapshot for fork capability
     */
    createUndoPoint(userMessage: string, currentMessageCount: number, messages?: Message[]): number;
    /**
     * Track a file before it's modified
     */
    trackFile(path: string): void;
    /**
     * Update tracked file state after modification
     */
    updateFileState(path: string, content: string): void;
    /**
     * Mark a file as newly created (no previous state)
     */
    markAsNew(path: string): void;
    /**
     * Get list of undo points for UI
     */
    getUndoPoints(): UndoPoint[];
    /**
     * Restore files to a specific undo point
     */
    restoreFiles(pointId: number): {
        restored: string[];
        errors: string[];
    };
    /**
     * Get conversation message count at a specific undo point
     */
    getConversationCountAt(pointId: number): number | null;
    /**
     * Get full conversation snapshot at a specific undo point
     * Returns undefined if no snapshot was saved
     */
    getConversationSnapshotAt(pointId: number): Message[] | undefined;
    /**
     * Check if a point has a conversation snapshot
     */
    hasConversationSnapshot(pointId: number): boolean;
    /**
     * Remove undo points that are newer than the specified point
     * Called after forking to clear the "future" history
     */
    truncateAfterPoint(pointId: number): void;
    /**
     * Clear all undo history (e.g., on /new)
     */
    clear(): void;
    /**
     * Check if there are any undo points
     */
    hasUndoPoints(): boolean;
    /**
     * Calculate diff stats between two snapshots
     */
    private calculateStats;
    /**
     * Simple line diff counter
     */
    private countLineDiff;
}
export declare const undoManager: UndoManager;
export {};
//# sourceMappingURL=undo.d.ts.map