import React from 'react';
interface StatusBarProps {
    provider: string;
    model: string;
    toolCount: number;
    tokenCount?: number;
    maxTokens?: number;
    isCompressed?: boolean;
    lastUsage?: {
        prompt: number;
        completion: number;
    } | null;
    autoAccept?: boolean;
    isLoading?: boolean;
}
export declare function StatusBar({ provider, model, toolCount, tokenCount, maxTokens, isCompressed, lastUsage, autoAccept, isLoading, }: StatusBarProps): React.ReactElement;
export {};
//# sourceMappingURL=StatusBar.d.ts.map