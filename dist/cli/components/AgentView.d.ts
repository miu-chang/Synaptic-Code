/**
 * AgentView - UI for Agent Mode
 * Shows real-time progress of autonomous task execution
 */
import React from 'react';
import type { AgentState } from '../../core/agent.js';
interface AgentViewProps {
    state: AgentState;
    onCancel: () => void;
}
export declare function AgentView({ state, onCancel }: AgentViewProps): React.ReactElement;
export {};
//# sourceMappingURL=AgentView.d.ts.map