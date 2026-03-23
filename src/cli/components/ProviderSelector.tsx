import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import type { ProviderType, CloudProviderType } from '../../config/settings.js';
import { isCloudProvider } from '../../config/settings.js';

interface ProviderOption {
  id: ProviderType;
  name: string;
  description: string;
  requiresApiKey: boolean;
}

const PROVIDERS: ProviderOption[] = [
  { id: 'lmstudio', name: 'LM Studio', description: 'Local LLM server', requiresApiKey: false },
  { id: 'ollama', name: 'Ollama', description: 'Local LLM server', requiresApiKey: false },
  { id: 'openai-local', name: 'OpenAI Compatible', description: 'Local OpenAI-compatible server', requiresApiKey: false },
  { id: 'openai', name: 'OpenAI', description: 'GPT-5.4, GPT-5.4-pro, etc.', requiresApiKey: true },
  { id: 'anthropic', name: 'Anthropic', description: 'Claude Opus/Sonnet 4.6', requiresApiKey: true },
  { id: 'google', name: 'Google Gemini', description: 'Gemini 3.1 Pro/Flash', requiresApiKey: true },
];

interface ProviderSelectorProps {
  currentProvider: ProviderType;
  apiKeys: Record<CloudProviderType, string | undefined>;
  onSelect: (provider: ProviderType, apiKey?: string) => void;
  onClose: () => void;
}

type Stage = 'select' | 'apikey';

export function ProviderSelector({ currentProvider, apiKeys, onSelect, onClose }: ProviderSelectorProps): React.ReactElement {
  const [selectedIndex, setSelectedIndex] = useState(() => {
    const idx = PROVIDERS.findIndex(p => p.id === currentProvider);
    return idx >= 0 ? idx : 0;
  });
  const [stage, setStage] = useState<Stage>('select');
  const [apiKey, setApiKey] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<ProviderType | null>(null);

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
        const existingKey = apiKeys[provider.id as CloudProviderType];
        if (existingKey) {
          // Already has key, use it
          onSelect(provider.id, existingKey);
        } else {
          // Need to enter key
          setSelectedProvider(provider.id);
          setStage('apikey');
        }
      } else {
        onSelect(provider.id);
      }
    }
  });

  const handleApiKeySubmit = (key: string) => {
    if (key.trim() && selectedProvider) {
      onSelect(selectedProvider, key.trim());
    }
  };

  if (stage === 'apikey') {
    const provider = PROVIDERS.find(p => p.id === selectedProvider);
    return (
      <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
        <Box marginBottom={1}>
          <Text bold color="cyan">Enter API Key for {provider?.name}</Text>
        </Box>
        <Box>
          <Text color="cyan">API Key: </Text>
          <TextInput
            value={apiKey}
            onChange={setApiKey}
            onSubmit={handleApiKeySubmit}
            mask="*"
          />
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Enter to confirm • Esc to go back</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">Select Provider</Text>
        <Text dimColor> • ↑↓ navigate • Enter select • Esc cancel</Text>
      </Box>

      {PROVIDERS.map((provider, i) => {
        const isCurrent = provider.id === currentProvider;
        const hasKey = provider.requiresApiKey && apiKeys[provider.id as CloudProviderType];

        return (
          <Box key={provider.id}>
            <Text color={i === selectedIndex ? 'cyan' : undefined}>
              {i === selectedIndex ? '❯ ' : '  '}
            </Text>
            <Text bold={i === selectedIndex} color={i === selectedIndex ? 'cyan' : undefined}>
              {provider.name}
            </Text>
            {isCurrent && <Text color="green"> (current)</Text>}
            {hasKey && <Text color="yellow"> [key set]</Text>}
            <Text dimColor> - {provider.description}</Text>
          </Box>
        );
      })}
    </Box>
  );
}
