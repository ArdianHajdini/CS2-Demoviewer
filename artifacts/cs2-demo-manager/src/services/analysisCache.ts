import type { DemoAnalysisResult } from "../types/stats";

const CACHE_KEY = "cs2-demo-manager.analysis-cache.v1";

export type AnalysisCache = Record<string, DemoAnalysisResult>;

export function loadAnalysisCache(): AnalysisCache {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) as AnalysisCache : {};
  } catch {
    return {};
  }
}

export function saveAnalysisCache(cache: AnalysisCache) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

export function cacheAnalysis(cache: AnalysisCache, filepath: string, result: DemoAnalysisResult): AnalysisCache {
  const next = { ...cache, [filepath]: compactAnalysis(result) };
  saveAnalysisCache(next);
  return next;
}

function compactAnalysis(result: DemoAnalysisResult): DemoAnalysisResult {
  return {
    ...result,
    events: result.events ? { kills: [], damages: [], shots: [] } : undefined,
    deathReviews: result.deathReviews?.map((review) => ({ ...review, fightTimeline: undefined })),
    debug: {
      rawKillsCount: result.debug.rawKillsCount,
      rawDeathsCount: result.debug.rawDeathsCount,
      rawDamagesCount: result.debug.rawDamagesCount,
      rawShotsCount: result.debug.rawShotsCount,
      rawRoundsCount: result.debug.rawRoundsCount,
      warnings: [...result.debug.warnings, "Loaded from compact local cache; raw event tables are not persisted"],
      availableParserExports: result.debug.availableParserExports,
      readFields: result.debug.readFields,
      missingFields: result.debug.missingFields,
      perRoundKast: result.debug.perRoundKast,
      voicePlayers: result.debug.voicePlayers,
    },
  };
}
