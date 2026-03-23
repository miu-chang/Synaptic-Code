import chalk from 'chalk';
export async function selectOption(title, options, currentValue) {
    return new Promise((resolve) => {
        let selectedIndex = options.findIndex((o) => o.value === currentValue);
        if (selectedIndex === -1)
            selectedIndex = 0;
        const render = () => {
            // Clear previous render
            process.stdout.write('\x1B[?25l'); // Hide cursor
            console.log();
            console.log(chalk.bold.cyan(`  ${title}`));
            console.log(chalk.dim('  Use ↑↓ to navigate, Enter to select, Esc to cancel\n'));
            options.forEach((option, i) => {
                const isSelected = i === selectedIndex;
                const isCurrent = option.value === currentValue;
                const prefix = isSelected ? chalk.cyan('❯ ') : '  ';
                const label = isSelected ? chalk.bold(option.label) : option.label;
                const current = isCurrent ? chalk.dim(' (current)') : '';
                const desc = option.description ? chalk.dim(` - ${option.description}`) : '';
                console.log(`${prefix}${label}${current}${desc}`);
            });
            console.log();
        };
        const clearRender = () => {
            // Move cursor up and clear lines
            const linesToClear = options.length + 5;
            process.stdout.write(`\x1B[${linesToClear}A`);
            for (let i = 0; i < linesToClear; i++) {
                process.stdout.write('\x1B[2K\n');
            }
            process.stdout.write(`\x1B[${linesToClear}A`);
            process.stdout.write('\x1B[?25h'); // Show cursor
        };
        // Raw mode for key detection
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(true);
        }
        process.stdin.resume();
        render();
        const onKeypress = (key) => {
            const keyStr = key.toString();
            // Arrow up or k
            if (keyStr === '\x1B[A' || keyStr === 'k') {
                selectedIndex = (selectedIndex - 1 + options.length) % options.length;
                clearRender();
                render();
            }
            // Arrow down or j
            else if (keyStr === '\x1B[B' || keyStr === 'j') {
                selectedIndex = (selectedIndex + 1) % options.length;
                clearRender();
                render();
            }
            // Enter
            else if (keyStr === '\r' || keyStr === '\n') {
                cleanup();
                clearRender();
                resolve(options[selectedIndex].value);
            }
            // Escape or q
            else if (keyStr === '\x1B' || keyStr === 'q') {
                cleanup();
                clearRender();
                resolve(null);
            }
            // Ctrl+C
            else if (keyStr === '\x03') {
                cleanup();
                clearRender();
                resolve(null);
            }
        };
        const cleanup = () => {
            process.stdin.removeListener('data', onKeypress);
            if (process.stdin.isTTY) {
                process.stdin.setRawMode(false);
            }
        };
        process.stdin.on('data', onKeypress);
    });
}
export async function selectProvider() {
    const options = [
        { label: 'LM Studio', value: 'lmstudio', description: 'localhost:1234' },
        { label: 'Ollama', value: 'ollama', description: 'localhost:11434' },
        { label: 'OpenAI Compatible', value: 'openai', description: 'Custom endpoint' },
    ];
    return selectOption('Select Provider', options);
}
//# sourceMappingURL=selector.js.map