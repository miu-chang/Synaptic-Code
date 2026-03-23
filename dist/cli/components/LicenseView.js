import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { t, format } from '../../i18n/index.js';
import { getLicenseStatus, activateLicense, startTrial, maskLicenseKey, isValidKeyFormat, } from '../../license/index.js';
export function LicenseView({ onClose, onMessage }) {
    const [mode, setMode] = useState('status');
    const [inputKey, setInputKey] = useState('');
    const [status, setStatus] = useState(getLicenseStatus());
    const [error, setError] = useState(null);
    useInput((input, key) => {
        if (key.escape) {
            if (mode === 'input') {
                setMode('status');
                setInputKey('');
                setError(null);
            }
            else {
                onClose();
            }
            return;
        }
        if (mode === 'status') {
            // 'a' to activate (enter key input mode)
            if (input === 'a' || input === 'A') {
                setMode('input');
                setInputKey('');
                setError(null);
                return;
            }
            // 't' to start trial
            if (input === 't' || input === 'T') {
                if (status.status === 'none' || status.status === 'expired') {
                    setMode('activating'); // Show loading state
                    startTrial().then(trialInfo => {
                        setStatus(trialInfo);
                        setMode('status');
                        if (trialInfo.status === 'trial') {
                            onMessage('info', format(t().license.trialStarted, { days: String(trialInfo.trialDays || 7) }));
                        }
                        else if (trialInfo.status === 'none') {
                            onMessage('error', 'Network required to start trial');
                        }
                    });
                }
                return;
            }
        }
        if (mode === 'input') {
            if (key.return) {
                // Validate and activate
                if (!isValidKeyFormat(inputKey)) {
                    setError(t().license.invalidFormat);
                    return;
                }
                setMode('activating');
                activateLicense(inputKey).then(result => {
                    if (result.success) {
                        setStatus(result.info);
                        onMessage('info', t().license.activationSuccess);
                        onClose();
                    }
                    else {
                        setError(result.message || 'Unknown error');
                        setMode('input');
                    }
                });
                return;
            }
            if (key.backspace || key.delete) {
                setInputKey(prev => prev.slice(0, -1));
                setError(null);
                return;
            }
            // Handle paste (multiple characters at once) or single character input
            if (input && input.length > 0) {
                // Clean and format input (handles both paste and single char)
                const cleanInput = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
                const currentClean = inputKey.replace(/-/g, '');
                const combined = currentClean + cleanInput;
                if (combined.length <= 16) {
                    const parts = combined.match(/.{1,4}/g) || [];
                    const formatted = parts.join('-');
                    setInputKey(formatted);
                    setError(null);
                }
            }
        }
    });
    const renderStatus = () => {
        switch (status.status) {
            case 'valid':
                return (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Box, { children: [_jsx(Text, { color: "green", children: "\u2713 " }), _jsx(Text, { bold: true, color: "green", children: t().license.statusValid })] }), status.key && (_jsxs(Box, { marginLeft: 2, children: [_jsx(Text, { dimColor: true, children: "Key: " }), _jsx(Text, { children: maskLicenseKey(status.key) })] })), status.activatedAt && (_jsx(Box, { marginLeft: 2, children: _jsx(Text, { dimColor: true, children: format(t().license.activated, { date: new Date(status.activatedAt).toLocaleDateString() }) }) })), status.plan && (_jsx(Box, { marginLeft: 2, children: _jsx(Text, { dimColor: true, children: format(t().license.platform, { platform: status.plan }) }) }))] }));
            case 'trial':
                return (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Box, { children: [_jsx(Text, { color: "yellow", children: "\u23F3 " }), _jsx(Text, { bold: true, color: "yellow", children: format(t().license.statusTrial, { days: String(status.trialDays || 0) }) })] }), _jsxs(Box, { marginLeft: 2, marginTop: 1, children: [_jsx(Text, { dimColor: true, children: "Press " }), _jsx(Text, { color: "cyan", children: "a" }), _jsx(Text, { dimColor: true, children: " to activate a license key" })] })] }));
            case 'expired':
                return (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Box, { children: [_jsx(Text, { color: "red", children: "\u2717 " }), _jsx(Text, { bold: true, color: "red", children: t().license.statusExpired })] }), _jsxs(Box, { marginTop: 1, children: [_jsx(Text, { dimColor: true, children: "Press " }), _jsx(Text, { color: "cyan", children: "a" }), _jsx(Text, { dimColor: true, children: " to activate a license key" })] })] }));
            default:
                return (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Box, { children: [_jsx(Text, { dimColor: true, children: "\u25CB " }), _jsx(Text, { children: t().license.statusNone })] }), _jsxs(Box, { marginTop: 1, flexDirection: "column", children: [_jsxs(Box, { children: [_jsx(Text, { dimColor: true, children: "Press " }), _jsx(Text, { color: "cyan", children: "a" }), _jsx(Text, { dimColor: true, children: " to activate a license key" })] }), _jsxs(Box, { children: [_jsx(Text, { dimColor: true, children: "Press " }), _jsx(Text, { color: "cyan", children: "t" }), _jsx(Text, { dimColor: true, children: " to start 7-day trial" })] })] })] }));
        }
    };
    return (_jsxs(Box, { flexDirection: "column", borderStyle: "round", borderColor: "cyan", paddingX: 1, paddingY: 0, children: [_jsxs(Box, { marginBottom: 1, children: [_jsx(Text, { bold: true, color: "cyan", children: t().license.title }), _jsx(Text, { dimColor: true, children: " \u2022 Esc close" })] }), mode === 'status' && renderStatus(), mode === 'input' && (_jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { children: t().license.enterKey }), _jsxs(Box, { marginTop: 1, children: [_jsx(Text, { color: "cyan", children: "\u276F " }), _jsx(Text, { children: inputKey }), _jsx(Text, { color: "cyan", children: "\u258C" })] }), error && (_jsx(Box, { marginTop: 1, children: _jsxs(Text, { color: "red", children: ["\u2717 ", error] }) })), _jsx(Box, { marginTop: 1, children: _jsx(Text, { dimColor: true, children: "Format: XXXX-XXXX-XXXX-XXXX \u2022 Enter to submit \u2022 Esc to cancel" }) })] })), mode === 'activating' && (_jsxs(Box, { children: [_jsx(Text, { color: "yellow", children: "\u280B " }), _jsx(Text, { children: t().license.activating })] }))] }));
}
//# sourceMappingURL=LicenseView.js.map