import React from 'react';
interface LicenseViewProps {
    onClose: () => void;
    onMessage: (type: 'info' | 'error', content: string) => void;
}
export declare function LicenseView({ onClose, onMessage }: LicenseViewProps): React.ReactElement;
export {};
//# sourceMappingURL=LicenseView.d.ts.map