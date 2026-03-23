/**
 * First-run Setup Wizard for Synaptic Code
 * =========================================
 * Guides user through LM Studio installation and model setup
 */

import chalk from 'chalk';
import ora from 'ora';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { homedir, platform, totalmem } from 'os';
import { join } from 'path';
import * as readline from 'readline';
import * as lms from '../lms/client.js';
import { loadSettings, saveSettings } from '../config/settings.js';
import { t, format, setLanguage } from '../i18n/index.js';
import {
  getLicenseStatus,
  activateLicense,
  startTrial,
  hasValidAccess,
  isValidKeyFormat,
  maskLicenseKey,
  type LicenseInfo,
} from '../license/index.js';

// Recommended models based on system memory
interface RecommendedModel {
  id: string;
  name: string;
  minRam: number; // GB
  url: string;
  description: string;
}

// Model definitions without descriptions (descriptions come from i18n)
type ModelDescKey = 'qwen35_35b' | 'gptOss20b' | 'qwen35_14b' | 'gemma3_12b' | 'qwen35_9b' | 'gemma3_4b' | 'qwen35_27b' | 'qwen35_122b' | 'llama4Maverick' | 'deepseekR1';

interface ModelDef {
  id: string;
  name: string;
  minRam: number;
  url: string;
  descKey: ModelDescKey;
}

// Main recommendations - balanced for speed and quality
const MODEL_DEFS: ModelDef[] = [
  { id: 'qwen3.5-35b-a3b', name: 'Qwen 3.5 35B-A3B', minRam: 24, url: 'https://lmstudio.ai/models/qwen/qwen3.5-35b-a3b', descKey: 'qwen35_35b' },
  { id: 'gpt-oss-20b', name: 'GPT-OSS 20B', minRam: 20, url: 'https://lmstudio.ai/models/openai/gpt-oss-20b', descKey: 'gptOss20b' },
  { id: 'qwen3.5-14b', name: 'Qwen 3.5 14B', minRam: 16, url: 'https://lmstudio.ai/models/qwen/qwen3.5-14b', descKey: 'qwen35_14b' },
  { id: 'gemma-3-12b', name: 'Gemma 3 12B', minRam: 14, url: 'https://lmstudio.ai/models/google/gemma-3-12b', descKey: 'gemma3_12b' },
  { id: 'qwen3.5-9b', name: 'Qwen 3.5 9B', minRam: 12, url: 'https://lmstudio.ai/models/qwen/qwen3.5-9b', descKey: 'qwen35_9b' },
  { id: 'gemma-3-4b', name: 'Gemma 3 4B', minRam: 8, url: 'https://lmstudio.ai/models/google/gemma-3-4b', descKey: 'gemma3_4b' },
];

// Optional advanced models (slower but higher quality)
const OPTIONAL_MODEL_DEFS: ModelDef[] = [
  { id: 'qwen3.5-27b', name: 'Qwen 3.5 27B (Dense)', minRam: 48, url: 'https://lmstudio.ai/models/qwen/qwen3.5-27b', descKey: 'qwen35_27b' },
  { id: 'qwen3.5-122b-a10b', name: 'Qwen 3.5 122B-A10B', minRam: 80, url: 'https://lmstudio.ai/models/qwen/qwen3.5-122b-a10b', descKey: 'qwen35_122b' },
  { id: 'llama-4-maverick', name: 'Llama 4 Maverick 400B', minRam: 250, url: 'https://lmstudio.ai/models/meta/llama-4-maverick', descKey: 'llama4Maverick' },
  { id: 'deepseek-r1', name: 'DeepSeek R1 671B', minRam: 400, url: 'https://lmstudio.ai/models/deepseek/deepseek-r1', descKey: 'deepseekR1' },
];

// Build models with translated descriptions
function getTranslatedModels(): RecommendedModel[] {
  const desc = t().setup.modelDesc;
  return MODEL_DEFS.map(m => ({
    id: m.id,
    name: m.name,
    minRam: m.minRam,
    url: m.url,
    description: desc[m.descKey] || m.name,
  }));
}

function getTranslatedOptionalModels(): RecommendedModel[] {
  const desc = t().setup.modelDesc;
  return OPTIONAL_MODEL_DEFS.map(m => ({
    id: m.id,
    name: m.name,
    minRam: m.minRam,
    url: m.url,
    description: desc[m.descKey] || m.name,
  }));
}

