import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
const PROVIDERS = [
    { id: 'lmstudio', name: 'LM Studio', description: 'Local LLM server', requiresApiKey: false },
    { id: 'ollama', name: 'Ollama', description: 'Local LLM server', requiresApiKey: false },
    { id: 'openai-local', name: 'OpenAI Compatible', description: 'Local OpenAI-compatible server', requiresApiKey: false },
    { id: 'openai', name: 'OpenAI', description: 'GPT-5.4, GPT-5.4-pro, etc.', requiresApiKey: true },
    { id: 'anthropic', name: 'Anthropic', description: 'Claude Opus/Sonnet 4.6', requiresApiKey: true },
    { id: 'google', name: 'Google Gemini', description: 'Gemini 3.1 Pro/Flash', requiresApiKey: true },
];
export function ProviderSelector({ currentProvider, apiKeys, onSelect, onClose }) {
    const [selectedIndex, setSelectedIndex] = useState(() => {
        const idx = PROVIDERS.findIndex(p => p.id === currentProvider);
        return idx >= 0 ? idx : 0;
    });
    const [stage, setStage] = useState('select');
    const [apiKey, setApiKey] = useState('');
    const [selectedProvider, setSelectedProvider] = useState(null);
    useInput((input, key) => {
        if (stage === 'apikey') {
            if (key.escape) {
                setStage('select');
                setApiKey('');
            }
            return;
        }
        if (key.escape) {
            onClose();
            return;
        }
        if (key.upArrow) {
            setSelectedIndex(i => Math.max(0, i - 1));
            return;
        }
        if (key.downArrow) {
            setSelectedIndex(i => Math.min(PROVIDERS.length - 1, i + 1));
            return;
        }
        if (key.return) {
            const provider = PROVIDERS[selectedIndex];
            if (provider.requiresApiKey) {
                const existingKey = apiKeys[provider.id];
                if (existingKey) {
                    // Already has key, use it
                    onSelect(provider.id, existingKey);
                }
                else {
                    // Need to enter key
                    setSelectedProvider(provider.id);
                    setStage('apikey');
                }
            }
            else {
                onSelect(provider.id);
            }
        }
    });
    const handleApiKeySubmit = (key) => {
        if (key.trim() && selectedProvider) {
            onSelect(selectedProvider, key.trim());
        }
    };
    if (stage === 'apikey') {
        const provider = PROVIDERS.find(p => p.id === selectedProvider);
        return (_jsxs(Box, { flexDirection: "column", borderStyle: "round", borderColor: "cyan", paddingX: 1, children: [_jsx(Box, { marginBottom: 1, children: _jsxs(Text, { bold: true, color: "cyan", children: ["Enter API Key for ", provider?.name] }) }), _jsxs(Box, { children: [_jsx(Text, { color: "cyan", children: "API Key: " }), _jsx(TextInput, { value: apiKey, onChange: setApiKey, onSubmit: handleApiKeySubmit, mask: "*" })] }), _jsx(Box, { marginTop: 1, children: _jsx(Text, { dimColor: true, children: "Enter to confirm \u2022 Esc to go back" }) })] }));
    }
    return (_jsxs(Box, { flexDirection: "column", borderStyle: "round", borderColor: "cyan", paddingX: 1, children: [_jsxs(Box, { marginBottom: 1, children: [_jsx(Text, { bold: true, color: "cyan", children: "Select Provider" }), _jsx(Text, { dimColor: true, children: " \u2022 \u2191\u2193 navigate \u2022 Enter select \u2022 Esc cancel" })] }), PROVIDERS.map((provider, i) => {
                const isCurrent = provider.id === currentProvider;
                const hasKey = provider.requiresApiKey && apiKeys[provider.id];
                return (_jsxs(Box, { children: [_jsx(Text, { color: i === selectedIndex ? 'cyan' : undefined, children: i === selectedIndex ? '❯ ' : '  ' }), _jsx(Text, { bold: i === selectedIndex, color: i === selectedIndex ? 'cyan' : undefined, children: provider.name }), isCurrent && _jsx(Text, { color: "green", children: " (current)" }), hasKey && _jsx(Text, { color: "yellow", children: " [key set]" }), _jsxs(Text, { dimColor: true, children: [" - ", provider.description] })] }, provider.id));
            })] }));
}
//# sourceMappingURL=ProviderSelector.js.map