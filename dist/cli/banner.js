import chalk from 'chalk';
export const BANNER = `
${chalk.cyan('  ╦   ╔═╗╔═╗╔═╗╦    ╔═╗╔═╗╔╦╗╔═╗')}
${chalk.cyan('  ║   ║ ║║  ╠═╣║    ║  ║ ║ ║║║╣ ')}
${chalk.cyan('  ╩═╝ ╚═╝╚═╝╩ ╩╩═╝  ╚═╝╚═╝═╩╝╚═╝')}
`;
export const BANNER_SIMPLE = `
${chalk.bold.cyan('  ┌─────────────────────────────┐')}
${chalk.bold.cyan('  │')}  ${chalk.bold.white('L O C A L   C O D E')}        ${chalk.bold.cyan('│')}
${chalk.bold.cyan('  │')}  ${chalk.dim('AI-Powered Coding Assistant')} ${chalk.bold.cyan('│')}
${chalk.bold.cyan('  └─────────────────────────────┘')}
`;
export const BANNER_BLOCK = `
${chalk.cyan('  ██╗      ██████╗  ██████╗ █████╗ ██╗')}
${chalk.cyan('  ██║     ██╔═══██╗██╔════╝██╔══██╗██║')}
${chalk.cyan('  ██║     ██║   ██║██║     ███████║██║')}
${chalk.cyan('  ██║     ██║   ██║██║     ██╔══██║██║')}
${chalk.cyan('  ███████╗╚██████╔╝╚██████╗██║  ██║███████╗')}
${chalk.cyan('  ╚══════╝ ╚═════╝  ╚═════╝╚═╝  ╚═╝╚══════╝')}
${chalk.blue('   ██████╗ ██████╗ ██████╗ ███████╗')}
${chalk.blue('  ██╔════╝██╔═══██╗██╔══██╗██╔════╝')}
${chalk.blue('  ██║     ██║   ██║██║  ██║█████╗  ')}
${chalk.blue('  ██║     ██║   ██║██║  ██║██╔══╝  ')}
${chalk.blue('  ╚██████╗╚██████╔╝██████╔╝███████╗')}
${chalk.blue('   ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝')}
`;
export const BANNER_MINIMAL = `
${chalk.bold.cyan('  ⚡ Local Code')} ${chalk.dim('v0.1.0')}
`;
export const BANNER_GRADIENT = `
${chalk.hex('#00D9FF')('  ╭─────────────────────────────────╮')}
${chalk.hex('#00D9FF')('  │')} ${chalk.hex('#00BFFF').bold('  _                    _  ')}      ${chalk.hex('#00D9FF')('│')}
${chalk.hex('#00CFFF')('  │')} ${chalk.hex('#00AFFF').bold(' | |    ___   ___ __ _| | ')}      ${chalk.hex('#00CFFF')('│')}
${chalk.hex('#00BFFF')('  │')} ${chalk.hex('#009FFF').bold(' | |   / _ \\ / __/ _` | | ')}      ${chalk.hex('#00BFFF')('│')}
${chalk.hex('#00AFFF')('  │')} ${chalk.hex('#008FFF').bold(' | |__| (_) | (_| (_| | | ')}      ${chalk.hex('#00AFFF')('│')}
${chalk.hex('#009FFF')('  │')} ${chalk.hex('#007FFF').bold(' |_____\\___/ \\___\\__,_|_| ')}      ${chalk.hex('#009FFF')('│')}
${chalk.hex('#008FFF')('  │')} ${chalk.hex('#006FFF').bold('   ____          _       ')}      ${chalk.hex('#008FFF')('│')}
${chalk.hex('#007FFF')('  │')} ${chalk.hex('#005FFF').bold('  / ___|___   __| | ___  ')}      ${chalk.hex('#007FFF')('│')}
${chalk.hex('#006FFF')('  │')} ${chalk.hex('#004FFF').bold(' | |   / _ \\ / _` |/ _ \\ ')}      ${chalk.hex('#006FFF')('│')}
${chalk.hex('#005FFF')('  │')} ${chalk.hex('#003FFF').bold(' | |__| (_) | (_| |  __/ ')}      ${chalk.hex('#005FFF')('│')}
${chalk.hex('#004FFF')('  │')} ${chalk.hex('#002FFF').bold('  \\____\\___/ \\__,_|\\___| ')}      ${chalk.hex('#004FFF')('│')}
${chalk.hex('#003FFF')('  ╰─────────────────────────────────╯')}
`;
export const BANNER_COOL = `
${chalk.hex('#667eea')('    __                     __')}
${chalk.hex('#667eea')('   / /  ___  ______ _/ /')}
${chalk.hex('#764ba2')('  / /__/ _ \\/ __/ _ `/ / ')}
${chalk.hex('#764ba2')(' /____/\\___/\\__/\\_,_/_/  ')}
${chalk.hex('#f093fb')('   _____          __   ')}
${chalk.hex('#f093fb')('  / ___/__  ___/ /__')}
${chalk.hex('#f5576c')(' / /__/ _ \\/ _  / -_)')}
${chalk.hex('#f5576c')(' \\___/\\___/\\_,_/\\__/ ')}
`;
export function printBanner(style = 'default') {
    switch (style) {
        case 'simple':
            console.log(BANNER_SIMPLE);
            break;
        case 'block':
            console.log(BANNER_BLOCK);
            break;
        case 'minimal':
            console.log(BANNER_MINIMAL);
            break;
        case 'gradient':
            console.log(BANNER_GRADIENT);
            break;
        case 'cool':
            console.log(BANNER_COOL);
            break;
        default:
            console.log(BANNER);
    }
}
export function printStartupInfo(provider, model, toolCount) {
    console.log(chalk.dim(`  Provider: ${chalk.white(provider)}`));
    console.log(chalk.dim(`  Model: ${chalk.white(model)}`));
    console.log(chalk.dim(`  Tools: ${chalk.white(toolCount.toString())} available`));
    console.log();
    console.log(chalk.dim('  Type ') + chalk.cyan('/') + chalk.dim(' for commands, ') + chalk.cyan('/quit') + chalk.dim(' to exit'));
    console.log();
}
//# sourceMappingURL=banner.js.map