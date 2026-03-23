import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { t, format } from '../../i18n/index.js';
import {
  getLicenseStatus,
  activateLicense,
  startTrial,
  maskLicenseKey,
  isValidKeyFormat,
  type LicenseInfo,
} from '../../license/index.js';

interface LicenseViewProps {
  onClose: () => void;
  onMessage: (type: 'info' | 'error', content: string) => void;
}

type Mode = 'status' | 'input' | 'activating';

export function LicenseView({ onClose, onMessage }: LicenseViewProps): React.ReactElement {
  const [mode, setMode] = useState<Mode>('status');
  const [inputKey, setInputKey] = useState('');
  const [status, setStatus] = useState<LicenseInfo>(getLicenseStatus());
  const [error, setError] = useState<string | null>(null);

  useInput((input, key) => {
    if (key.escape) {
      if (mode === 'input') {
        setMode('status');
        setInputKey('');
        setError(null);
      } else {
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
          setMode('activating');  // Show loading state
          startTrial().then(trialInfo => {
            setStatus(trialInfo);
            setMode('status');
            if (trialInfo.status === 'trial') {
              onMessage('info', format(t().license.trialStarted, { days: String(trialInfo.trialDays || 7) }));
            } else if (trialInfo.status === 'none') {
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
          } else {
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
        return (
          <Box flexDirection="column">
            <Box>
              <Text color="green">✓ </Text>
              <Text bold color="green">{t().license.statusValid}</Text>
            </Box>
            {status.key && (
              <Box marginLeft={2}>
                <Text dimColor>Key: </Text>
                <Text>{maskLicenseKey(status.key)}</Text>
              </Box>
            )}
            {status.activatedAt && (
              <Box marginLeft={2}>
                <Text dimColor>{format(t().license.activated, { date: new Date(status.activatedAt).toLocaleDateString() })}</Text>
              </Box>
            )}
            {status.plan && (
              <Box marginLeft={2}>
                <Text dimColor>{format(t().license.platform, { platform: status.plan })}</Text>
              </Box>
            )}
          </Box>
        );

      case 'trial':
        return (
          <Box flexDirection="column">
            <Box>
              <Text color="yellow">⏳ </Text>
              <Text bold color="yellow">{format(t().license.statusTrial, { days: String(status.trialDays || 0) })}</Text>
            </Box>
            <Box marginLeft={2} marginTop={1}>
              <Text dimColor>Press </Text>
              <Text color="cyan">a</Text>
              <Text dimColor> to activate a license key</Text>
            </Box>
          </Box>
        );

      case 'expired':
        return (
          <Box flexDirection="column">
            <Box>
              <Text color="red">✗ </Text>
              <Text bold color="red">{t().license.statusExpired}</Text>
            </Box>
            <Box marginTop={1}>
              <Text dimColor>Press </Text>
              <Text color="cyan">a</Text>
              <Text dimColor> to activate a license key</Text>
            </Box>
          </Box>
        );

      default:
        return (
          <Box flexDirection="column">
            <Box>
              <Text dimColor>○ </Text>
              <Text>{t().license.statusNone}</Text>
            </Box>
            <Box marginTop={1} flexDirection="column">
              <Box>
                <Text dimColor>Press </Text>
                <Text color="cyan">a</Text>
                <Text dimColor> to activate a license key</Text>
              </Box>
              <Box>
                <Text dimColor>Press </Text>
                <Text color="cyan">t</Text>
                <Text dimColor> to start 7-day trial</Text>
              </Box>
            </Box>
          </Box>
        );
    }
  };

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      paddingX={1}
      paddingY={0}
    >
      <Box marginBottom={1}>
        <Text bold color="cyan">{t().license.title}</Text>
        <Text dimColor> • Esc close</Text>
      </Box>

      {mode === 'status' && renderStatus()}

      {mode === 'input' && (
        <Box flexDirection="column">
          <Text>{t().license.enterKey}</Text>
          <Box marginTop={1}>
            <Text color="cyan">❯ </Text>
            <Text>{inputKey}</Text>
            <Text color="cyan">▌</Text>
          </Box>
          {error && (
            <Box marginTop={1}>
              <Text color="red">✗ {error}</Text>
            </Box>
          )}
          <Box marginTop={1}>
            <Text dimColor>Format: XXXX-XXXX-XXXX-XXXX • Enter to submit • Esc to cancel</Text>
          </Box>
        </Box>
      )}

      {mode === 'activating' && (
        <Box>
          <Text color="yellow">⠋ </Text>
          <Text>{t().license.activating}</Text>
        </Box>
      )}
    </Box>
  );
}
