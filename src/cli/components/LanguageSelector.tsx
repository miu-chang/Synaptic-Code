import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { getAvailableLanguages, getLanguage, type Language } from '../../i18n/index.js';

interface LanguageSelectorProps {
  onSelect: (lang: Language) => void;
  onClose: () => void;
}

export function LanguageSelector({ onSelect, onClose }: LanguageSelectorProps): React.ReactElement {
  const languages = getAvailableLanguages();
  const currentLang = getLanguage();
  const [selectedIndex, setSelectedIndex] = useState(
    languages.findIndex(l => l.code === currentLang)
  );

  useInput((input, key) => {
    if (key.escape) {
      onClose();
    } else if (key.upArrow) {
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : languages.length - 1));
    } else if (key.downArrow) {
      setSelectedIndex(prev => (prev < languages.length - 1 ? prev + 1 : 0));
    } else if (key.return) {
      onSelect(languages[selectedIndex].code);
    }
  });

  return (
    <Box flexDirection="column" marginY={1} paddingX={2}>
      <Box marginBottom={1}>
        <Text bold>🌐 Select Language / 言語を選択</Text>
      </Box>

      {languages.map((lang, idx) => {
        const isSelected = idx === selectedIndex;
        const isCurrent = lang.code === currentLang;

        return (
          <Box key={lang.code}>
            <Text color={isSelected ? 'cyan' : undefined}>
              {isSelected ? '❯ ' : '  '}
              {lang.name}
              {isCurrent && <Text dimColor> (current)</Text>}
            </Text>
          </Box>
        );
      })}

      <Box marginTop={1}>
        <Text dimColor>↑↓ select • Enter confirm • Esc cancel</Text>
      </Box>
    </Box>
  );
}
