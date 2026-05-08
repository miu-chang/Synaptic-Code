import { execSync, spawn } from "child_process";
import { platform, homedir, tmpdir } from "os";
import { join } from "path";
import { existsSync, writeFileSync, unlinkSync, readdirSync } from "fs";

export type WhisperBackend = "lightning-mlx" | "faster-whisper" | "groq";

export interface GpuInfo {
  name: string;
  vramGB: number;
}

export interface AppleSiliconInfo {
  chip: string;
  variant: string;
}

export interface SystemSpecs {
  ramGB: number;
  cpuModel: string;
  platform: "darwin" | "linux" | "windows" | string;
  appleSilicon?: AppleSiliconInfo;
  gpu?: GpuInfo;
}

export interface WhisperConfig {
  backend: WhisperBackend;
  model: string;
  ramUsageMB: number;
  description: string;
}

export interface WhisperRecommendation {
  config: WhisperConfig;
  reasoning: string;
  alternatives: WhisperConfig[];
}

export interface TranscribeResult {
  success: boolean;
  text?: string;
  error?: string;
}

export interface InstallResult {
  success: boolean;
  message: string;
}

interface WhisperModelInfo {
  name: string;
  paramsMB: number;
  quality: number;
  description: string;
}

const WHISPER_MODELS: WhisperModelInfo[] = [
  { name: "large-v3", paramsMB: 6000, quality: 10, description: "Best quality (6GB)" },
  {
    name: "distil-large-v3",
    paramsMB: 3000,
    quality: 9,
    description: "Near-best quality, 2x faster (3GB)",
  },
  { name: "medium", paramsMB: 3000, quality: 7, description: "Good quality (3GB)" },
  { name: "small", paramsMB: 1000, quality: 5, description: "Lightweight (1GB)" },
  { name: "base", paramsMB: 300, quality: 3, description: "Minimal (300MB)" },
  { name: "tiny", paramsMB: 150, quality: 1, description: "Fastest, low quality (150MB)" },
];

const LLM_RAM_ESTIMATES: Record<string, number> = {
  "qwen3.6-35b": 20000,
  "qwen3.5-35b": 20000,
  "qwen3.5-27b": 16000,
  "qwen3.5-14b": 9000,
  "qwen3.5-9b": 5500,
  "qwen3-8b": 5000,
  "qwen3.5-4b": 2500,
  "gpt-oss-20b": 12000,
  "gemma-4-26b": 16000,
  "gemma-3-12b": 8000,
};

function estimateLlmRamMB(llmModel?: string): number {
  if (!llmModel) return 0;
  const modelLower = llmModel.toLowerCase();
  for (const [pattern, ramMB] of Object.entries(LLM_RAM_ESTIMATES)) {
    if (modelLower.includes(pattern)) return ramMB;
  }
  const sizeMatch = modelLower.match(/(\d+)b/);
  if (sizeMatch) return parseInt(sizeMatch[1]) * 600;
  return 8000;
}

function detectBackend(specs: SystemSpecs): WhisperBackend {
  if (specs.appleSilicon) {
    return "lightning-mlx";
  }
  return "faster-whisper";
}

export function selectWhisperModel(specs: SystemSpecs, llmModel?: string): WhisperConfig {
  const backend = detectBackend(specs);
  const totalRamMB = specs.ramGB * 1024;
  const llmRamMB = estimateLlmRamMB(llmModel);
  const osOverheadMB = specs.platform === "windows" ? 6000 : 4000;
  const availableRamMB = totalRamMB - llmRamMB - osOverheadMB;
  let effectiveAvailable = availableRamMB;
  if (specs.gpu && specs.gpu.vramGB > 0) {
    effectiveAvailable = Math.max(availableRamMB, specs.gpu.vramGB * 1024);
  }
  let selected = WHISPER_MODELS[WHISPER_MODELS.length - 1];
  for (const model of WHISPER_MODELS) {
    if (model.paramsMB <= effectiveAvailable) {
      selected = model;
      break;
    }
  }
  return {
    backend,
    model: selected.name,
    ramUsageMB: selected.paramsMB,
    description: `${selected.description} [${backend}]`,
  };
}

export function getWhisperRecommendation(
  specs: SystemSpecs,
  llmModel?: string
): WhisperRecommendation {
  const config = selectWhisperModel(specs, llmModel);
  const backend = detectBackend(specs);
  const totalRamMB = specs.ramGB * 1024;
  const llmRamMB = estimateLlmRamMB(llmModel);
  const osOverheadMB = specs.platform === "windows" ? 6000 : 4000;
  const availableRamMB = totalRamMB - llmRamMB - osOverheadMB;
  const hw = specs.appleSilicon
    ? `Apple ${specs.appleSilicon.chip} ${specs.appleSilicon.variant}`
    : specs.gpu
    ? `${specs.cpuModel} + ${specs.gpu.name} (${specs.gpu.vramGB}GB VRAM)`
    : specs.cpuModel;
  const reasoning = [
    `System: ${specs.ramGB}GB RAM, ${hw}`,
    `LLM: ${llmModel || "none"} (~${Math.round(llmRamMB / 1024)}GB)`,
    `Available for Whisper: ~${Math.round(availableRamMB / 1024)}GB`,
    `Backend: ${config.backend}`,
    `Selected: ${config.model} (${config.description})`,
  ].join("\n");
  const alternatives: WhisperConfig[] = WHISPER_MODELS.filter(
    (m) =>
      m.paramsMB <= Math.max(availableRamMB, (specs.gpu?.vramGB || 0) * 1024) &&
      m.name !== config.model
  ).map((m) => ({
    backend,
    model: m.name,
    ramUsageMB: m.paramsMB,
    description: `${m.description} [${backend}]`,
  }));
  return { config, reasoning, alternatives };
}

