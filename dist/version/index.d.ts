/**
 * Version Check for Synaptic Code
 * Checks for updates against the server
 */
export interface VersionInfo {
    currentVersion: string;
    latestVersion: string;
    updateAvailable: boolean;
    forceUpdate: boolean;
    downloadUrl?: string;
    npmCommand?: string;
    message?: string;
}
/**
 * Check for updates
 */
export declare function checkForUpdates(): Promise<VersionInfo | null>;
/**
 * Get current version
 */
export declare function getCurrentVersion(): string;
//# sourceMappingURL=index.d.ts.map