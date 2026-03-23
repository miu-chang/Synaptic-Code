import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { t } from '../../i18n/index.js';
const COMMAND_DEFINITIONS = [
    { name: 'help', descriptionKey: 'help', shortcut: '?' },
    { name: 'model', descriptionKey: 'model', shortcut: 'm' },
    { name: 'provider', descriptionKey: 'provider', shortcut: 'p' },
    { name: 'new', descriptionKey: 'new', shortcut: 'n' },
    { name: 'history', descriptionKey: 'history', shortcut: 'h' },
    { name: 'clear', descriptionKey: 'clear', shortcut: 'c' },
    { name: 'compact', descriptionKey: 'compact' },
    { name: 'agent', descriptionKey: 'agent', shortcut: 'a' },
    { name: 'todo', descriptionKey: 'todo', shortcut: 't' },
    { name: 'language', descriptionKey: 'language', shortcut: 'l' },
    { name: 'license', descriptionKey: 'license' },
    { name: 'tools', descriptionKey: 'tools' },
    { name: 'config', descriptionKey: 'config' },
    { name: 'synaptic', descriptionKey: 'synaptic' },
    { name: 'self', descriptionKey: 'self' },
    { name: 'timeline', descriptionKey: 'timeline' },
    { name: 'diff', descriptionKey: 'diff' },
    { name: 'quit', descriptionKey: 'quit', shortcut: 'q' },
];
// Helper to get commands with localized descriptions
export function getCommands() {
    const translations = t();
    return COMMAND_DEFINITIONS.map(cmd => ({
        name: cmd.name,
        description: translations.commandDescriptions[cmd.descriptionKey],
        shortcut: cmd.shortcut,
    }));
}
// For backwards compatibility
export const COMMANDS = COMMAND_DEFINITIONS.map(cmd => ({
    name: cmd.name,
    description: cmd.descriptionKey, // Will be replaced at runtime
    shortcut: cmd.shortcut,
}));
// Get all valid command names and shortcuts
export const COMMAND_NAMES = new Set(COMMAND_DEFINITIONS.flatMap(c => [c.name, c.shortcut].filter(Boolean)));
export function CommandPalette({ onSelect, onClose }) {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [filter, setFilter] = useState('');
    const commands = getCommands();
    const filteredCommands = commands.filter(cmd => cmd.name.includes(filter.toLowerCase()) ||
        cmd.description.toLowerCase().includes(filter.toLowerCase()));
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
            setSelectedIndex(i => Math.min(filteredCommands.length - 1, i + 1));
            return;
        }
        if (key.return) {
            if (filteredCommands[selectedIndex]) {
                onSelect(filteredCommands[selectedIndex].name);
            }
            return;
        }
        if (key.backspace || key.delete) {
            setFilter(f => f.slice(0, -1));
            setSelectedIndex(0);
            return;
        }
        if (input && !key.ctrl && !key.meta) {
            setFilter(f => f + input);
            setSelectedIndex(0);
        }
    });
    return (_jsxs(Box, { flexDirection: "column", borderStyle: "round", borderColor: "cyan", paddingX: 1, paddingY: 0, children: [_jsxs(Box, { marginBottom: 1, children: [_jsx(Text, { bold: true, color: "cyan", children: "Commands" }), _jsx(Text, { dimColor: true, children: " \u2022 \u2191\u2193 navigate \u2022 Enter select \u2022 Esc close" })] }), filter && (_jsxs(Box, { marginBottom: 1, children: [_jsx(Text, { dimColor: true, children: "Filter: " }), _jsx(Text, { color: "yellow", children: filter })] })), filteredCommands.map((cmd, i) => (_jsxs(Box, { children: [_jsx(Text, { color: i === selectedIndex ? 'cyan' : undefined, children: i === selectedIndex ? '❯ ' : '  ' }), _jsxs(Text, { bold: i === selectedIndex, color: i === selectedIndex ? 'cyan' : undefined, children: ["/", cmd.name] }), _jsxs(Text, { dimColor: true, children: [" - ", cmd.description] }), cmd.shortcut && (_jsxs(Text, { color: "gray", children: [" [", cmd.shortcut, "]"] }))] }, cmd.name))), filteredCommands.length === 0 && (_jsx(Text, { dimColor: true, children: "No commands found" }))] }));
}
//# sourceMappingURL=CommandPalette.js.map