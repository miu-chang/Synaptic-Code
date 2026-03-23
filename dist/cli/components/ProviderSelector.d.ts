import React from 'react';
import type { ProviderType, CloudProviderType } from '../../config/settings.js';
interface ProviderSelectorProps {
    currentProvider: ProviderType;
    apiKeys: Record<CloudProviderType, string | undefined>;
    onSelect: (provider: ProviderType, apiKey?: string) => void;
    onClose: () => void;
}
export declare function ProviderSelector({ currentProvider, apiKeys, onSelect, onClose }: ProviderSelectorProps): React.ReactElement;
export {};
//# sourceMappingURL=ProviderSelector.d.ts.map