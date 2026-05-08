import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { homedir } from "os";

export type MemoryType = "project" | "user" | "global" | string;

export interface MemoryEntry {
  name: string;
  description: string;
  type: MemoryType;
  content: string;
  filePath: string;
}

export interface SaveMemoryResult {
  success: boolean;
  filePath: string;
  message: string;
}

export interface DeleteMemoryResult {
  success: boolean;
  message: string;
}

let memoryEnabled = true;

export function setMemoryEnabled(enabled: boolean): void {
  memoryEnabled = enabled;
}

export function isMemoryEnabled(): boolean {
  return memoryEnabled;
}

function getMemoryDir(cwd: string = process.cwd()): string {
  const projectHash = crypto.createHash("md5").update(cwd).digest("hex").slice(0, 12);
  return path.join(homedir(), ".synaptic", "projects", projectHash, "memory");
}

function ensureMemoryDir(cwd?: string): string {
  const dir = getMemoryDir(cwd);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function parseFrontmatter(content: string): { meta: Record<string, string>; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    return { meta: {}, body: content };
  }
  const meta: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();
      meta[key] = value;
    }
  }
  return { meta, body: match[2].trim() };
}

export function saveMemory(
  name: string,
  description: string,
  type: MemoryType,
  content: string,
  cwd?: string
): SaveMemoryResult {
  if (!memoryEnabled) {
    return {
      success: false,
      filePath: "",
      message: "Memory is disabled (learning mode off). Use /memory on to enable.",
    };
  }
  try {
    const dir = ensureMemoryDir(cwd);
    const fileName =
      name
        .toLowerCase()
        .replace(/[^a-z0-9_\-]/g, "_")
        .replace(/_+/g, "_")
        .slice(0, 50) + ".md";
    const filePath = path.join(dir, fileName);
    const fileContent = `---
name: ${name}
description: ${description}
type: ${type}
---

${content}
`;
    fs.writeFileSync(filePath, fileContent, "utf-8");
    updateIndex(dir);
    return { success: true, filePath: fileName, message: `Memory saved: ${name}` };
  } catch (error) {
    return {
      success: false,
      filePath: "",
      message: `Failed to save memory: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export function readMemory(name: string, cwd?: string): MemoryEntry | null {
  const dir = getMemoryDir(cwd);
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md") && f !== "MEMORY.md");
  for (const file of files) {
    const filePath = path.join(dir, file);
    const content = fs.readFileSync(filePath, "utf-8");
    const { meta, body } = parseFrontmatter(content);
    if (meta.name === name || file === name || file === `${name}.md`) {
      return {
        name: meta.name || file.replace(".md", ""),
        description: meta.description || "",
        type: meta.type || "project",
        content: body,
        filePath: file,
      };
    }
  }
  return null;
}

export function listMemories(cwd?: string): MemoryEntry[] {
  const dir = getMemoryDir(cwd);
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md") && f !== "MEMORY.md");
  const entries: MemoryEntry[] = [];
  for (const file of files) {
    const filePath = path.join(dir, file);
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const { meta, body } = parseFrontmatter(content);
      entries.push({
        name: meta.name || file.replace(".md", ""),
        description: meta.description || "",
        type: meta.type || "project",
        content: body,
        filePath: file,
      });
    } catch {}
  }
  return entries;
}

export function deleteMemory(name: string, cwd?: string): DeleteMemoryResult {
  const dir = getMemoryDir(cwd);
  if (!fs.existsSync(dir)) {
    return { success: false, message: `Memory '${name}' not found` };
  }
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md") && f !== "MEMORY.md");
  for (const file of files) {
    const filePath = path.join(dir, file);
    const content = fs.readFileSync(filePath, "utf-8");
    const { meta } = parseFrontmatter(content);
    if (meta.name === name || file === name || file === `${name}.md`) {
      fs.unlinkSync(filePath);
      updateIndex(dir);
      return { success: true, message: `Memory deleted: ${name}` };
    }
  }
  return { success: false, message: `Memory '${name}' not found` };
}

function updateIndex(dir: string): void {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md") && f !== "MEMORY.md");
  const lines: string[] = [];
  for (const file of files) {
    const filePath = path.join(dir, file);
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const { meta } = parseFrontmatter(content);
      const name = meta.name || file.replace(".md", "");
      const desc = meta.description || "";
      const type = meta.type || "project";
      lines.push(`- [${name}](${file}) (${type}) — ${desc}`);
    } catch {}
  }
  const indexContent =
    lines.length > 0 ? lines.join("\n") + "\n" : "(no memories saved yet)\n";
  fs.writeFileSync(path.join(dir, "MEMORY.md"), indexContent, "utf-8");
}

export function loadMemoryIndex(cwd?: string): string | null {
  const dir = getMemoryDir(cwd);
  const indexPath = path.join(dir, "MEMORY.md");
  if (!fs.existsSync(indexPath)) return null;
  try {
    const content = fs.readFileSync(indexPath, "utf-8").trim();
    if (content === "(no memories saved yet)") return null;
    return content;
  } catch {
    return null;
  }
}

export function getMemoryPath(cwd?: string): string {
  return getMemoryDir(cwd);
}
