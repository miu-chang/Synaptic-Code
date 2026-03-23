/**
 * License Management for Synaptic Code
 * =====================================
 * Online verification with offline cache fallback
 */
export type LicenseStatus = 'valid' | 'trial' | 'expired' | 'invalid' | 'none' | 'offline';
export interface LicenseInfo {
    status: LicenseStatus;
    key?: string;
    email?: string;
    plan?: string;
    activatedAt?: number;
    expiresAt?: number | null;
    lastVerified?: number;
    trialStarted?: number;
    trialDays?: number;
    offline?: boolean;
}
/**
 * Validate license key format
 * Format: SYN1-XXXX-XXXX-XXXX
 */
export declare function isValidKeyFormat(key: string): boolean;
/**
 * Start trial period (online registration required)
 */
export declare function startTrial(): Promise<LicenseInfo>;
/**
 * Verify trial status (online verification with local fallback)
 */
export declare function verifyTrial(): Promise<LicenseInfo>;
/**
 * Activate license with key (online)
 */
export declare function activateLicense(key: string, email?: string): Promise<{
    success: boolean;
    info: LicenseInfo;
    message?: string;
}>;
/**
 * Deactivate/remove license
 */
export declare function deactivateLicense(): void;
/**
 * Get current license status (with online verification)
 */
export declare function getLicenseStatusAsync(): Promise<LicenseInfo>;
/**
 * Get current license status (synchronous, from cache only)
 */
export declare function getLicenseStatus(): LicenseInfo;
/**
 * Check if user has valid access (license or trial)
 */
export declare function hasValidAccess(): boolean;
/**
 * Check if user has valid access (async, with online verification)
 */
export declare function hasValidAccessAsync(): Promise<boolean>;
/**
 * Format license key for display (mask middle parts)
 */
export declare function maskLicenseKey(key: string): string;
//# sourceMappingURL=index.d.ts.map