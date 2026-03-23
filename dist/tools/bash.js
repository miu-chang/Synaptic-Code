import { spawn } from 'child_process';
export const bashTool = {
    definition: {
        type: 'function',
        function: {
            name: 'bash',
            description: 'Execute a bash command. Use for system operations, git, npm, etc.',
            parameters: {
                type: 'object',
                properties: {
                    command: {
                        type: 'string',
                        description: 'The bash command to execute',
                    },
                    cwd: {
                        type: 'string',
                        description: 'Working directory for the command',
                    },
                    timeout: {
                        type: 'number',
                        description: 'Timeout in milliseconds (default: 30000)',
                    },
                },
                required: ['command'],
            },
        },
    },
    async execute(args) {
        const { command, cwd = process.cwd(), timeout = 30000 } = args;
        // Security: block dangerous commands
        const blockedPatterns = [
            /rm\s+-rf\s+[\/~]/,
            />\s*\/dev\/sd/,
            /mkfs\./,
            /dd\s+if=.*of=\/dev/,
            /:\(\)\{.*\|.*&\s*\};:/, // fork bomb
        ];
        for (const pattern of blockedPatterns) {
            if (pattern.test(command)) {
                return JSON.stringify({
                    error: 'Command blocked for safety reasons',
                    command,
                });
            }
        }
        return new Promise((resolve) => {
            const proc = spawn('bash', ['-c', command], {
                cwd,
                env: { ...process.env },
                timeout,
            });
            let stdout = '';
            let stderr = '';
            proc.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            proc.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            proc.on('close', (code) => {
                // Truncate very long output
                const maxLen = 50000;
                if (stdout.length > maxLen) {
                    stdout = stdout.slice(0, maxLen) + '\n... [output truncated]';
                }
                if (stderr.length > maxLen) {
                    stderr = stderr.slice(0, maxLen) + '\n... [output truncated]';
                }
                resolve(JSON.stringify({
                    exitCode: code,
                    stdout: stdout || undefined,
                    stderr: stderr || undefined,
                }));
            });
            proc.on('error', (err) => {
                resolve(JSON.stringify({
                    error: `Command failed: ${err.message}`,
                    command,
                }));
            });
        });
    },
};
export const bashBackgroundTool = {
    definition: {
        type: 'function',
        function: {
            name: 'bash_background',
            description: 'Run a command in the background. Returns immediately.',
            parameters: {
                type: 'object',
                properties: {
                    command: {
                        type: 'string',
                        description: 'The bash command to run in background',
                    },
                    cwd: {
                        type: 'string',
                        description: 'Working directory for the command',
                    },
                },
                required: ['command'],
            },
        },
    },
    async execute(args) {
        const { command, cwd = process.cwd() } = args;
        const proc = spawn('bash', ['-c', command], {
            cwd,
            detached: true,
            stdio: 'ignore',
        });
        proc.unref();
        return JSON.stringify({
            success: true,
            pid: proc.pid,
            message: `Command started in background with PID ${proc.pid}`,
        });
    },
};
export const bashTools = [bashTool, bashBackgroundTool];
//# sourceMappingURL=bash.js.map