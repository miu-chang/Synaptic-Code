import React from 'react';
interface SpinnerProps {
    text?: string;
    type?: 'dots' | 'spinner' | 'progress';
}
export declare function Spinner({ text, type }: SpinnerProps): React.ReactElement;
export declare function ThinkingIndicator(): React.ReactElement;
interface CompactingIndicatorProps {
    startedAt?: number;
}
export declare function CompactingIndicator({ startedAt }: CompactingIndicatorProps): React.ReactElement;
interface DownloadIndicatorProps {
    model: string;
    status: 'searching' | 'downloading' | 'done' | 'error';
    progress?: string;
    message?: string;
}
export declare function DownloadIndicator({ model, status, progress, message }: DownloadIndicatorProps): React.ReactElement;
interface ToolActivityProps {
    name: string;
    args?: string;
}
export declare function ToolActivity({ name, args }: ToolActivityProps): React.ReactElement;
export declare function ToolExecuting({ name }: {
    name: string;
}): React.ReactElement;
export {};
//# sourceMappingURL=Spinner.d.ts.map