function findPython(): string | null {
  const os = platform();
  const candidates = os === "win32" ? ["python", "python3", "py -3"] : ["python3", "python"];
  for (const cmd of candidates) {
    try {
      execSync(`${cmd} --version`, { stdio: "pipe", encoding: "utf-8" });
      return cmd;
    } catch {}
  }
  if (os === "win32") {
    const searchPaths = [
      join(process.env.LOCALAPPDATA || "", "Programs", "Python"),
      join(process.env.PROGRAMFILES || "", "Python"),
      join(homedir(), "AppData", "Local", "Programs", "Python"),
      join(homedir(), "scoop", "apps", "python", "current"),
      "C:\\Python312",
      "C:\\Python311",
      "C:\\Python310",
      "D:\\Python312",
      "D:\\Python311",
    ];
    for (const basePath of searchPaths) {
      if (!existsSync(basePath)) continue;
      const direct = join(basePath, "python.exe");
      if (existsSync(direct)) return `"${direct}"`;
      try {
        const dirs = readdirSync(basePath);
        for (const dir of dirs) {
          const pyExe = join(basePath, dir, "python.exe");
          if (existsSync(pyExe)) return `"${pyExe}"`;
        }
      } catch {}
    }
  }
  return null;
}

function getPipCommand(): string | null {
  const os = platform();
  const candidates = os === "win32" ? ["pip", "pip3", "py -3 -m pip"] : ["pip3", "pip"];
  for (const cmd of candidates) {
    try {
      execSync(`${cmd} --version`, { stdio: "pipe" });
      return cmd;
    } catch {}
  }
  const python = findPython();
  if (python) {
    try {
      execSync(`${python} -m pip --version`, { stdio: "pipe" });
      return `${python} -m pip`;
    } catch {}
  }
  return null;
}

export function isWhisperInstalled(backend: WhisperBackend = "lightning-mlx"): boolean {
  const pip = getPipCommand();
  if (!pip) return false;
  try {
    const pkg = backend === "lightning-mlx" ? "lightning-whisper-mlx" : "faster-whisper";
    execSync(`${pip} show ${pkg}`, { stdio: "pipe" });
    return true;
  } catch {}
  return false;
}

export async function installWhisper(
  backend: WhisperBackend = "lightning-mlx",
  onProgress?: (msg: string) => void
): Promise<InstallResult> {
  const pip = getPipCommand();
  if (!pip) {
    const os = platform();
    const hint =
      os === "win32"
        ? 'Python not found. Download from https://www.python.org/downloads/ (check "Add to PATH")'
        : "pip not found. Install Python 3: brew install python (Mac) or sudo apt install python3-pip (Linux)";
    return { success: false, message: hint };
  }
  const packages: Record<WhisperBackend, string[]> = {
    "lightning-mlx": ["lightning-whisper-mlx"],
    "faster-whisper": ["faster-whisper"],
    groq: ["groq"],
  };
  const pkgs = packages[backend];
  const pkgStr = pkgs.join(" ");
  onProgress?.(`Installing ${pkgStr}...`);
  return new Promise((resolve) => {
    const parts = pip.split(" ");
    const cmd = parts[0];
    const baseArgs = parts.slice(1);
    const proc = spawn(cmd, [...baseArgs, "install", ...pkgs], {
      stdio: "pipe",
      shell: platform() === "win32",
    });
    let output = "";
    proc.stdout?.on("data", (data) => {
      output += data.toString();
      const lines = data.toString().split("\n").filter((l: string) => l.trim());
      if (lines.length > 0) onProgress?.(lines[lines.length - 1]);
    });
    proc.stderr?.on("data", (data) => {
      output += data.toString();
    });
    proc.on("close", (code) => {
      if (code === 0) {
        resolve({ success: true, message: `${pkgStr} installed successfully` });
      } else {
        resolve({ success: false, message: `Installation failed: ${output.slice(-300)}` });
      }
    });
    proc.on("error", (err) => {
      resolve({ success: false, message: `Installation error: ${err.message}` });
    });
  });
}