/**
 * Get system RAM in GB
 */
function getSystemRamGB(): number {
  return Math.round(totalmem() / (1024 * 1024 * 1024));
}

/**
 * Get recommended models for this system
 */
function getRecommendedModels(): {
  recommended: RecommendedModel;
  alternatives: RecommendedModel[];
  optional: RecommendedModel[];
} {
  const ramGB = getSystemRamGB();
  const allModels = getTranslatedModels();
  const optionalModels = getTranslatedOptionalModels();

  // Find the best model that fits in RAM
  const suitable = allModels.filter(m => m.minRam <= ramGB);

  // Optional advanced models that fit in RAM
  const optional = optionalModels.filter(m => m.minRam <= ramGB);

  if (suitable.length === 0) {
    // Fallback to smallest model
    return {
      recommended: allModels[allModels.length - 1],
      alternatives: [],
      optional,
    };
  }

  // Best model is the largest that fits
  const recommended = suitable[0];
  const alternatives = suitable.slice(1);

  return { recommended, alternatives, optional };
}

const LMS_APP_PATH_MAC = '/Applications/LM Studio.app';
const LMS_APP_PATH_WIN = join(process.env.LOCALAPPDATA || '', 'Programs', 'LM Studio', 'LM Studio.exe');
const LMS_DOWNLOAD_URL = 'https://lmstudio.ai/download';

// Set to true to test setup wizard UI even when LM Studio is installed
const DEBUG_FORCE_NOT_INSTALLED = false;
const DEBUG_FORCE_NO_MODELS = false;
const DEBUG_FORCE_NO_CLI = false;

/**
 * Debug wrapper for CLI installed check
 */
function isCliInstalled(): boolean {
  if (DEBUG_FORCE_NO_CLI) return false;
  return lms.isLmsInstalled();
}

/**
 * Check if LM Studio app is installed (not just CLI)
 */
function isLmStudioAppInstalled(): boolean {
  if (DEBUG_FORCE_NOT_INSTALLED) return false;

  const os = platform();
  if (os === 'darwin') {
    return existsSync(LMS_APP_PATH_MAC);
  } else if (os === 'win32') {
    return existsSync(LMS_APP_PATH_WIN) || isCliInstalled();
  }
  // Linux: check for lms CLI
  return isCliInstalled();
}

/**
 * Open URL in default browser
 */
function openUrl(url: string): void {
  const os = platform();
  try {
    if (os === 'darwin') {
      execSync(`open "${url}"`);
    } else if (os === 'win32') {
      execSync(`start "${url}"`);
    } else {
      execSync(`xdg-open "${url}"`);
    }
  } catch {
    console.log(chalk.dim(`Please open: ${url}`));
  }
}

/**
 * Open LM Studio app
 */
function openLmStudio(): boolean {
  const os = platform();
  try {
    if (os === 'darwin' && existsSync(LMS_APP_PATH_MAC)) {
      execSync('open -a "LM Studio"');
      return true;
    } else if (os === 'win32' && existsSync(LMS_APP_PATH_WIN)) {
      execSync(`start "" "${LMS_APP_PATH_WIN}"`, { shell: 'cmd.exe', stdio: 'pipe' });
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * Wait for user input (press Enter)
 */
async function waitForEnter(prompt: string): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(prompt, () => {
      rl.close();
      resolve();
    });
  });
}

/**
 * Ask yes/no question (single keypress, no Enter needed)
 */
async function askYesNo(question: string, defaultYes = true): Promise<boolean> {
  const hint = defaultYes ? '[Y/n]' : '[y/N]';
  process.stdout.write(`${question} ${hint} `);

  return new Promise((resolve) => {
    const wasRaw = process.stdin.isRaw;
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();

    const onData = (key: Buffer) => {
      const char = key.toString().toLowerCase();

      // Ctrl+C
      if (key[0] === 3) {
        process.stdout.write('\n');
        process.exit(0);
      }

      // Enter = default
      if (char === '\r' || char === '\n') {
        process.stdout.write(defaultYes ? 'y\n' : 'n\n');
        cleanup();
        resolve(defaultYes);
        return;
      }

      // y or n
      if (char === 'y') {
        process.stdout.write('y\n');
        cleanup();
        resolve(true);
        return;
      }
      if (char === 'n') {
        process.stdout.write('n\n');
        cleanup();
        resolve(false);
        return;
      }
    };

    const cleanup = () => {
      process.stdin.removeListener('data', onData);
      if (process.stdin.isTTY && wasRaw !== undefined) {
        process.stdin.setRawMode(wasRaw);
      }
      process.stdin.pause();
    };

    process.stdin.on('data', onData);
  });
}

