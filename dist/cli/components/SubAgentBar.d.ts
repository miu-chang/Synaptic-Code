/**
 * SubAgentBar - Shows running sub-agents status in one line each
 * Displays in chat mode when agents are active
 */
import React from 'react';
import type { SubAgentStatus } from '../../tools/agent.js';
interface SubAgentBarProps {
    statuses: Map<string, SubAgentStatus>;
}
export declare function SubAgentBar({ statuses }: SubAgentBarProps): React.ReactElement | null;
export {};
//# sourceMappingURL=SubAgentBar.d.ts.map