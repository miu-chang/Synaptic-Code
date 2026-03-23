import React from 'react';
import { type LicenseInfo } from '../../license/index.js';
interface BannerProps {
    cwd?: string;
    isGitRepo?: boolean;
    licenseStatus?: LicenseInfo;
}
export declare function Banner({ cwd, isGitRepo, licenseStatus }?: BannerProps): React.ReactElement;
export declare function BannerSmall(): React.ReactElement;
export {};
//# sourceMappingURL=Banner.d.ts.map