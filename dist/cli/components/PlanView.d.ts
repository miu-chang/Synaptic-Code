/**
 * PlanView - Claude Code style plan display
 * Shows execution plan inline before tool calls
 */
import React from 'react';
export interface PlanItem {
    id: number;
    action: string;
    tool?: string;
    status: 'pending' | 'approved' | 'rejected' | 'executing' | 'completed';
}
interface PlanViewProps {
    items: PlanItem[];
    onApprove: (itemId: number) => void;
    onApproveAll: () => void;
    onReject: () => void;
}
export declare function PlanView({ items, onApprove, onApproveAll, onReject }: PlanViewProps): React.ReactElement;
/**
 * Inline plan confirmation (single action)
 */
interface InlinePlanProps {
    action: string;
    tool?: string;
    onApprove: () => void;
    onReject: () => void;
}
export declare function InlinePlan({ action, tool, onApprove, onReject }: InlinePlanProps): React.ReactElement;
export {};
//# sourceMappingURL=PlanView.d.ts.map