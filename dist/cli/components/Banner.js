import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { useScrollPaused } from './ScrollContext.js';
const VERSION = '0.1.0';
const BORDER = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
const SYNAPTIC_LINES = [
    '███████╗██╗   ██╗███╗   ██╗ █████╗ ██████╗ ████████╗██╗ ██████╗',
    '██╔════╝╚██╗ ██╔╝████╗  ██║██╔══██╗██╔══██╗╚══██╔══╝██║██╔════╝',
    '███████╗ ╚████╔╝ ██╔██╗ ██║███████║██████╔╝   ██║   ██║██║     ',
    '╚════██║  ╚██╔╝  ██║╚██╗██║██╔══██║██╔═══╝    ██║   ██║██║     ',
    '███████║   ██║   ██║ ╚████║██║  ██║██║        ██║   ██║╚██████╗',
    '╚══════╝   ╚═╝   ╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝        ╚═╝   ╚═╝ ╚═════╝',
];
const CODE_LINES = [
    ' ██████╗ ██████╗ ██████╗ ███████╗',
    '██╔════╝██╔═══██╗██╔══██╗██╔════╝',
    '██║     ██║   ██║██║  ██║█████╗  ',
    '██║     ██║   ██║██║  ██║██╔══╝  ',
    '╚██████╗╚██████╔╝██████╔╝███████╗',
    ' ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝',
];
// Static colors
function getColor(lineIndex, isSynaptic) {
    if (isSynaptic) {
        return lineIndex === 2 || lineIndex === 3 ? 'blueBright' : 'magenta';
    }
    else {
        return lineIndex === 2 || lineIndex === 3 ? 'blueBright' : 'cyan';
    }
}
function WaveLine({ text, color, lineIndex, frame, animationDone }) {
    if (animationDone) {
        return _jsxs(Text, { color: color, children: ["  ", text] });
    }
    // Horizontal wave: each line shifts left/right based on sine wave
    const phase = (frame * 0.5) - (lineIndex * 0.6);
    const xOffset = Math.round(Math.sin(phase) * 2);
    const padding = '  ' + ' '.repeat(Math.max(0, xOffset));
    return (_jsxs(Text, { color: color, children: [padding, text] }));
}
export function Banner({ cwd, isGitRepo, licenseStatus } = {}) {
    const [frame, setFrame] = useState(0);
    const [animationDone, setAnimationDone] = useState(false);
    const paused = useScrollPaused();
    useEffect(() => {
        if (animationDone || paused)
            return;
        const interval = setInterval(() => {
            setFrame(f => {
                if (f >= 30) {
                    setAnimationDone(true);
                    return f;
                }
                return f + 1;
            });
        }, 80);
        return () => clearInterval(interval);
    }, [animationDone, paused]);
    return (_jsxs(Box, { flexDirection: "column", marginY: 1, children: [_jsx(Text, { color: "cyan", children: BORDER }), _jsx(Text, { children: " " }), SYNAPTIC_LINES.map((line, i) => (_jsx(WaveLine, { text: line, color: getColor(i, true), lineIndex: i, frame: frame, animationDone: animationDone }, `s${i}`))), _jsx(Text, { children: " " }), CODE_LINES.map((line, i) => (_jsx(WaveLine, { text: line, color: getColor(i, false), lineIndex: i + 7, frame: frame, animationDone: animationDone }, `c${i}`))), _jsx(Text, { children: " " }), _jsx(Text, { color: "cyan", children: BORDER }), _jsxs(Box, { marginTop: 1, flexDirection: "column", children: [_jsxs(Text, { dimColor: true, children: ["v", VERSION, " \u2022 Local LLM Coding Assistant"] }), cwd && (_jsxs(Box, { children: [_jsx(Text, { color: "cyan", children: cwd }), isGitRepo && _jsx(Text, { color: "green", children: " (git)" })] })), licenseStatus && _jsx(LicenseStatusLine, { status: licenseStatus })] })] }));
}
// Memoized license status line - only re-renders when status changes
const LicenseStatusLine = React.memo(function LicenseStatusLine({ status }) {
    if (status.status === 'valid') {
        return (_jsxs(Box, { children: [_jsx(Text, { color: "green", children: "\u2713 Licensed" }), status.plan && _jsxs(Text, { dimColor: true, children: [" (", status.plan, ")"] })] }));
    }
    if (status.status === 'trial') {
        return (_jsx(Box, { children: _jsxs(Text, { color: "yellow", children: ["\u23F3 Trial: ", status.trialDays, " days remaining"] }) }));
    }
    if (status.status === 'offline') {
        return (_jsx(Box, { children: _jsx(Text, { color: "yellow", children: "\u26A0 Offline mode (cached license)" }) }));
    }
    return null;
});
export function BannerSmall() {
    return (_jsxs(Box, { marginY: 1, children: [_jsx(Text, { bold: true, color: "magenta", children: "[*] Synaptic Code" }), _jsx(Text, { dimColor: true, children: " v0.1.0" })] }));
}
//# sourceMappingURL=Banner.js.map