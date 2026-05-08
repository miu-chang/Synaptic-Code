/**
 * Auto-updater for Synaptic Code
 *
 * Downloads platform-specific binary from the backend, swaps it with the
 * currently running executable, and signals that a restart is required.
 *
 * Only works for compiled binary builds (not when run via node/bun).
 */

import { platform, arch, tmpdir } from 'os';
import { join, dirname } from 'path';
import {
  existsSync,
  renameSync,
  unlinkSync,
  writeFileSync,
  chmodSync,
  statSync,
  createWriteStream,
} from 'fs';
import { execSync } from 'child_process';

import { getCurrentVersion } from './index.js';
import { getLicenseStatus, hasValidAccess } from '../license/index.js';

const API_BASE = 'https://kawaii-agent-backend.vercel.app/api/synaptic';

export interface UpdateInfo {
  updateAvailable: boolean;
  latestVersion: string;
  binaryUrl?: string;
  message?: string;
}

export interface UpdateResult {
  success: boolean;
  message: string;
  newVersion?: string;
  restartRequired?: boolean;
}

export type ProgressCallback = (status: string) => void;

/**
 * Get current binary path. Returns null when running via node/bun
 * (i.e. development mode), where auto-update is not supported.
 */
function getCurrentBinaryPath(): string | null {
  const execPath = process.execPath;
  if (execPath.includes('node') || execPath.includes('bun')) {
    return null;
  }
  return execPath;
}

async function getLicenseKey(): Promise<string | null> {
  try {
    const status = getLicenseStatus();
    return status.key || null;
  } catch {
    return null;
  }
}

async function checkUpdateWithPlatform(): Promise<UpdateInfo | null> {
  try {
    const response = await fetch(`${API_BASE}/version`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        version: getCurrentVersion(),
        platform: platform(),
        arch: arch(),
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return null;
    return (await response.json()) as UpdateInfo;
  } catch {
    return null;
  }
}

async function downloadFile(
  url: string,
  destPath: string,
  headers: Record<string, string> = {},
  onProgress?: (percent: number, downloaded: number, total: number) => void,
): Promise<void> {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    if (response.status === 401 || response.status === 403) {
      throw new Error('License verification failed. Please check your license key.');
    }
    throw new Error(`Download failed: HTTP ${response.status} ${errorText.slice(0, 100)}`);
  }
  const totalSize = parseInt(response.headers.get('content-length') || '0');
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const writer = createWriteStream(destPath);
  let downloaded = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      writer.write(Buffer.from(value));
      downloaded += value.length;
      if (onProgress && totalSize > 0) {
        onProgress(Math.round((downloaded / totalSize) * 100), downloaded, totalSize);
      }
    }
    writer.end();
    await new Promise<void>((resolve, reject) => {
      writer.on('finish', () => resolve());
      writer.on('error', reject);
    });
  } catch (error) {
    writer.end();
    try {
      if (existsSync(destPath)) unlinkSync(destPath);
    } catch {}
    throw error;
  }
}

/**
 * Perform an in-place binary update.
 *
 * On unix-likes the running binary is renamed to `.backup` and the new file
 * moved into place. On Windows the swap is deferred to a `.bat` helper that
 * runs after the current process exits (you cannot replace a running .exe).
 */
