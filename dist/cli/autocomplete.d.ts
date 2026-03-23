export interface Command {
    name: string;
    description: string;
    aliases?: string[];
}
export declare const COMMANDS: Command[];
export declare function filterCommands(input: string): Command[];
export declare function formatCommandList(commands: Command[], selectedIndex: number): string;
export declare class CommandAutocomplete {
    private selectedIndex;
    private commands;
    private input;
    private displayedLines;
    select(): Promise<string | null>;
    private render;
    private clearRender;
}
//# sourceMappingURL=autocomplete.d.ts.map