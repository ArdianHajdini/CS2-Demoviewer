import { invoke } from "@tauri-apps/api/core";
import type { DemoAnalysisResult } from "../types/stats";

export function analyzeDemo(filepath: string) {
  return invoke<DemoAnalysisResult>("run_demo_analyzer", { filepath });
}

export function exportStatsDebug(filepath: string, json: unknown) {
  return invoke<void>("export_stats_debug", { filepath, json });
}
