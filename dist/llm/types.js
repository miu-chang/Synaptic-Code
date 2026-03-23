/**
 * Extract text from MessageContent (handles both string and ContentPart[])
 */
export function getTextContent(content) {
    if (typeof content === 'string') {
        return content;
    }
    // Extract text from ContentPart array
    return content
        .filter((part) => part.type === 'text')
        .map(part => part.text)
        .join('\n');
}
/**
 * Check if MessageContent is empty
 */
export function isContentEmpty(content) {
    if (typeof content === 'string') {
        return !content.trim();
    }
    return content.length === 0 || getTextContent(content).trim() === '';
}
//# sourceMappingURL=types.js.map