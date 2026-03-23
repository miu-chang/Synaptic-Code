/**
 * @mention Parser for Synaptic Ecosystem
 * --------------------------------------
 * Parses @blender and @unity mentions in user input.
 * Supports pipe chains for sequential tool execution.
 *
 * Examples:
 *   @blender create_cube name=MyCube
 *   @unity unity_create_gameobject name=Player type=capsule
 *   @blender export_fbx path=/tmp/model.fbx
 *
 * Pipe chains (pass previous result to next tool):
 *   @unity unity_create_gameobject name=Cube type=cube | unity_set_transform position={0,5,0}
 *   @blender create_cube | set_material name=Red | export_fbx path=/tmp/out.fbx
 */
import * as client from './client.js';
export interface MentionCommand {
    server: 'blender' | 'unity';
    tool: string;
    params: Record<string, string>;
    raw: string;
    /** If true, this command receives output from previous command in chain */
    isPiped?: boolean;
}
export interface ParseResult {
    hasMention: boolean;
    commands: MentionCommand[];
    textWithoutMentions: string;
}
/**
 * Parse @mentions from input text (supports pipe chains)
 */
export declare function parseMentions(input: string): ParseResult;
/**
 * Check if input starts with @blender or @unity
 */
export declare function hasMention(input: string): boolean;
/**
 * Execute a single mention command
 */
export declare function executeMention(command: MentionCommand): Promise<client.ExecuteResult>;
/**
 * Execute all mentions in input (supports pipe chains)
 * For piped commands, the previous result is passed as context
 */
export declare function executeAllMentions(input: string): Promise<{
    results: Array<{
        command: MentionCommand;
        result: client.ExecuteResult;
    }>;
    remainingText: string;
}>;
/**
 * Format execution result for display
 */
export declare function formatResult(command: MentionCommand, result: client.ExecuteResult): string;
/**
 * Get autocomplete suggestions for @mentions
 */
export declare function getAutocompleteSuggestions(partial: string): Array<{
    text: string;
    description: string;
}>;
//# sourceMappingURL=mention.d.ts.map