import React from 'react';
import type { UndoPoint } from '../../core/undo.js';
interface TimelineViewProps {
    undoPoints: UndoPoint[];
    onClose: () => void;
}
export declare function TimelineView({ undoPoints, onClose }: TimelineViewProps): React.ReactElement;
export {};
//# sourceMappingURL=TimelineView.d.ts.map