/**
 * Select from list
 */
/**
 * Select from list with single keypress
 */
async function selectFromList(prompt: string, options: string[]): Promise<string | null> {
  console.log();
  console.log(chalk.bold(prompt));
  console.log();

  options.forEach((opt, i) => {
    // Use 1-9, then a-z for 10+
    const key = i < 9 ? String(i + 1) : String.fromCharCode(97 + i - 9); // a, b, c...
    console.log(`  ${chalk.cyan(key)}. ${opt}`);
  });
  console.log(`  ${chalk.dim('0')}. ${chalk.dim(t().setup.cancel)}`);
  console.log();

  return new Promise((resolve) => {
    const wasRaw = process.stdin.isRaw;
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();

    const cleanup = () => {
      process.stdin.removeListener('data', onData);
      if (process.stdin.isTTY && wasRaw !== undefined) {
        process.stdin.setRawMode(wasRaw);
      }
      process.stdin.pause();
    };

    const onData = (key: Buffer) => {
      const char = key.toString().toLowerCase();

      // Ctrl+C
      if (key[0] === 3) {
        cleanup();
        process.stdout.write('\n');
        process.exit(0);
      }

      // Escape or 0 = cancel
      if (char === '\x1B' || char === '0') {
        process.stdout.write('0\n');
        cleanup();
        resolve(null);
        return;
      }

      // 1-9
      if (char >= '1' && char <= '9') {
        const idx = parseInt(char) - 1;
        if (idx < options.length) {
          process.stdout.write(char + '\n');
          cleanup();
          resolve(options[idx]);
          return;
        }
      }

      // a-z for items 10+
      if (char >= 'a' && char <= 'z') {
        const idx = char.charCodeAt(0) - 97 + 9; // a=9, b=10, etc.
        if (idx < options.length) {
          process.stdout.write(char + '\n');
          cleanup();
          resolve(options[idx]);
          return;
        }
      }
    };

    process.stdin.on('data', onData);
  });
}

/**
 * Print setup banner
 */
function printSetupBanner(): void {
  console.log();
  console.log(chalk.magenta('  ███████╗██╗   ██╗███╗   ██╗ █████╗ ██████╗ ████████╗██╗ ██████╗'));
  console.log(chalk.magenta('  ██╔════╝╚██╗ ██╔╝████╗  ██║██╔══██╗██╔══██╗╚══██╔══╝██║██╔════╝'));
  console.log(chalk.blueBright('  ███████╗ ╚████╔╝ ██╔██╗ ██║███████║██████╔╝   ██║   ██║██║     '));
  console.log(chalk.blueBright('  ╚════██║  ╚██╔╝  ██║╚██╗██║██╔══██║██╔═══╝    ██║   ██║██║     '));
  console.log(chalk.magenta('  ███████║   ██║   ██║ ╚████║██║  ██║██║        ██║   ██║╚██████╗'));
  console.log(chalk.magenta('  ╚══════╝   ╚═╝   ╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝        ╚═╝   ╚═╝ ╚═════╝'));
  console.log();
  console.log(chalk.cyan('   ██████╗ ██████╗ ██████╗ ███████╗'));
  console.log(chalk.cyan('  ██╔════╝██╔═══██╗██╔══██╗██╔════╝'));
  console.log(chalk.blueBright('  ██║     ██║   ██║██║  ██║█████╗  '));
  console.log(chalk.blueBright('  ██║     ██║   ██║██║  ██║██╔══╝  '));
  console.log(chalk.cyan('  ╚██████╗╚██████╔╝██████╔╝███████╗'));
  console.log(chalk.cyan('   ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝'));
  console.log();
  console.log(chalk.bold.white(`  ${t().setup.welcome}`));
  console.log(chalk.dim(`  ${t().setup.localAiAssistant}`));
  console.log();
}

/**
 * Step 1: Check/Install LM Studio
 */
