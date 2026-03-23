import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { Spinner } from './Spinner.js';
export function ModelSelector({ models, currentModel, loading = false, onSelect, onClose, }) {
    const [selectedIndex, setSelectedIndex] = useState(() => {
        const idx = models.indexOf(currentModel);
        return idx >= 0 ? idx : 0;
    });
    useInput((input, key) => {
        if (key.escape) {
            onClose();
            return;
        }
        if (key.upArrow) {
            setSelectedIndex(i => Math.max(0, i - 1));
            return;
        }
        if (key.downArrow) {
            setSelectedIndex(i => Math.min(models.length - 1, i + 1));
            return;
        }
        if (key.return) {
            if (models[selectedIndex]) {
                onSelect(models[selectedIndex]);
            }
            return;
        }
    });
    if (loading) {
        return (_jsx(Box, { borderStyle: "round", borderColor: "cyan", paddingX: 1, children: _jsx(Spinner, { text: "Loading models..." }) }));
    }
    return (_jsxs(Box, { flexDirection: "column", borderStyle: "round", borderColor: "cyan", paddingX: 1, children: [_jsxs(Box, { marginBottom: 1, children: [_jsx(Text, { bold: true, color: "cyan", children: "Select Model" }), _jsx(Text, { dimColor: true, children: " \u2022 \u2191\u2193 navigate \u2022 Enter select \u2022 Esc cancel" })] }), models.map((model, i) => {
                const isSelected = i === selectedIndex;
                const isCurrent = model === currentModel;
                return (_jsxs(Box, { children: [_jsx(Text, { color: isSelected ? 'cyan' : undefined, children: isSelected ? '❯ ' : '  ' }), _jsx(Text, { bold: isSelected, color: isSelected ? 'cyan' : undefined, children: model }), isCurrent && _jsx(Text, { color: "green", children: " (current)" })] }, model));
            }), models.length === 0 && (_jsx(Text, { dimColor: true, children: "No models available" }))] }));
}
//# sourceMappingURL=ModelSelector.js.map