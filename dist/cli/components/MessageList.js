import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from 'ink';
import { getTextContent } from '../../llm/types.js';
function MessageBubble({ message }) {
    const isUser = message.role === 'user';
    const isAssistant = message.role === 'assistant';
    const isTool = message.role === 'tool';
    const content = getTextContent(message.content);
    if (isTool) {
        return (_jsxs(Box, { marginY: 0, paddingLeft: 2, children: [_jsx(Text, { dimColor: true, children: "\u2503 " }), _jsxs(Text, { color: "gray", children: [content.slice(0, 100), "..."] })] }));
    }
    return (_jsxs(Box, { flexDirection: "column", marginY: 1, children: [_jsx(Box, { children: isUser ? (_jsx(Text, { bold: true, color: "blue", children: "\u276F You" })) : isAssistant ? (_jsx(Text, { bold: true, color: "green", children: "\u25C6 Assistant" })) : (_jsx(Text, { bold: true, color: "gray", children: "\u25CF System" })) }), _jsx(Box, { paddingLeft: 2, marginTop: 0, children: _jsx(Text, { wrap: "wrap", children: content }) })] }));
}
export function MessageList({ messages }) {
    // Only show user and assistant messages, skip system
    const visibleMessages = messages.filter(m => m.role === 'user' || m.role === 'assistant');
    const lastMessages = visibleMessages.slice(-6); // Show last 6 messages
    return (_jsx(Box, { flexDirection: "column", children: lastMessages.map((msg, i) => (_jsx(MessageBubble, { message: msg }, i))) }));
}
//# sourceMappingURL=MessageList.js.map