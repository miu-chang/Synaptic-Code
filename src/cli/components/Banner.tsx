import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { useScrollPaused } from './ScrollContext.js';
import { type LicenseInfo } from '../../license/index.js';

const VERSION = '0.1.0';

const BORDER = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';

interface BannerProps {
  cwd?: string;
  isGitRepo?: boolean;
  licenseStatus?: LicenseInfo;
}

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
function getColor(lineIndex: number, isSynaptic: boolean): 'magenta' | 'blueBright' | 'cyan' {
  if (isSynaptic) {
    return lineIndex === 2 || lineIndex === 3 ? 'blueBright' : 'magenta';
  } else {
    return lineIndex === 2 || lineIndex === 3 ? 'blueBright' : 'cyan';
  }
}

interface WaveLineProps {
  text: string;
  color: 'magenta' | 'blueBright' | 'cyan';
  lineIndex: number;
  frame: number;
  animationDone: boolean;
}

function WaveLine({ text, color, lineIndex, frame, animationDone }: WaveLineProps): React.ReactElement {
  if (animationDone) {
    return <Text color={color}>  {text}</Text>;
  }

  // Horizontal wave: each line shifts left/right based on sine wave
  const phase = (frame * 0.5) - (lineIndex * 0.6);
  const xOffset = Math.round(Math.sin(phase) * 2);
  const padding = '  ' + ' '.repeat(Math.max(0, xOffset));

  return (
    <Text color={color}>{padding}{text}</Text>
  );
}

export function Banner({ cwd, isGitRepo, licenseStatus }: BannerProps = {}): React.ReactElement {
  const [frame, setFrame] = useState(0);
  const [animationDone, setAnimationDone] = useState(false);
  const paused = useScrollPaused();

  useEffect(() => {
    if (animationDone || paused) return;

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

  return (
    <Box flexDirection="column" marginY={1}>
      <Text color="cyan">{BORDER}</Text>
      <Text> </Text>

      {SYNAPTIC_LINES.map((line, i) => (
        <WaveLine
          key={`s${i}`}
          text={line}
          color={getColor(i, true)}
          lineIndex={i}
          frame={frame}
          animationDone={animationDone}
        />
      ))}

      <Text> </Text>

      {CODE_LINES.map((line, i) => (
        <WaveLine
          key={`c${i}`}
          text={line}
          color={getColor(i, false)}
          lineIndex={i + 7}
          frame={frame}
          animationDone={animationDone}
        />
      ))}

      <Text> </Text>
      <Text color="cyan">{BORDER}</Text>
      <Box marginTop={1} flexDirection="column">
        <Text dimColor>v{VERSION} • Local LLM Coding Assistant</Text>
        {cwd && (
          <Box>
            <Text color="cyan">{cwd}</Text>
            {isGitRepo && <Text color="green"> (git)</Text>}
          </Box>
        )}
        {licenseStatus && <LicenseStatusLine status={licenseStatus} />}
      </Box>
    </Box>
  );
}

// Memoized license status line - only re-renders when status changes
const LicenseStatusLine = React.memo(function LicenseStatusLine({ status }: { status: LicenseInfo }): React.ReactElement | null {
  if (status.status === 'valid') {
    return (
      <Box>
        <Text color="green">✓ Licensed</Text>
        {status.plan && <Text dimColor> ({status.plan})</Text>}
      </Box>
    );
  }

  if (status.status === 'trial') {
    return (
      <Box>
        <Text color="yellow">⏳ Trial: {status.trialDays} days remaining</Text>
      </Box>
    );
  }

  if (status.status === 'offline') {
    return (
      <Box>
        <Text color="yellow">⚠ Offline mode (cached license)</Text>
      </Box>
    );
  }

  return null;
});

export function BannerSmall(): React.ReactElement {
  return (
    <Box marginY={1}>
      <Text bold color="magenta">[*] Synaptic Code</Text>
      <Text dimColor> v0.1.0</Text>
    </Box>
  );
}
