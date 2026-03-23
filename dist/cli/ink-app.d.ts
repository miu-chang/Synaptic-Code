import type { LLMClient } from '../llm/types.js';
import type { ToolRegistry } from '../tools/registry.js';
import type { Settings } from '../config/settings.js';
import type { LicenseInfo } from '../license/index.js';
export interface InkAppConfig {
    settings: Settings;
    client: LLMClient;
    tools: ToolRegistry;
    licenseStatus?: LicenseInfo;
    isGitRepo?: boolean;
    synapticStatus?: string;
    initialMessages?: Array<{
        type: 'info' | 'error';
        content: string;
    }>;
}
export declare function startInkApp(config: InkAppConfig): Promise<void>;
//# sourceMappingURL=ink-app.d.ts.map