async function setupLmStudio(): Promise<boolean> {
  console.log(chalk.bold(`\n━━━ ${t().setup.step1Title} ━━━\n`));

  // Check if already installed
  if (isLmStudioAppInstalled()) {
    console.log(chalk.green(`  ✓ ${t().setup.lmStudioInstalled}`));
    return true;
  }

  console.log(chalk.yellow(`  ${t().setup.lmStudioNotFound}`));
  console.log(chalk.dim(`  ${t().setup.lmStudioDesc}`));
  console.log();

  const install = await askYesNo(`  ${t().setup.openDownloadPage}`);

  if (install) {
    console.log(chalk.dim('\n  Opening LM Studio download page...'));
    openUrl(LMS_DOWNLOAD_URL);
    console.log();
    console.log(chalk.cyan(`  ${t().setup.instructions}`));
    console.log(chalk.dim(`  1. ${t().setup.downloadAndInstall}`));
    console.log(chalk.dim(`  2. ${t().setup.openLmStudioOnce}`));
    console.log(chalk.dim(`  3. ${t().setup.enableCli}`));
    console.log();
    await waitForEnter(`  ${t().setup.pressEnterWhenDone}`);

    // Check again
    if (isLmStudioAppInstalled() || isCliInstalled()) {
      console.log(chalk.green(`  ✓ ${t().setup.lmStudioDetected}`));
      return true;
    } else {
      console.log(chalk.yellow(`  ${t().setup.continueWithoutLmStudio}`));
      return false;
    }
  }

  return false;
}

/**
 * Step 2: Check/Enable LMS CLI
 */
async function setupLmsCli(): Promise<boolean> {
  console.log(chalk.bold(`\n━━━ ${t().setup.step2Title} ━━━\n`));

  if (isCliInstalled()) {
    console.log(chalk.green(`  ✓ ${t().setup.cliEnabled}`));
    return true;
  }

  console.log(chalk.yellow(`  ${t().setup.cliNotEnabled}`));
  console.log();
  console.log(chalk.cyan(`  ${t().setup.instructions}`));
  t().setup.cliInstructions.forEach((instruction, i) => {
    console.log(chalk.dim(`  ${i + 1}. ${instruction}`));
  });
  console.log();

  const openApp = await askYesNo(`  ${t().setup.openLmStudio}`);
  if (openApp) {
    openLmStudio();
  }

  await waitForEnter(`  ${t().setup.pressEnterWhenCliEnabled}`);

  if (isCliInstalled()) {
    console.log(chalk.green(`  ✓ ${t().setup.cliDetected}`));
    return true;
  }

  console.log(chalk.yellow(`  ${t().setup.continuingWithoutCli}`));
  return false;
}

/**
 * Step 3: Start server and load model
 */
