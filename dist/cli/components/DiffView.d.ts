import React from 'react';
import type { UndoPoint } from '../../core/undo.js';
interface DiffViewProps {
    undoPoints: UndoPoint[];
    onClose: () => void;
}
export declare function DiffView({ undoPoints, onClose }: DiffViewProps): React.ReactElement;
export {};
//# sourceMappingURL=DiffView.d.ts.map