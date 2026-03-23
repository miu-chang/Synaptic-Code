/**
 * Undo Manager - Tracks file changes and conversation state for restoration
 * Supports fork/restore to any point including before compact
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
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
  label: string;  // User's message that triggered this turn
  timestamp: number;
  files: FileSnapshot[];
  conversationMessageCount: number;
  conversationSnapshot?: Message[];  // Full message history at this point (for fork)
  stats: ChangeStats;  // Stats from changes made AFTER this point
}

class UndoManager {
  private undoPoints: UndoPoint[] = [];
  private currentFiles: Map<string, string> = new Map(); // Current state of tracked files
  private nextId = 1;
  private maxPoints = 20;

  /**
   * Called before processing a user message
   * Captures the current state as a restore point
   * @param userMessage - The user's message (used as label)
   * @param currentMessageCount - Number of messages in conversation
   * @param messages - Optional: Full message snapshot for fork capability
   */
  createUndoPoint(userMessage: string, currentMessageCount: number, messages?: Message[]): number {
    const label = userMessage.length > 40
      ? userMessage.slice(0, 40) + '...'
      : userMessage;

    const point: UndoPoint = {
      id: this.nextId++,
      label,
      timestamp: Date.now(),
      files: Array.from(this.currentFiles.entries()).map(([path, content]) => ({
        path,
        content,
        timestamp: Date.now(),
      })),
      conversationMessageCount: currentMessageCount,
      conversationSnapshot: messages ? [...messages] : undefined,
      stats: { filesChanged: 0, linesAdded: 0, linesRemoved: 0 },
    };

    // Update stats for the previous point (changes made between previous and now)
    if (this.undoPoints.length > 0) {
      const prevPoint = this.undoPoints[0];
      prevPoint.stats = this.calculateStats(prevPoint.files, point.files);
    }

    this.undoPoints.unshift(point);

    // Limit stored points
    if (this.undoPoints.length > this.maxPoints) {
      this.undoPoints.pop();
    }

    return point.id;
  }

  /**
   * Track a file before it's modified
   */
  trackFile(path: string): void {
    const fullPath = resolve(path);
    if (!this.currentFiles.has(fullPath)) {
      try {
        if (existsSync(fullPath)) {
          const content = readFileSync(fullPath, 'utf-8');
          this.currentFiles.set(fullPath, content);
        }
      } catch {
        // Ignore read errors
      }
    }
  }

  /**
   * Update tracked file state after modification
   */
  updateFileState(path: string, content: string): void {
    const fullPath = resolve(path);
    this.currentFiles.set(fullPath, content);
  }

  /**
   * Mark a file as newly created (no previous state)
   */
  markAsNew(path: string): void {
    const fullPath = resolve(path);
    // For new files, we track them but they'll be deleted on restore
    this.currentFiles.set(fullPath, '');
  }

  /**
   * Get list of undo points for UI
   */
  getUndoPoints(): UndoPoint[] {
    return this.undoPoints;
  }

  /**
   * Restore files to a specific undo point
   */
  restoreFiles(pointId: number): { restored: string[]; errors: string[] } {
    const point = this.undoPoints.find(p => p.id === pointId);
    if (!point) {
      return { restored: [], errors: ['Undo point not found'] };
    }

    const restored: string[] = [];
    const errors: string[] = [];

    // Get all files that were modified after this point
    const pointIndex = this.undoPoints.findIndex(p => p.id === pointId);
    const laterPoints = this.undoPoints.slice(0, pointIndex);

    // Collect all files touched in later points
    const filesToRestore = new Set<string>();
    for (const laterPoint of laterPoints) {
      for (const file of laterPoint.files) {
        filesToRestore.add(file.path);
      }
    }

    // Also add current tracked files
    for (const path of this.currentFiles.keys()) {
      filesToRestore.add(path);
    }

    // Restore each file to its state at the undo point
    for (const filePath of filesToRestore) {
      const snapshot = point.files.find(f => f.path === filePath);

      try {
        if (snapshot) {
          // File existed at this point - restore it
          writeFileSync(filePath, snapshot.content, 'utf-8');
          this.currentFiles.set(filePath, snapshot.content);
          restored.push(filePath);
        } else {
          // File didn't exist at this point - it was created after
          // We could delete it, but that's dangerous. Just note it.
          // For safety, we don't delete files automatically
        }
      } catch (err) {
        errors.push(`Failed to restore ${filePath}: ${err}`);
      }
    }

    // Remove undo points that are now invalid (before the restored point)
    this.undoPoints = this.undoPoints.slice(pointIndex);

    return { restored, errors };
  }

  /**
   * Get conversation message count at a specific undo point
   */
  getConversationCountAt(pointId: number): number | null {
    const point = this.undoPoints.find(p => p.id === pointId);
    return point?.conversationMessageCount ?? null;
  }

  /**
   * Get full conversation snapshot at a specific undo point
   * Returns undefined if no snapshot was saved
   */
  getConversationSnapshotAt(pointId: number): Message[] | undefined {
    const point = this.undoPoints.find(p => p.id === pointId);
    return point?.conversationSnapshot;
  }

  /**
   * Check if a point has a conversation snapshot
   */
  hasConversationSnapshot(pointId: number): boolean {
    const point = this.undoPoints.find(p => p.id === pointId);
    return !!point?.conversationSnapshot;
  }

  /**
   * Remove undo points that are newer than the specified point
   * Called after forking to clear the "future" history
   */
  truncateAfterPoint(pointId: number): void {
    const pointIndex = this.undoPoints.findIndex(p => p.id === pointId);
    if (pointIndex >= 0) {
      // Keep only points from this one onwards (older points)
      this.undoPoints = this.undoPoints.slice(pointIndex);
    }
  }

  /**
   * Clear all undo history (e.g., on /new)
   */
  clear(): void {
    this.undoPoints = [];
    this.currentFiles.clear();
    this.nextId = 1;
  }

  /**
   * Check if there are any undo points
   */
  hasUndoPoints(): boolean {
    return this.undoPoints.length > 0;
  }

  /**
   * Calculate diff stats between two snapshots
   */
  private calculateStats(oldFiles: FileSnapshot[], newFiles: FileSnapshot[]): ChangeStats {
    const oldMap = new Map(oldFiles.map(f => [f.path, f.content]));
    const newMap = new Map(newFiles.map(f => [f.path, f.content]));

    let filesChanged = 0;
    let linesAdded = 0;
    let linesRemoved = 0;

    // Check all paths from both snapshots
    const allPaths = new Set([...oldMap.keys(), ...newMap.keys()]);

    for (const path of allPaths) {
      const oldContent = oldMap.get(path) || '';
      const newContent = newMap.get(path) || '';

      if (oldContent !== newContent) {
        filesChanged++;
        const diff = this.countLineDiff(oldContent, newContent);
        linesAdded += diff.added;
        linesRemoved += diff.removed;
      }
    }

    return { filesChanged, linesAdded, linesRemoved };
  }

  /**
   * Simple line diff counter
   */
  private countLineDiff(oldContent: string, newContent: string): { added: number; removed: number } {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');

    const oldSet = new Set(oldLines);
    const newSet = new Set(newLines);

    let added = 0;
    let removed = 0;

    for (const line of newLines) {
      if (!oldSet.has(line)) {
        added++;
      }
    }

    for (const line of oldLines) {
      if (!newSet.has(line)) {
        removed++;
      }
    }

    return { added, removed };
  }
}

// Singleton instance
export const undoManager = new UndoManager();
