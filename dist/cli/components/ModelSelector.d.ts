import React from 'react';
interface ModelSelectorProps {
    models: string[];
    currentModel: string;
    loading?: boolean;
    onSelect: (model: string) => void;
    onClose: () => void;
}
export declare function ModelSelector({ models, currentModel, loading, onSelect, onClose, }: ModelSelectorProps): React.ReactElement;
export {};
//# sourceMappingURL=ModelSelector.d.ts.map