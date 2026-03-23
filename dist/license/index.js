/**
 * License Management for Synaptic Code
 * =====================================
 * Online verification with offline cache fallback
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir, hostname, platform, arch } from 'os';
import { createHash } from 'crypto';
// API endpoint
const API_BASE = 'https://kawaii-agent-backend.vercel.app/api/synaptic';
// License storage location
const LICENSE_DIR = join(homedir(), '.synaptic-code');
const LICENSE_FILE = join(LICENSE_DIR, 'license.json');
// Cache validity (7 days)
const CACHE_VALIDITY_MS = 7 * 24 * 60 * 60 * 1000;
// Trial duration in days
const TRIAL_DAYS = 7;
/**
 * Generate a machine-specific hash
 */
function getMachineHash() {
    const data = `${hostname()}-${platform()}-${arch()}-synaptic`;
    return createHash('sha256').update(data).digest('hex').slice(0, 32);
}
/**
 * Ensure license directory exists
 */
function ensureLicenseDir() {
    if (!existsSync(LICENSE_DIR)) {
        mkdirSync(LICENSE_DIR, { recursive: true });
    }
}
/**
 * Validate license key format
 * Format: SYN1-XXXX-XXXX-XXXX
 */
export function isValidKeyFormat(key) {
    return /^SYN1-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(key?.trim() || '');
}
/**
 * Load stored license from disk
 */
function loadStoredLicense() {
    try {
        if (!existsSync(LICENSE_FILE)) {
            return null;
        }
        const data = readFileSync(LICENSE_FILE, 'utf-8');
        return JSON.parse(data);
    }
    catch {
        return null;
    }
}
/**
 * Save license to disk
 */
function saveLicense(license) {
    try {
        ensureLicenseDir();
        writeFileSync(LICENSE_FILE, JSON.stringify(license, null, 2), 'utf-8');
    }
    catch {
        // Ignore save errors
    }
}
/**
 * Load trial info from disk
 */
function loadTrialInfo() {
    try {
        const trialFile = join(LICENSE_DIR, '.trial');
        if (!existsSync(trialFile)) {
            return null;
        }
        const data = readFileSync(trialFile, 'utf-8');
        return JSON.parse(data);
    }
    catch {
        return null;
    }
}
/**
 * Save trial info to disk
 */
function saveTrialInfo(info) {
    try {
        ensureLicenseDir();
        const trialFile = join(LICENSE_DIR, '.trial');
        writeFileSync(trialFile, JSON.stringify(info), 'utf-8');
    }
    catch {
        // Ignore save errors
    }
}
/**
 * Check if trial is still valid (local check)
 */
function checkTrialStatusLocal() {
    const trial = loadTrialInfo();
    if (!trial) {
        return null;
    }
    // Legacy format migration: if no machineHash, add current one
    if (!trial.machineHash) {
        trial.machineHash = getMachineHash();
        saveTrialInfo(trial);
    }
    // Verify machine hash matches (prevent copying .trial file)
    if (trial.machineHash !== getMachineHash()) {
        return { valid: false, daysLeft: 0, started: trial.started };
    }
    const now = Date.now();
    const elapsed = now - trial.started;
    const daysElapsed = elapsed / (1000 * 60 * 60 * 24);
    const daysLeft = Math.max(0, trial.days - daysElapsed);
    // Anti-tampering: if clock was set back, elapsed would be negative
    if (elapsed < 0) {
        return { valid: false, daysLeft: 0, started: trial.started };
    }
    return {
        valid: daysLeft > 0,
        daysLeft: Math.ceil(daysLeft),
        started: trial.started,
    };
}
/**
 * Verify trial with server (online check)
 */
async function verifyTrialOnline() {
    try {
        const response = await fetch(`${API_BASE}/trial/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                machineHash: getMachineHash(),
            }),
            signal: AbortSignal.timeout(5000),
        });
        const data = await response.json();
        if (!data.exists) {
            return null; // No trial registered for this machine
        }
        return {
            valid: data.valid || false,
            daysLeft: data.daysLeft || 0,
            started: data.startedAt ? new Date(data.startedAt).getTime() : Date.now(),
        };
    }
    catch {
        return null; // Network error - fall back to local check
    }
}
/**
 * Register new trial with server
 */
async function registerTrialOnline() {
    try {
        const response = await fetch(`${API_BASE}/trial/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                machineHash: getMachineHash(),
            }),
            signal: AbortSignal.timeout(5000),
        });
        const data = await response.json();
        if (data.success) {
            return {
                success: true,
                daysLeft: data.daysLeft,
                startedAt: data.startedAt ? new Date(data.startedAt).getTime() : Date.now(),
            };
        }
        return { success: false, error: data.error || 'Trial registration failed' };
    }
    catch {
        return { success: false, error: 'network_error' };
    }
}
/**
 * Start trial period (online registration required)
 */
