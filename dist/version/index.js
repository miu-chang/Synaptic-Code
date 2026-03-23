/**
 * Version Check for Synaptic Code
 * Checks for updates against the server
 */
// Import version from package.json at build time
const CURRENT_VERSION = '0.1.0';
const API_BASE = 'https://kawaii-agent-backend.vercel.app/api/synaptic';
/**
 * Check for updates
 */
export async function checkForUpdates() {
    try {
        const response = await fetch(`${API_BASE}/version`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ version: CURRENT_VERSION }),
            signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) {
            return null;
        }
        const data = await response.json();
        return {
            currentVersion: CURRENT_VERSION,
            latestVersion: data.latestVersion || CURRENT_VERSION,
            updateAvailable: data.updateAvailable || false,
            forceUpdate: data.forceUpdate || false,
            downloadUrl: data.downloadUrl,
            npmCommand: data.npmCommand,
            message: data.message,
        };
    }
    catch {
        // Network error - silently ignore
        return null;
    }
}
/**
 * Get current version
 */
export function getCurrentVersion() {
    return CURRENT_VERSION;
}
//# sourceMappingURL=index.js.map