import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { getAvailableLanguages, getLanguage } from '../../i18n/index.js';
export function LanguageSelector({ onSelect, onClose }) {
    const languages = getAvailableLanguages();
    const currentLang = getLanguage();
    const [selectedIndex, setSelectedIndex] = useState(languages.findIndex(l => l.code === currentLang));
    useInput((input, key) => {
        if (key.escape) {
            onClose();
        }
        else if (key.upArrow) {
            setSelectedIndex(prev => (prev > 0 ? prev - 1 : languages.length - 1));
        }
        else if (key.downArrow) {
            setSelectedIndex(prev => (prev < languages.length - 1 ? prev + 1 : 0));
        }
        else if (key.return) {
            onSelect(languages[selectedIndex].code);
        }
    });
    return (_jsxs(Box, { flexDirection: "column", marginY: 1, paddingX: 2, children: [_jsx(Box, { marginBottom: 1, children: _jsx(Text, { bold: true, children: "\uD83C\uDF10 Select Language / \u8A00\u8A9E\u3092\u9078\u629E" }) }), languages.map((lang, idx) => {
                const isSelected = idx === selectedIndex;
                const isCurrent = lang.code === currentLang;
                return (_jsx(Box, { children: _jsxs(Text, { color: isSelected ? 'cyan' : undefined, children: [isSelected ? '❯ ' : '  ', lang.name, isCurrent && _jsx(Text, { dimColor: true, children: " (current)" })] }) }, lang.code));
            }), _jsx(Box, { marginTop: 1, children: _jsx(Text, { dimColor: true, children: "\u2191\u2193 select \u2022 Enter confirm \u2022 Esc cancel" }) })] }));
}
//# sourceMappingURL=LanguageSelector.js.map