export async function startTrial() {
    const machineHash = getMachineHash();
    // Check if local trial exists
    const existing = loadTrialInfo();
    if (existing) {
        // Handle legacy format (no machineHash) - migrate to new format
        if (!existing.machineHash) {
            existing.machineHash = machineHash;
            existing.serverVerified = false; // Need to verify with server
            saveTrialInfo(existing);
        }
        // Verify machine hash
        if (existing.machineHash !== machineHash) {
            return { status: 'invalid' }; // Copied from another machine
        }
        const localStatus = checkTrialStatusLocal();
        if (localStatus && localStatus.valid) {
            return {
                status: 'trial',
                trialStarted: localStatus.started,
                trialDays: localStatus.daysLeft,
            };
        }
        return { status: 'expired' };
    }
    // No local trial - register online
    const result = await registerTrialOnline();
    if (result.success) {
        // Save locally with machine hash
        const trial = {
            started: result.startedAt || Date.now(),
            days: result.daysLeft || TRIAL_DAYS,
            machineHash,
            serverVerified: true,
        };
        saveTrialInfo(trial);
        return {
            status: 'trial',
            trialStarted: trial.started,
            trialDays: trial.days,
        };
    }
    // Check if error is "already used" (server says trial exists but we don't have local)
    // This means the local .trial file was deleted - allow re-sync from server
    if (result.error === 'trial_already_used') {
        // Try to verify and get the remaining days from server
        const verifyResult = await verifyTrialOnline();
        if (verifyResult && verifyResult.valid) {
            // Re-create local trial file from server data
            const trial = {
                started: new Date(verifyResult.started).getTime(),
                days: verifyResult.daysLeft + Math.floor((Date.now() - new Date(verifyResult.started).getTime()) / (1000 * 60 * 60 * 24)),
                machineHash,
                serverVerified: true,
            };
            saveTrialInfo(trial);
            return {
                status: 'trial',
                trialStarted: trial.started,
                trialDays: verifyResult.daysLeft,
            };
        }
        return { status: 'expired' };
    }
    if (result.error === 'trial_expired') {
        return { status: 'expired' };
    }
    // Network error - don't allow offline trial start (prevents abuse)
    if (result.error === 'network_error') {
        return { status: 'none' }; // Require online for new trials
    }
    return { status: 'invalid' };
}
/**
 * Verify trial status (online verification with local fallback)
 */
export async function verifyTrial() {
    const local = loadTrialInfo();
    if (!local) {
        return { status: 'none' };
    }
    // Verify machine hash
    if (local.machineHash !== getMachineHash()) {
        return { status: 'invalid' };
    }
    // Try online verification
    const online = await verifyTrialOnline();
    if (online) {
        // Server responded - use server truth
        if (online.valid) {
            // Update local cache
            local.started = online.started;
            local.days = online.daysLeft + Math.floor((Date.now() - online.started) / (1000 * 60 * 60 * 24));
            saveTrialInfo(local);
            return {
                status: 'trial',
                trialStarted: online.started,
                trialDays: online.daysLeft,
            };
        }
        return { status: 'expired' };
    }
    // Offline - use local with strict checks
    const localStatus = checkTrialStatusLocal();
    if (localStatus && localStatus.valid && local.serverVerified) {
        return {
            status: 'trial',
            trialStarted: localStatus.started,
            trialDays: localStatus.daysLeft,
            offline: true,
        };
    }
    // Offline and not server-verified - don't trust
    return { status: 'none' };
}
/**
 * Verify license online
 */
async function verifyOnline(licenseKey) {
    try {
        const response = await fetch(`${API_BASE}/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                licenseKey: licenseKey.toUpperCase(),
                machineHash: getMachineHash(),
            }),
        });
        const data = await response.json();
        if (data.valid) {
            return {
                valid: true,
                plan: data.plan,
                expiresAt: data.expiresAt ? new Date(data.expiresAt).getTime() : null,
            };
        }
        return { valid: false, error: data.error || 'Invalid license' };
    }
    catch {
        // Network error - return null to indicate offline
        return { valid: false, error: 'network_error' };
    }
}
/**
 * Activate license online
 */
async function activateOnline(licenseKey, email) {
    try {
        const response = await fetch(`${API_BASE}/activate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                licenseKey: licenseKey.toUpperCase(),
                email,
            }),
        });
        const data = await response.json();
        if (data.success) {
            return {
                success: true,
                plan: data.plan,
                expiresAt: data.expiresAt ? new Date(data.expiresAt).getTime() : null,
            };
        }
        return { success: false, error: data.error || 'Activation failed' };
    }
    catch {
        return { success: false, error: 'Network error. Please check your connection.' };
    }
}
/**
 * Activate license with key (online)
 */
