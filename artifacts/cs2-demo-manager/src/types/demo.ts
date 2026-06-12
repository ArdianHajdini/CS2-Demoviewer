export interface DemoFile {
  filepath: string;
  filename: string;
  sizeBytes: number;
  modifiedAt: string;
}

export type VoiceMode = "all" | "none" | "t" | "ct";
