import React from 'react';
import { Box, Text } from 'ink';
import type { Message } from '../../llm/types.js';
import { getTextContent } from '../../llm/types.js';

interface MessageListProps {
  messages: Message[];
}

function MessageBubble({ message }: { message: Message }): React.ReactElement {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const isTool = message.role === 'tool';
  const content = getTextContent(message.content);

  if (isTool) {
    return (
      <Box marginY={0} paddingLeft={2}>
        <Text dimColor>┃ </Text>
        <Text color="gray">{content.slice(0, 100)}...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" marginY={1}>
      <Box>
        {isUser ? (
          <Text bold color="blue">❯ You</Text>
        ) : isAssistant ? (
          <Text bold color="green">◆ Assistant</Text>
        ) : (
          <Text bold color="gray">● System</Text>
        )}
      </Box>
      <Box paddingLeft={2} marginTop={0}>
        <Text wrap="wrap">{content}</Text>
      </Box>
    </Box>
  );
}

export function MessageList({ messages }: MessageListProps): React.ReactElement {
  // Only show user and assistant messages, skip system
  const visibleMessages = messages.filter(m => m.role === 'user' || m.role === 'assistant');
  const lastMessages = visibleMessages.slice(-6); // Show last 6 messages

  return (
    <Box flexDirection="column">
      {lastMessages.map((msg, i) => (
        <MessageBubble key={i} message={msg} />
      ))}
    </Box>
  );
}
