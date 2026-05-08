import { spawn, execSync, ChildProcess } from "child_process";
import { platform, tmpdir, homedir } from "os";
import { join } from "path";
import { existsSync, unlinkSync } from "fs";

export interface RecordingTool {
  available: boolean;
  tool: string;
  path?: string;
  installHint: string;
  installHintJa: string;
}

export interface RecordingHandle {
  stop: () => Promise<string>;
  cancel: () => void;
  isRecording: () => boolean;
}

export interface InstallResult {
  success: boolean;
  message: string;
}

const HALLUCINATION_PHRASES: string[] = [
  "ご視聴ありがとうございました",
  "最後までご視聴いただきありがとうございます",
  "ご視聴",
  "ご清聴",
  "チャンネル登録",
  "高評価",
  "コメント欄",
  "次回の動画",
  "またお会いしましょう",
  "それではまた",
  "小成長",
  "以上で終わりです",
  "Thank you for watching",
  "Please subscribe",
  "See you next time",
  "Thanks for watching",
];

export function isHallucination(text: string): boolean {
  if (!text || text.trim().length < 2) return true;
  const lower = text.toLowerCase().trim();
  return HALLUCINATION_PHRASES.some((p) => lower.includes(p.toLowerCase()));
}

function findWindowsExe(name: string): string | null {
  const searchPaths = [
    join(process.env.PROGRAMFILES || "C:\\Program Files", name, `${name}.exe`),
    join(process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)", name, `${name}.exe`),
    join(process.env.LOCALAPPDATA || "", "Programs", name, `${name}.exe`),
    join(process.env.LOCALAPPDATA || "", name, `${name}.exe`),
    join(homedir(), "scoop", "shims", `${name}.exe`),
    join(homedir(), "scoop", "apps", name, "current", `${name}.exe`),
    join("C:\\ProgramData", "chocolatey", "bin", `${name}.exe`),
    `D:\\${name}\\${name}.exe`,
    `D:\\Program Files\\${name}\\${name}.exe`,
  ];
  try {
    const result = execSync(`where ${name}`, { encoding: "utf-8", stdio: "pipe" })
      .trim()
      .split("\n")[0];
    if (result && existsSync(result.trim())) return result.trim();
  } catch {}
  for (const p of searchPaths) {
    if (existsSync(p)) return p;
  }
  return null;
}

export function isRecordingAvailable(): RecordingTool {
  const os = platform();
  if (os === "darwin") {
    try {
      const p = execSync("which rec", { encoding: "utf-8", stdio: "pipe" }).trim();
      return {
        available: true,
        tool: "sox",
        path: p,
        installHint: "brew install sox",
        installHintJa: "brew install sox を実行してください",
      };
    } catch {
      return {
        available: false,
        tool: "sox",
        installHint: "brew install sox",
        installHintJa: "brew install sox を実行してください",
      };
    }
  }
  if (os === "linux") {
    try {
      const p = execSync("which arecord", { encoding: "utf-8", stdio: "pipe" }).trim();
      return {
        available: true,
        tool: "arecord",
        path: p,
        installHint: "sudo apt install sox alsa-utils",
        installHintJa:
          "sudo apt install sox alsa-utils を実行してください",
      };
    } catch {}
    try {
      const p = execSync("which rec", { encoding: "utf-8", stdio: "pipe" }).trim();
      return {
        available: true,
        tool: "sox",
        path: p,
        installHint: "sudo apt install sox",
        installHintJa: "sudo apt install sox を実行してください",
      };
    } catch {
      return {
        available: false,
        tool: "arecord/sox",
        installHint: "sudo apt install sox alsa-utils",
        installHintJa:
          "sudo apt install sox alsa-utils を実行してください",
      };
    }
  }
  if (os === "win32") {
    const ffmpeg = findWindowsExe("ffmpeg");
    if (ffmpeg) {
      return {
        available: true,
        tool: "ffmpeg",
        path: ffmpeg,
        installHint: "winget install Gyan.FFmpeg",
        installHintJa:
          "winget install Gyan.FFmpeg を実行してください",
      };
    }
    const sox = findWindowsExe("sox");
    if (sox) {
      return {
        available: true,
        tool: "sox",
        path: sox,
        installHint: "choco install sox",
        installHintJa: "choco install sox を実行してください",
      };
    }
    return {
      available: false,
      tool: "ffmpeg/sox",
      installHint: "winget install Gyan.FFmpeg  or  choco install sox",
      installHintJa:
        "winget install Gyan.FFmpeg または choco install sox を実行してください",
    };
  }
  return {
    available: false,
    tool: "unknown",
    installHint: "Install sox or ffmpeg",
    installHintJa:
      "sox または ffmpeg をインストールしてください",
  };
}

