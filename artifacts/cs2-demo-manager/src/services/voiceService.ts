import type { VoiceMode } from "../types/demo";
import type { DemoAnalysisResult, VoicePlayerDebug } from "../types/stats";

export function buildVoiceCommand(mode: VoiceMode, demoFilename: string, analysis?: DemoAnalysisResult) {
  const replayPath = `replays/${demoFilename.replace(/\.dem(\.gz|\.zst)?$/i, "")}`;
  if (mode === "none") return `voice_enable 0; tv_listen_voice_indices 0; tv_listen_voice_indices_h 0; playdemo ${replayPath}`;
  if (mode === "all") return `voice_enable 1; tv_listen_voice_indices -1; tv_listen_voice_indices_h -1; playdemo ${replayPath}`;
  const players = analysis?.debug.voicePlayers?.filter((player) => player.teamNum === (mode === "t" ? 2 : 3)) ?? [];
  const masks = buildVoiceMasks(players);
  return `voice_enable 1; tv_listen_voice_indices ${masks.low}; tv_listen_voice_indices_h ${masks.high}; playdemo ${replayPath}`;
}

export function buildVoiceMasks(players: VoicePlayerDebug[]) {
  let low = 0n;
  let high = 0n;
  for (const player of players) {
    const index = player.playerSlot ?? player.inferredSlot ?? (player.entityId <= 127 ? player.entityId : undefined);
    if (index === undefined || !Number.isFinite(index) || index < 0 || index > 127) continue;
    if (index < 64) low |= 1n << BigInt(index);
    else high |= 1n << BigInt(index - 64);
  }
  return { low: low.toString(), high: high.toString() };
}
