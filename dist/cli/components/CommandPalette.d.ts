import React from 'react';
export declare function getCommands(): {
    name: string;
    description: string;
    shortcut: string | undefined;
}[];
export declare const COMMANDS: {
    name: string;
    description: "history" | "provider" | "language" | "model" | "tools" | "help" | "new" | "clear" | "compact" | "agent" | "todo" | "license" | "config" | "synaptic" | "self" | "timeline" | "diff" | "quit";
    shortcut: string | undefined;
}[];
export declare const COMMAND_NAMES: Set<string>;
interface CommandPaletteProps {
    onSelect: (command: string) => void;
    onClose: () => void;
}
export declare function CommandPalette({ onSelect, onClose }: CommandPaletteProps): React.ReactElement;
export {};
//# sourceMappingURL=CommandPalette.d.ts.map