async function setupModel(): Promise<string | null> {
  console.log(chalk.bold(`\n━━━ ${t().setup.step3Title} ━━━\n`));

  // Check if server is running
  const spinner = ora(t().setup.checkingServer).start();
  let serverRunning = await lms.isServerRunning();

  if (!serverRunning) {
    spinner.text = t().setup.startingServer;

    if (isCliInstalled()) {
      await lms.startServer();
      // Wait for server
      for (let i = 0; i < 15; i++) {
        await new Promise(r => setTimeout(r, 500));
        serverRunning = await lms.isServerRunning();
        if (serverRunning) break;
      }
    }

    if (!serverRunning) {
      spinner.warn(t().setup.serverNotRunning);
      console.log(chalk.dim('\n  ' + t().setup.instructions));
      t().setup.startServerInstructions.forEach((instruction, i) => {
        console.log(chalk.dim(`  ${i + 1}. ${instruction}`));
      });
      console.log();
      await waitForEnter(`  ${t().setup.pressEnterWhenServerRunning}`);
      serverRunning = await lms.isServerRunning();
    }
  }

  if (serverRunning) {
    spinner.succeed(t().setup.serverRunning);
  } else {
    spinner.fail(t().setup.serverNotResponding);
    console.log(chalk.yellow(`  ${t().setup.startServerLater}`));
    return null;
  }

  // Check for models
  console.log();
  const models = DEBUG_FORCE_NO_MODELS ? [] : lms.listModels();
  const loadedModels = DEBUG_FORCE_NO_MODELS ? [] : lms.listLoadedModels();

  if (loadedModels.length > 0) {
    console.log(chalk.green(`  ✓ ${format(t().setup.modelLoaded, { model: loadedModels[0] })}`));
    return loadedModels[0];
  }

  if (models.length === 0) {
    console.log(chalk.yellow(`  ${t().setup.noModelsInstalled}\n`));

    // Show recommended models based on system RAM
    const ramGB = getSystemRamGB();
    const { recommended, alternatives, optional } = getRecommendedModels();

    console.log(chalk.dim(`  ${format(t().setup.systemRam, { ram: ramGB })}`));
    console.log();
    console.log(chalk.cyan(`  ${t().setup.recommendedModel}`));
    console.log();
    console.log(`    ${chalk.bold.green('★')} ${chalk.bold(recommended.name)}`);
    console.log(chalk.dim(`       ${recommended.description}`));
    console.log(chalk.dim(`       ${format(t().setup.minRam, { ram: recommended.minRam })}`));
    console.log();

    if (alternatives.length > 0) {
      console.log(chalk.dim(`  ${t().setup.alternatives}`));
      for (const alt of alternatives) {
        console.log(chalk.dim(`    • ${alt.name} (${alt.minRam}GB+ RAM)`));
      }
      console.log();
    }

    // Show optional advanced models if system can handle them
    if (optional.length > 0) {
      console.log(chalk.dim(`  ${t().setup.advancedModels}`));
      for (const opt of optional) {
        console.log(chalk.dim(`    • ${opt.name} (${opt.minRam}GB+ RAM) - ${opt.description}`));
      }
      console.log();
    }

    // Check if CLI is available for direct download
    const canUseCli = isCliInstalled();

    if (canUseCli) {
      const downloadNow = await askYesNo(`  ${format(t().setup.downloadModelNow, { model: recommended.name })}`);
      if (downloadNow) {
        console.log();
        console.log(chalk.cyan(`  ${format(t().setup.downloading, { model: recommended.name })}`));

        const result = await lms.downloadModel(recommended.id, (progress) => {
          // Extract just percentage and speed from progress
          const percentMatch = progress.match(/(\d+\.?\d*)%/);
          const speedMatch = progress.match(/(\d+\.?\d*)\s*MB\/s/);
          if (percentMatch) {
            const percent = percentMatch[1];
            const speed = speedMatch ? `${speedMatch[1]} MB/s` : '';
            process.stdout.write(`\r\x1B[2K  ${percent}% ${speed}`);
          }
        });

        // Clear progress line
        process.stdout.write('\r\x1B[2K');

        if (result.success) {
          console.log(chalk.green(`  ✓ ${format(t().setup.downloadSuccess, { model: recommended.name })}`));
        } else {
          console.log(chalk.red(`  ✗ ${format(t().setup.downloadFailed, { error: result.message })}`));
          console.log(chalk.dim(`\n  ${t().setup.tryManually}`));
          await waitForEnter(`  ${t().setup.pressEnterWhenDone}`);
        }
      } else {
        // Interactive model selection
        const allModels = [recommended, ...alternatives, ...optional];
        const modelOptions = allModels.map(m => `${m.name} (${m.minRam}GB+) - ${m.description}`);

        const selected = await selectFromList(t().setup.selectModelPrompt, modelOptions);

        if (selected) {
          const selectedModel = allModels[modelOptions.indexOf(selected)];
          console.log();
          console.log(chalk.cyan(`  ${format(t().setup.downloading, { model: selectedModel.name })}`));

          const result = await lms.downloadModel(selectedModel.id, (progress) => {
            const percentMatch = progress.match(/(\d+\.?\d*)%/);
            const speedMatch = progress.match(/(\d+\.?\d*)\s*MB\/s/);
            if (percentMatch) {
              const percent = percentMatch[1];
              const speed = speedMatch ? `${speedMatch[1]} MB/s` : '';
              process.stdout.write(`\r\x1B[2K  ${percent}% ${speed}`);
            }
          });

          process.stdout.write('\r\x1B[2K');

          if (result.success) {
            console.log(chalk.green(`  ✓ ${format(t().setup.downloadSuccess, { model: selectedModel.name })}`));
          } else {
            console.log(chalk.red(`  ✗ ${format(t().setup.downloadFailed, { error: result.message })}`));
            console.log(chalk.dim(`\n  ${t().setup.tryManually}`));
            await waitForEnter(`  ${t().setup.pressEnterWhenDone}`);
          }
        } else {
          // Manual install option
          console.log(chalk.dim(`\n  ${t().setup.alternativeModels}`));
          for (const m of allModels) {
            console.log(chalk.dim(`    lms get ${m.id}`));
          }
          console.log();
          await waitForEnter(`  ${t().setup.pressEnterWhenModelDownloaded}`);
        }
      }
    } else {
      // No CLI - use browser
      const openPage = await askYesNo(`  ${format(t().setup.openDownloadPageFor, { model: recommended.name })}`);
      if (openPage) {
        openUrl(recommended.url);
        console.log();
        console.log(chalk.cyan(`  ${t().setup.instructions}`));
        console.log(chalk.dim(`  1. ${t().setup.downloadInLmStudio}`));
        console.log(chalk.dim(`  2. ${t().setup.waitForDownload}`));
      }
      console.log();
      await waitForEnter(`  ${t().setup.pressEnterWhenModelDownloaded}`);
    }

    // Check again
    const newModels = lms.listModels();
    if (newModels.length === 0) {
      console.log(chalk.yellow(`  ${t().setup.noModelsFound}`));
      return null;
    }
  }

  // Select and load a model
  const availableModels = lms.listModels();
  const modelNames = availableModels.map(m => `${m.name} (${m.params}, ${m.size})`);

  console.log(chalk.dim(`\n  ${t().setup.selectModelToLoad}`));
  const selected = await selectFromList(t().setup.availableModels, modelNames);

  if (selected) {
    const modelName = availableModels[modelNames.indexOf(selected)].name;
    const loadSpinner = ora(format(t().setup.loadingModel, { model: modelName })).start();

    const result = await lms.loadModel(modelName);
    if (result.success) {
      loadSpinner.succeed(format(t().setup.modelLoadSuccess, { model: modelName }));
      return modelName;
    } else {
      loadSpinner.fail(format(t().setup.modelLoadFailed, { error: result.message }));
      return null;
    }
  }

  return null;
}

