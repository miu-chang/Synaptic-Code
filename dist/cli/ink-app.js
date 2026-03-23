import { jsx as _jsx } from "react/jsx-runtime";
import { render } from 'ink';
import { App } from './components/App.js';
// Synchronized Output sequences (DEC Mode 2026)
const BEGIN_SYNC = '\x1b[?2026h';
const END_SYNC = '\x1b[?2026l';
// Wrap stdout to use synchronized output for all writes
function wrapStdoutWithSync() {
    const originalWrite = process.stdout.write.bind(process.stdout);
    let pendingSync = false;
    let syncTimer = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    process.stdout.write = function (chunk, encoding, callback) {
        // Start sync mode if not already
        if (!pendingSync) {
            pendingSync = true;
            originalWrite(BEGIN_SYNC);
        }
        // Clear existing timer
        if (syncTimer) {
            clearTimeout(syncTimer);
        }
        // End sync mode after a small delay (batch multiple writes)
        syncTimer = setTimeout(() => {
            originalWrite(END_SYNC);
            pendingSync = false;
            syncTimer = null;
        }, 16); // ~60fps
        // Call original write
        return originalWrite(chunk, encoding, callback);
    };
    // Return cleanup function
    return () => {
        process.stdout.write = originalWrite;
        if (syncTimer) {
            clearTimeout(syncTimer);
        }
        if (pendingSync) {
            originalWrite(END_SYNC);
        }
    };
}
export async function startInkApp(config) {
    // Disabled synchronized output - was causing double rendering issues
    // const cleanup = wrapStdoutWithSync();
    const { waitUntilExit } = render(_jsx(App, { settings: config.settings, client: config.client, tools: config.tools, licenseStatus: config.licenseStatus, isGitRepo: config.isGitRepo, synapticStatus: config.synapticStatus, initialMessages: config.initialMessages }), {
        exitOnCtrlC: false, // Handle Ctrl+C manually (double-press to exit)
    });
    await waitUntilExit();
    // cleanup();
}
//# sourceMappingURL=ink-app.js.map