export async function activateLicense(key, email) {
    const trimmedKey = key.trim().toUpperCase();
    // Validate format
    if (!isValidKeyFormat(trimmedKey)) {
        return {
            success: false,
            info: { status: 'invalid' },
            message: 'Invalid license key format. Expected: SYN1-XXXX-XXXX-XXXX',
        };
    }
    // Activate online
    const result = await activateOnline(trimmedKey, email);
    if (!result.success) {
        return {
            success: false,
            info: { status: 'invalid' },
            message: result.error || 'Activation failed',
        };
    }
    // Save license locally
    const license = {
        key: trimmedKey,
        email,
        plan: result.plan || 'standard',
        activatedAt: Date.now(),
        expiresAt: result.expiresAt,
        lastVerified: Date.now(),
        machineHash: getMachineHash(),
    };
    saveLicense(license);
    return {
        success: true,
        info: {
            status: 'valid',
            key: trimmedKey,
            email,
            plan: result.plan,
            activatedAt: license.activatedAt,
            expiresAt: result.expiresAt,
            lastVerified: license.lastVerified,
        },
    };
}
/**
 * Deactivate/remove license
 */
export function deactivateLicense() {
    try {
        if (existsSync(LICENSE_FILE)) {
            const { unlinkSync } = require('fs');
            unlinkSync(LICENSE_FILE);
        }
    }
    catch {
        // Ignore errors
    }
}
/**
 * Get current license status (with online verification)
 */
export async function getLicenseStatusAsync() {
    const stored = loadStoredLicense();
    if (stored) {
        const now = Date.now();
        const cacheAge = now - stored.lastVerified;
        // Check if local expiry
        if (stored.expiresAt && stored.expiresAt < now) {
            return {
                status: 'expired',
                key: stored.key,
                expiresAt: stored.expiresAt,
            };
        }
        // If cache is fresh, return cached status
        if (cacheAge < CACHE_VALIDITY_MS) {
            return {
                status: 'valid',
                key: stored.key,
                email: stored.email,
                plan: stored.plan,
                activatedAt: stored.activatedAt,
                expiresAt: stored.expiresAt,
                lastVerified: stored.lastVerified,
            };
        }
        // Cache is stale, verify online
        const result = await verifyOnline(stored.key);
        if (result.error === 'network_error') {
            // Offline but cache exists - allow with warning
            return {
                status: 'offline',
                key: stored.key,
                plan: stored.plan,
                lastVerified: stored.lastVerified,
                offline: true,
            };
        }
        if (result.valid) {
            // Update cache
            stored.lastVerified = now;
            stored.plan = result.plan || stored.plan;
            stored.expiresAt = result.expiresAt;
            saveLicense(stored);
            return {
                status: 'valid',
                key: stored.key,
                email: stored.email,
                plan: stored.plan,
                activatedAt: stored.activatedAt,
                expiresAt: stored.expiresAt,
                lastVerified: stored.lastVerified,
            };
        }
        // License revoked or invalid
        return {
            status: 'invalid',
            key: stored.key,
        };
    }
    // Check trial status (always verify online for trials)
    const trialResult = await verifyTrial();
    if (trialResult.status === 'trial') {
        return trialResult;
    }
    if (trialResult.status === 'expired') {
        return { status: 'expired' };
    }
    // No license or trial
    return { status: 'none' };
}
/**
 * Get current license status (synchronous, from cache only)
 */
export function getLicenseStatus() {
    const stored = loadStoredLicense();
    if (stored) {
        const now = Date.now();
        // Check if expired
        if (stored.expiresAt && stored.expiresAt < now) {
            return {
                status: 'expired',
                key: stored.key,
                expiresAt: stored.expiresAt,
            };
        }
        // Check if cache is too old (but still return valid for sync check)
        const cacheAge = now - stored.lastVerified;
        const needsVerification = cacheAge >= CACHE_VALIDITY_MS;
        return {
            status: needsVerification ? 'offline' : 'valid',
            key: stored.key,
            email: stored.email,
            plan: stored.plan,
            activatedAt: stored.activatedAt,
            expiresAt: stored.expiresAt,
            lastVerified: stored.lastVerified,
            offline: needsVerification,
        };
    }
    // Check trial status (local only for sync version)
    const local = loadTrialInfo();
    if (local) {
        // Legacy format migration
        if (!local.machineHash) {
            local.machineHash = getMachineHash();
            saveTrialInfo(local);
        }
        // Verify machine hash
        if (local.machineHash !== getMachineHash()) {
            return { status: 'invalid' };
        }
        const trial = checkTrialStatusLocal();
        if (trial && trial.valid) {
            // For sync version, trust local if valid (async version will verify online)
            return {
                status: 'trial',
                trialStarted: trial.started,
                trialDays: trial.daysLeft,
            };
        }
        // Trial exists but invalid/expired
        return { status: 'expired' };
    }
    return { status: 'none' };
}
/**
 * Check if user has valid access (license or trial)
 */
export function hasValidAccess() {
    const status = getLicenseStatus();
    return status.status === 'valid' || status.status === 'trial' || status.status === 'offline';
}
/**
 * Check if user has valid access (async, with online verification)
 */
export async function hasValidAccessAsync() {
    const status = await getLicenseStatusAsync();
    return status.status === 'valid' || status.status === 'trial' || status.status === 'offline';
}
/**
 * Format license key for display (mask middle parts)
 */
export function maskLicenseKey(key) {
    const parts = key.split('-');
    if (parts.length !== 4)
        return '****-****-****-****';
    return `${parts[0]}-****-****-${parts[3]}`;
}
//# sourceMappingURL=index.js.map