/**
 * Step 0: License Activation
 */
async function setupLicense(): Promise<boolean> {
  console.log(chalk.bold(`\n━━━ ${t().license.stepTitle} ━━━\n`));

  const status = getLicenseStatus();

  // Show current status
  console.log(chalk.dim(`  ${t().license.currentStatus}:`));
  switch (status.status) {
    case 'valid':
      console.log(chalk.green(`  ✓ ${t().license.statusValid}`));
      if (status.key) {
        console.log(chalk.dim(`    Key: ${maskLicenseKey(status.key)}`));
      }
      if (status.activatedAt) {
        const date = new Date(status.activatedAt).toLocaleDateString();
        console.log(chalk.dim(`    ${format(t().license.activated, { date })}`));
      }
      return true;

    case 'trial':
      console.log(chalk.yellow(`  ⏳ ${format(t().license.statusTrial, { days: String(status.trialDays || 0) })}`));
      return true;

    case 'expired':
      console.log(chalk.red(`  ✗ ${t().license.statusExpired}`));
      break;

    default:
      console.log(chalk.dim(`  ${t().license.statusNone}`));
  }

  console.log();

  // Ask for license key
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const askForKey = (): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(`  ${t().license.enterKey} `, (answer) => {
        resolve(answer.trim());
      });
    });
  };

  const key = await askForKey();

  if (key) {
    if (!isValidKeyFormat(key)) {
      console.log(chalk.red(`\n  ✗ ${t().license.invalidFormat}`));
    } else {
      const spinner = ora(t().license.activating).start();
      const result = await activateLicense(key);

      if (result.success) {
        spinner.succeed(t().license.activationSuccess);
        rl.close();
        return true;
      } else {
        spinner.fail(format(t().license.activationFailed, { error: result.message || 'Unknown error' }));
      }
    }
  }

  rl.close();

  // Offer trial
  console.log();
  const startTrialOption = await askYesNo(`  ${t().license.startTrial}`);

  if (startTrialOption) {
    console.log(chalk.dim('  Registering trial...'));
    const trialInfo = await startTrial();
    if (trialInfo.status === 'trial') {
      console.log(chalk.green(`\n  ✓ ${format(t().license.trialStarted, { days: String(trialInfo.trialDays || 7) })}`));
      return true;
    } else if (trialInfo.status === 'none') {
      console.log(chalk.red('\n  ✗ Network required to start trial.'));
    }
  }

  // Skip option
  const skip = await askYesNo(`  ${t().license.skipForNow}`, false);
  if (skip) {
    console.log(chalk.dim(`\n  ${t().license.continueWithTrial}`));
    // Start trial automatically (requires network)
    console.log(chalk.dim('  Registering trial...'));
    const trialInfo = await startTrial();
    if (trialInfo.status === 'trial') {
      return true;
    }
    console.log(chalk.red('  ✗ Network required to start trial.'));
    return false;
  }

  console.log(chalk.yellow(`\n  ${t().license.licenseRequired}`));
  return false;
}

