import { invoke } from "@tauri-apps/api/core";
import type { DemoFile } from "../types/demo";

interface BackendDemoFile {
  filepath: string;
  filename: string;
  size_bytes: number;
  modified_at: string;
}

export async function listDemos(directory: string): Promise<DemoFile[]> {
  const rows = await invoke<BackendDemoFile[]>("list_demos", { directory });
  return rows.map((row) => ({
    filepath: row.filepath,
    filename: row.filename,
    sizeBytes: row.size_bytes,
    modifiedAt: row.modified_at,
  }));
}

export function importDemo(sourcePath: string, destinationDirectory: string) {
  return invoke<string>("import_demo", { sourcePath, destinationDirectory });
}

export function copyToClipboard(command: string) {
  return invoke<void>("copy_to_clipboard", { command });
}

export function openFolder(path: string) {
  return invoke<void>("open_folder", { path });
}

export function detectDownloadsFolder() {
  return invoke<string>("detect_downloads_folder");
}

export function detectReplayFolder() {
  return invoke<string | null>("detect_replay_folder");
}