export async function installRecordingTool(): Promise<InstallResult> {
  const os = platform();
  return new Promise((resolve) => {
    let cmd: string;
    let args: string[];
    if (os === "darwin") {
      try {
        execSync("which brew", { stdio: "pipe" });
      } catch {
        resolve({
          success: false,
          message: "Homebrew not found. Install from https://brew.sh then: brew install sox",
        });
        return;
      }
      cmd = "brew";
      args = ["install", "sox"];
    } else if (os === "linux") {
      try {
        execSync("which apt-get", { stdio: "pipe" });
        cmd = "sudo";
        args = ["apt-get", "install", "-y", "sox", "alsa-utils"];
      } catch {
        try {
          execSync("which dnf", { stdio: "pipe" });
          cmd = "sudo";
          args = ["dnf", "install", "-y", "sox", "alsa-utils"];
        } catch {
          resolve({
            success: false,
            message: "Package manager not found. Install sox manually.",
          });
          return;
        }
      }
    } else if (os === "win32") {
      try {
        execSync("winget --version", { stdio: "pipe" });
        cmd = "winget";
        args = [
          "install",
          "--id",
          "Gyan.FFmpeg",
          "-e",
          "--accept-source-agreements",
          "--accept-package-agreements",
        ];
      } catch {
        try {
          execSync("choco --version", { stdio: "pipe" });
          cmd = "choco";
          args = ["install", "sox", "-y"];
        } catch {
          resolve({
            success: false,
            message:
              "winget/chocolatey not found. Install ffmpeg from https://ffmpeg.org/download.html",
          });
          return;
        }
      }
    } else {
      resolve({ success: false, message: "Unsupported platform" });
      return;
    }
    const proc = spawn(cmd, args, { stdio: "pipe" });
    let output = "";
    proc.stdout?.on("data", (d) => {
      output += d.toString();
    });
    proc.stderr?.on("data", (d) => {
      output += d.toString();
    });
    proc.on("close", (code) => {
      resolve(
        code === 0
          ? { success: true, message: "Recording tool installed successfully" }
          : { success: false, message: `Installation failed (exit ${code}): ${output.slice(-200)}` }
      );
    });
    proc.on("error", (err) => {
      resolve({ success: false, message: err.message });
    });
  });
}

export function startRecording(toolOverride?: RecordingTool): RecordingHandle {
  const os = platform();
  const outputPath = join(tmpdir(), `synaptic_voice_${Date.now()}.wav`);
  let recording = true;
  let proc: ChildProcess | null = null;
  const tool = toolOverride || isRecordingAvailable();
  if (tool.tool === "sox") {
    const recCmd = os === "win32" ? tool.path || "sox" : "rec";
    if (os === "win32") {
      proc = spawn(recCmd, ["-d", "-c", "1", "-b", "16", outputPath], { stdio: "pipe" });
    } else {
      proc = spawn(recCmd, ["-c", "1", "-b", "16", outputPath], { stdio: "pipe" });
    }
  } else if (tool.tool === "arecord") {
    proc = spawn(
      "arecord",
      ["-f", "S16_LE", "-r", "16000", "-c", "1", "-t", "wav", outputPath],
      { stdio: "pipe" }
    );
  } else if (tool.tool === "ffmpeg") {
    const inputDevice = os === "win32" ? "dshow" : "avfoundation";
    const inputSource = os === "win32" ? "audio=Microphone" : ":0";
    proc = spawn(
      tool.path || "ffmpeg",
      [
        "-f",
        inputDevice,
        "-i",
        inputSource,
        "-ar",
        "16000",
        "-ac",
        "1",
        "-sample_fmt",
        "s16",
        "-y",
        outputPath,
      ],
      { stdio: "pipe" }
    );
  }
  return {
    stop: () => {
      return new Promise<string>((resolve) => {
        recording = false;
        if (proc) {
          let resolved = false;
          proc.on("close", () => {
            if (!resolved) {
              resolved = true;
              setTimeout(() => resolve(outputPath), 200);
            }
          });
          if (tool.tool === "ffmpeg") {
            proc.stdin?.write("q");
          } else {
            proc.kill("SIGINT");
          }
          setTimeout(() => {
            if (!resolved) {
              resolved = true;
              if (proc && !proc.killed) proc.kill("SIGKILL");
              setTimeout(() => resolve(outputPath), 200);
            }
          }, 5000);
        } else {
          resolve(outputPath);
        }
      });
    },
    cancel: () => {
      recording = false;
      if (proc) proc.kill("SIGKILL");
      try {
        if (existsSync(outputPath)) unlinkSync(outputPath);
      } catch {}
    },
    isRecording: () => recording,
  };
}

export function cleanupAudioFile(filePath: string): void {
  try {
    if (existsSync(filePath)) unlinkSync(filePath);
  } catch {}
}
