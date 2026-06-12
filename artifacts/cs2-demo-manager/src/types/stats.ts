export interface DemoAnalysisResult {
  success: boolean;
  error?: string;
  demo: DemoInfo;
  players: PlayerStats[];
  rounds: RoundSummary[];
  events?: DemoEvents;
  deathReviews?: DeathReviewEvent[];
  debug: StatsDebugInfo;
}

export interface DemoInfo {
  filepath: string;
  filename: string;
  mapName: string;
  tickRate: number;
  totalRounds: number;
  parser: "demoparser2";
  analyzedAt: string;
}

export interface PlayerStats {
  steamId: string;
  name: string;
  kills: number;
  deaths: number;
  assists: number;
  kd: number;
  damage: number;
  adr: number;
  headshotKills: number;
  headshotPercent: number;
  kastRounds: number;
  kastPercent: number;
  entryKills: number;
  entryDeaths: number;
  tradeKills: number;
  tradedDeaths: number;
  flashAssists: number;
  utilityDamage: number;
  tStats: SideStats;
  ctStats: SideStats;
  weapons: WeaponStats[];
  aim?: AimStats;
  movement?: MovementStats;
}

export interface SideStats {
  rounds: number;
  kills: number;
  deaths: number;
  assists: number;
  damage: number;
  adr: number;
}

export interface WeaponStats {
  weapon: string;
  kills: number;
  shots: number;
  hits: number;
  headshotKills: number;
  accuracyPercent: number;
}

export interface AimStats {
  averageCrosshairErrorDeg?: number;
  firstShotDelayMs?: number;
  averageTimeToDamageMs?: number;
}

export interface MovementStats {
  averageSpeedAtFirstShot?: number;
  shotsBeforeStop?: number;
  counterStrafeScore?: number;
}

export interface RoundSummary {
  roundNumber: number;
  winnerSide: "T" | "CT" | "UNKNOWN";
  winnerTeam?: string;
  startTick: number;
  endTick: number;
  kills: RoundKill[];
}

export interface RoundKill {
  tick: number;
  killerSteamId: string;
  victimSteamId: string;
  assisterSteamId?: string;
  weapon: string;
  headshot: boolean;
}

export interface DeathReviewEvent {
  round: number;
  deathTick: number;
  startTick: number;
  endTick: number;
  victimSteamId: string;
  killerSteamId: string;
  weapon: string;
  headshot: boolean;
  victimSpeedAtDeath?: number;
  killerSpeedAtShot?: number;
  crosshairErrorDeg?: number;
  fightTimeline?: FightTickSample[];
}

export interface FightTickSample {
  tick: number;
  steamId: string;
  x?: number;
  y?: number;
  z?: number;
  yaw?: number;
  pitch?: number;
  velocity?: number;
}

export interface DemoEvents {
  kills: RoundKill[];
  damages: unknown[];
  shots: unknown[];
}

export interface StatsDebugInfo {
  rawKillsCount: number;
  rawDeathsCount?: number;
  rawDamagesCount: number;
  rawShotsCount: number;
  rawRoundsCount: number;
  warnings: string[];
  availableParserExports?: string[];
  readFields?: string[];
  missingFields?: string[];
  rawKills?: unknown[];
  rawDamages?: unknown[];
  rawRoundStarts?: unknown[];
  rawRoundEnds?: unknown[];
  normalizedKills?: unknown[];
  normalizedDamages?: unknown[];
  perRoundKast?: KastRoundDebug[];
  rawRounds?: unknown[];
  computedPlayers?: unknown[];
  voicePlayers?: VoicePlayerDebug[];
}

export interface KastRoundDebug {
  steamId: string;
  name: string;
  roundNumber: number;
  kill: boolean;
  assist: boolean;
  survived: boolean;
  traded: boolean;
  kast: boolean;
}

export interface VoicePlayerDebug {
  steamId: string;
  name: string;
  teamNum: number;
  entityId: number;
  playerSlot?: number;
  inferredSlot?: number;
}
