import React from 'react';
interface HistoryItem {
    id: string;
    title: string;
    updatedAt: number;
    messageCount?: number;
}
interface HistorySelectorProps {
    items: HistoryItem[];
    onSelect: (id: string) => void;
    onClose: () => void;
    onDelete?: (id: string) => void;
}
export declare function HistorySelector({ items, onSelect, onClose, onDelete }: HistorySelectorProps): React.ReactElement;
export {};
//# sourceMappingURL=HistorySelector.d.ts.map