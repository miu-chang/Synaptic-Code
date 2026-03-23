import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { t } from '../../i18n/index.js';
import { useScrollPaused } from './ScrollContext.js';
function formatTime() {
    const now = new Date();
    return now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
}
function formatTokens(n) {
    if (n >= 1000) {
        return (n / 1000).toFixed(1) + 'k';
    }
    return String(n);
}
/**
 * Context usage bar visualization
 * [████████░░░░░░░░░░░░] 2.5k/32k
 */
function ContextBar({ usage, tokenCount, maxTokens, isCompressed, }) {
    const barWidth = 12;
    const filled = Math.round((usage / 100) * barWidth);
    const empty = barWidth - filled;
    // Only warn when high usage
    const barColor = usage > 90 ? 'red' : usage > 75 ? 'yellow' : 'gray';
    return (_jsxs(Box, { children: [_jsx(Text, { dimColor: true, children: "[" }), _jsx(Text, { color: barColor, children: '█'.repeat(filled) }), _jsx(Text, { dimColor: true, children: '░'.repeat(empty) }), _jsx(Text, { dimColor: true, children: "] " }), _jsxs(Text, { dimColor: true, children: [formatTokens(tokenCount), "/", formatTokens(maxTokens)] }), isCompressed && _jsx(Text, { dimColor: true, children: " [compressed]" })] }));
}
export function StatusBar({ provider, model, toolCount, tokenCount = 0, maxTokens = 128000, isCompressed = false, lastUsage = null, autoAccept = true, isLoading = false, }) {
    const usage = maxTokens > 0 ? (tokenCount / maxTokens) * 100 : 0;
    const [time, setTime] = useState(formatTime());
    const paused = useScrollPaused();
    useEffect(() => {
        if (paused)
            return;
        const timer = setInterval(() => setTime(formatTime()), 60000);
        return () => clearInterval(timer);
    }, [paused]);
    return (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsxs(Box, { borderStyle: "round", borderColor: "gray", paddingX: 1, children: [_jsx(Text, { dimColor: true, children: model.length > 25 ? model.slice(0, 25) + '…' : model }), _jsx(Text, { dimColor: true, children: " \u2502 " }), _jsx(ContextBar, { usage: usage, tokenCount: tokenCount, maxTokens: maxTokens, isCompressed: isCompressed }), lastUsage && (_jsxs(Text, { dimColor: true, children: [" \u2502 \u2191", formatTokens(lastUsage.prompt), " \u2193", formatTokens(lastUsage.completion)] })), _jsxs(Text, { dimColor: true, children: [" \u2502 ", toolCount, " tools"] }), _jsx(Text, { dimColor: true, children: " \u2502 " }), _jsx(Text, { dimColor: true, children: autoAccept ? t().status.autoAccept : t().status.confirmMode })] }), _jsxs(Box, { paddingX: 1, justifyContent: "space-between", children: [_jsx(Text, { dimColor: true, children: isLoading
                            ? `${t().ui.pressEscToCancel} • Space ${t().ui.scrollPause}`
                            : `/ ${t().ui.commands} • Shift+Tab ${t().ui.toggleConfirm} • Esc×2 ${t().ui.undo} • Ctrl+C×2 ${t().ui.exit}` }), _jsx(Text, { dimColor: true, children: time })] })] }));
}
//# sourceMappingURL=StatusBar.js.map