export async function transcribe(
  audioPath: string,
  config: WhisperConfig,
  onProgress?: (msg: string) => void
): Promise<TranscribeResult> {
  if (!isWhisperInstalled(config.backend)) {
    onProgress?.("Whisper not installed. Installing...");
    const installResult = await installWhisper(config.backend, onProgress);
    if (!installResult.success) {
      return { success: false, error: installResult.message };
    }
  }
  if (config.backend === "lightning-mlx") {
    return transcribeWithLightningMLX(audioPath, config.model, onProgress);
  } else if (config.backend === "faster-whisper") {
    return transcribeWithFasterWhisper(audioPath, config.model, onProgress);
  } else if (config.backend === "groq") {
    return { success: false, error: "Groq backend not implemented yet" };
  }
  return { success: false, error: `Unknown backend: ${config.backend}` };
}

interface PythonScriptResult {
  success: boolean;
  stdout: string;
  stderr: string;
}

function runPythonScript(
  scriptContent: string,
  onProgress?: (msg: string) => void
): Promise<PythonScriptResult> {
  const python = findPython() || (platform() === "win32" ? "python" : "python3");
  const scriptPath = join(tmpdir(), `synaptic_whisper_${Date.now()}.py`);
  return new Promise((resolve) => {
    writeFileSync(scriptPath, scriptContent, "utf-8");
    const parts = python.replace(/^"(.*)"$/, "$1").split(" ");
    const cmd = parts[0];
    const args = [...parts.slice(1), scriptPath];
    const proc = spawn(cmd, args, {
      stdio: "pipe",
      shell: platform() === "win32",
      env: { ...process.env },
    });
    let stdout = "";
    let stderr = "";
    proc.stdout?.on("data", (data) => {
      stdout += data.toString();
    });
    proc.stderr?.on("data", (data) => {
      stderr += data.toString();
      const lines = data.toString().split("\n").filter((l: string) => l.trim());
      if (lines.length > 0) onProgress?.(lines[lines.length - 1]);
    });
    proc.on("close", (code) => {
      try {
        unlinkSync(scriptPath);
      } catch {}
      resolve({ success: code === 0, stdout: stdout.trim(), stderr });
    });
    proc.on("error", (err) => {
      try {
        unlinkSync(scriptPath);
      } catch {}
      resolve({ success: false, stdout: "", stderr: err.message });
    });
  });
}

async function transcribeWithLightningMLX(
  audioPath: string,
  model: string,
  onProgress?: (msg: string) => void
): Promise<TranscribeResult> {
  onProgress?.(`Transcribing with Lightning MLX (${model})...`);
  const script = `
import json, sys, os

audio_path = ${JSON.stringify(audioPath)}
model_name = ${JSON.stringify(model)}

if not os.path.exists(audio_path):
    print(json.dumps({"error": f"Audio file not found: {audio_path}"}))
    sys.exit(1)

try:
    from lightning_whisper_mlx import LightningWhisperMLX
    whisper = LightningWhisperMLX(model=model_name, batch_size=12, quant=None)
    result = whisper.transcribe(audio_path=audio_path)
    print(json.dumps({"text": result["text"]}))
except Exception as e:
    print(json.dumps({"error": str(e)}))
    sys.exit(1)
`;
  const result = await runPythonScript(script, onProgress);
  if (result.success && result.stdout) {
    try {
      const parsed = JSON.parse(result.stdout);
      if (parsed.error) return { success: false, error: parsed.error };
      return { success: true, text: parsed.text?.trim() };
    } catch {
      return { success: true, text: result.stdout };
    }
  }
  return { success: false, error: result.stderr.slice(-300) || "Transcription failed" };
}

async function transcribeWithFasterWhisper(
  audioPath: string,
  model: string,
  onProgress?: (msg: string) => void
): Promise<TranscribeResult> {
  onProgress?.(`Transcribing with faster-whisper (${model})...`);
  const script = `
import json, sys, os

audio_path = ${JSON.stringify(audioPath)}
model_name = ${JSON.stringify(model)}

if not os.path.exists(audio_path):
    print(json.dumps({"error": f"Audio file not found: {audio_path}"}))
    sys.exit(1)

try:
    from faster_whisper import WhisperModel

    # Try CUDA first, fallback to CPU
    device = "cpu"
    compute_type = "int8"
    try:
        import torch
        if torch.cuda.is_available():
            device = "cuda"
            compute_type = "float16"
    except ImportError:
        pass

    model = WhisperModel(model_name, device=device, compute_type=compute_type)
    segments, info = model.transcribe(audio_path, beam_size=5)
    text = " ".join([s.text for s in segments])
    print(json.dumps({
        "text": text.strip(),
        "language": info.language,
        "device": device
    }))
except Exception as e:
    print(json.dumps({"error": str(e)}))
    sys.exit(1)
`;
  const result = await runPythonScript(script, onProgress);
  if (result.success && result.stdout) {
    try {
      const parsed = JSON.parse(result.stdout);
      if (parsed.error) return { success: false, error: parsed.error };
      return { success: true, text: parsed.text?.trim() };
    } catch {
      return { success: true, text: result.stdout };
    }
  }
  return { success: false, error: result.stderr.slice(-300) || "Transcription failed" };
}