export async function performUpdate(onProgress?: ProgressCallback): Promise<UpdateResult> {
  const os = platform();
  const currentBinary = getCurrentBinaryPath();
  if (!currentBinary) {
    return {
      success: false,
      message: 'Auto-update is only available for compiled binary installations.',
    };
  }

  onProgress?.('Verifying license...');
  const licenseKey = await getLicenseKey();
  if (!licenseKey) {
    try {
      if (!hasValidAccess()) {
        return {
          success: false,
          message: 'Valid license required for auto-update. Run: synaptic license',
        };
      }
    } catch {
      return { success: false, message: 'Could not verify license.' };
    }
  }

  onProgress?.('Checking for updates...');
  const updateInfo = await checkUpdateWithPlatform();
  if (!updateInfo) {
    return {
      success: false,
      message: 'Could not check for updates. Please check your internet connection.',
    };
  }
  if (!updateInfo.updateAvailable) {
    return {
      success: true,
      message: `Already on the latest version (v${updateInfo.latestVersion})`,
    };
  }
  if (!updateInfo.binaryUrl) {
    return {
      success: false,
      message: `Update v${updateInfo.latestVersion} available but no binary for ${os}-${arch()}.`,
    };
  }

  const ext = os === 'win32' ? '.exe' : '';
  const tempPath = join(tmpdir(), `synaptic_update_${Date.now()}${ext}`);

  onProgress?.(`Downloading v${updateInfo.latestVersion}...`);
  try {
    let downloadUrl = updateInfo.binaryUrl;
    if (licenseKey) {
      const separator = downloadUrl.includes('?') ? '&' : '?';
      downloadUrl = `${downloadUrl}${separator}key=${encodeURIComponent(licenseKey)}`;
    }
    await downloadFile(downloadUrl, tempPath, {}, (percent, downloaded, total) => {
      const mb = (downloaded / 1048576).toFixed(1);
      const totalMb = (total / 1048576).toFixed(1);
      onProgress?.(`Downloading... ${mb}/${totalMb} MB (${percent}%)`);
    });
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  // Sanity check: a real binary should be at least 1MB.
  try {
    const stat = statSync(tempPath);
    if (stat.size < 1_000_000) {
      unlinkSync(tempPath);
      return {
        success: false,
        message: 'Downloaded file seems corrupted (too small). Please try again.',
      };
    }
  } catch {
    return { success: false, message: 'Could not verify downloaded file.' };
  }

  const backupPath = `${currentBinary}.backup`;
  try {
    if (os === 'win32') {
      // Windows can't replace a running .exe; defer to a batch script.
      const batPath = join(dirname(currentBinary), 'synaptic_update.bat');
      const batContent = [
        '@echo off',
        'chcp 65001 >nul 2>&1',
        'echo Updating Synaptic Code...',
        'timeout /t 2 /nobreak >nul',
        `powershell -Command "Unblock-File -Path '${tempPath}'" >nul 2>&1`,
        `if exist "${tempPath}:Zone.Identifier" del /f /q "${tempPath}:Zone.Identifier" >nul 2>&1`,
        `if exist "${backupPath}" del /f /q "${backupPath}"`,
        `move /y "${currentBinary}" "${backupPath}"`,
        `move /y "${tempPath}" "${currentBinary}"`,
        `powershell -Command "Unblock-File -Path '${currentBinary}'" >nul 2>&1`,
        'echo.',
        'echo Update complete! Please restart Synaptic Code.',
        `if exist "${backupPath}" del /f /q "${backupPath}"`,
        `del /f /q "%~f0"`,
      ].join('\r\n');
      writeFileSync(batPath, batContent, 'utf-8');
      onProgress?.('Update downloaded. Applying after exit...');
      try {
        execSync(`start /b cmd /c "${batPath}"`, { stdio: 'ignore', windowsHide: true });
      } catch {
        try {
          execSync(`cmd /c start "" /b "${batPath}"`, { stdio: 'ignore' });
        } catch {}
      }
      return {
        success: true,
        message: `Update to v${updateInfo.latestVersion} prepared. Please restart Synaptic Code.`,
        newVersion: updateInfo.latestVersion,
        restartRequired: true,
      };
    } else {
      // Unix: rename swap. Keep backup until the new binary is in place.
      if (existsSync(backupPath)) unlinkSync(backupPath);
      renameSync(currentBinary, backupPath);
      try {
        renameSync(tempPath, currentBinary);
        chmodSync(currentBinary, 0o755);
      } catch (swapError) {
        try {
          renameSync(backupPath, currentBinary);
        } catch {}
        throw swapError;
      }
      try {
        unlinkSync(backupPath);
      } catch {}
      onProgress?.(`Updated to v${updateInfo.latestVersion}. Please restart.`);
      return {
        success: true,
        message: `Updated to v${updateInfo.latestVersion}. Please restart Synaptic Code.`,
        newVersion: updateInfo.latestVersion,
        restartRequired: true,
      };
    }
  } catch (error) {
    try {
      if (existsSync(tempPath)) unlinkSync(tempPath);
    } catch {}
    try {
      if (!existsSync(currentBinary) && existsSync(backupPath)) {
        renameSync(backupPath, currentBinary);
      }
    } catch {}
    return {
      success: false,
      message: `Update failed: ${error instanceof Error ? error.message : String(error)}. Current version intact.`,
    };
  }
}
