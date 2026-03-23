import React from 'react';
import type { UndoPoint } from '../../core/undo.js';
type RestoreMode = 'fork-both' | 'undo-code' | 'fork-conversation' | 'cancel';
interface UndoSelectorProps {
    undoPoints: UndoPoint[];
    onRestore: (pointId: number, mode: RestoreMode) => void;
    onClose: () => void;
}
export declare function UndoSelector({ undoPoints, onRestore, onClose }: UndoSelectorProps): React.ReactElement;
export {};
//# sourceMappingURL=UndoSelector.d.ts.map