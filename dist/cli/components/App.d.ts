import React from 'react';
import type { LLMClient } from '../../llm/types.js';
import type { ToolRegistry } from '../../tools/registry.js';
import type { Settings } from '../../config/settings.js';
interface AppProps {
    settings: Settings;
    client: LLMClient;
    tools: ToolRegistry;
    licenseStatus?: import('../../license/index.js').LicenseInfo;
    isGitRepo?: boolean;
    synapticStatus?: string;
    initialMessages?: Array<{
        type: 'info' | 'error';
        content: string;
    }>;
}
export declare function App({ settings: initialSettings, client: initialClient, tools, licenseStatus, isGitRepo: initialIsGitRepo, synapticStatus: initialSynapticStatus, initialMessages }: AppProps): React.ReactElement;
export {};
//# sourceMappingURL=App.d.ts.map