/**
 * Step 4: Connection test
 */
async function testConnection(model?: string | null): Promise<boolean> {
  console.log(chalk.bold(`\n━━━ ${t().setup.step4Title} ━━━\n`));

  const spinner = ora(t().setup.testingConnection).start();

  try {
    const response = await fetch('http://localhost:1234/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || 'local-model',
        messages: [{ role: 'user', content: 'Say "Hello!" in one word.' }],
        max_tokens: 10,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (response.ok) {
      const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      const reply = data.choices?.[0]?.message?.content || '';
      spinner.succeed(format(t().setup.aiResponded, { response: reply.trim() }));
      return true;
    } else {
      spinner.fail(format(t().setup.serverError, { status: String(response.status) }));
      return false;
    }
  } catch (error) {
    spinner.fail(format(t().setup.connectionFailed, { error: error instanceof Error ? error.message : 'Unknown error' }));
    return false;
  }
}

/**
 * Save setup completion
 */
function completeSetup(model?: string | null): void {
  const settings = loadSettings();
  settings.firstRun = false;
  if (model) {
    settings.providers.lmstudio.model = model;
  }
  saveSettings(settings);
}

/**
 * Main setup wizard
 */
export async function runSetupWizard(): Promise<boolean> {
  // Load language from settings
  const settings = loadSettings();
  setLanguage(settings.language);

  printSetupBanner();

  console.log(chalk.dim(`  ${t().setup.wizardIntro.split('\n')[0]}`));
  console.log(chalk.dim(`  ${t().setup.wizardIntro.split('\n')[1]}\n`));

  const proceed = await askYesNo(`  ${t().setup.startSetup}`);
  if (!proceed) {
    console.log(chalk.dim(`\n  ${t().setup.runLater}\n`));
    return false;
  }

  // Step 0: License (first-time only or if no valid access)
  if (!hasValidAccess()) {
    const licenseOk = await setupLicense();
    if (!licenseOk) {
      console.log(chalk.dim(`\n  ${t().setup.runLater}\n`));
      return false;
    }
  } else {
    // Show current license status briefly
    const status = getLicenseStatus();
    if (status.status === 'valid') {
      console.log(chalk.green(`  ✓ ${t().license.statusValid}`));
    } else if (status.status === 'trial') {
      console.log(chalk.yellow(`  ⏳ ${format(t().license.trialRemaining, { days: String(status.trialDays || 0) })}`));
    }
  }

  // Step 1: LM Studio
  const lmStudioOk = await setupLmStudio();

  // Step 2: CLI (always show in debug mode)
  let cliOk = false;
  if (lmStudioOk || DEBUG_FORCE_NOT_INSTALLED) {
    cliOk = await setupLmsCli();
  }

  // Step 3: Model (always show in debug mode)
  let selectedModel: string | null = null;
  if (lmStudioOk || DEBUG_FORCE_NOT_INSTALLED) {
    selectedModel = await setupModel();
  }

  // Step 4: Test
  let testOk = false;
  if (selectedModel || await lms.isServerRunning() || DEBUG_FORCE_NOT_INSTALLED) {
    testOk = await testConnection(selectedModel);
  }

  // Complete
  console.log(chalk.bold(`\n━━━ ${t().setup.setupCompleteTitle} ━━━\n`));

  if (testOk) {
    console.log(chalk.green(`  ✓ ${t().setup.setupReady}\n`));
    console.log(chalk.dim(`  ${t().setup.runToChat}`));
    console.log(chalk.dim(`  ${t().setup.runHelp}\n`));
  } else {
    console.log(chalk.yellow(`  ⚠ ${t().setup.setupIncomplete}\n`));
    console.log(chalk.dim(`  ${t().setup.finishLater}\n`));
  }

  completeSetup(selectedModel);
  return testOk;
}

/**
 * Check if first run (no config or firstRun flag)
 */
export function isFirstRun(): boolean {
  try {
    const settings = loadSettings();
    return settings.firstRun !== false;
  } catch {
    return true;
  }
}
