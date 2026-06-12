#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";

const EVENT_NAMES = [
  "player_death",
  "player_hurt",
  "weapon_fire",
  "round_start",
  "round_end",
  "round_freeze_end",
  "bomb_planted",
  "bomb_defused",
  "bomb_exploded",
  "flashbang_detonate",
  "hegrenade_detonate",
  "smokegrenade_detonate",
  "inferno_startburn",
  "player_blind",
];

const TICK_FIELDS = [
  "player_name",
  "player_steamid",
  "team_num",
  "entity_id",
  "player_slot",
  "X",
  "Y",
  "Z",
  "pitch",
  "yaw",
  "velocity",
  "velocity_X",
  "velocity_Y",
  "velocity_Z",
  "is_airborne",
  "shots_fired",
  "total_rounds_played",
  "is_freeze_period",
  "FORWARD",
  "LEFT",
  "RIGHT",
  "BACK",
  "FIRE",
];

const PLAYER_EVENT_EXTRA = ["X", "Y", "Z", "player_steamid", "team_num", "entity_id", "player_slot"];
const OTHER_EVENT_EXTRA = ["total_rounds_played"];

const EMPTY_SIDE = { rounds: 0, kills: 0, deaths: 0, assists: 0, damage: 0, adr: 0 };

function value(row, keys) {
  for (const key of keys) {
    if (row && row[key] !== undefined && row[key] !== null && row[key] !== "") return row[key];
  }
  return undefined;
}

function stringValue(row, keys) {
  const v = value(row, keys);
  return v === undefined ? "" : String(v);
}

function numberValue(row, keys, fallback = 0) {
  const n = Number(value(row, keys));
  return Number.isFinite(n) ? n : fallback;
}

function boolValue(row, keys) {
  const v = value(row, keys);
  return v === true || v === 1 || v === "1" || v === "true";
}

async function callAny(module, names, argsVariants) {
  for (const name of names) {
    const fn = module[name];
    if (typeof fn !== "function") continue;
    for (const args of argsVariants) {
      try {
        const result = await fn(...args);
        if (result !== undefined) return result;
      } catch (_) {
        // Try the next known demoparser2 call shape.
      }
    }
  }
  return [];
}

async function parseEvents(parser, demoPath, warnings) {
  const events = {};
  for (const eventName of EVENT_NAMES) {
    const rows = await callAny(parser, ["parseEvent", "parseEvents"], [
      [demoPath, eventName, PLAYER_EVENT_EXTRA, OTHER_EVENT_EXTRA],
      [demoPath, [eventName], PLAYER_EVENT_EXTRA, OTHER_EVENT_EXTRA],
      [demoPath, eventName],
    ]);
    events[eventName] = Array.isArray(rows) ? rows : [];
    if (!Array.isArray(rows)) warnings.push(`${eventName}: parser returned non-array event data`);
  }
  return events;
}

async function parseTicks(parser, demoPath, warnings) {
  const rows = await callAny(parser, ["parseTicks", "parseTick"], [
    [demoPath, TICK_FIELDS],
    [demoPath, TICK_FIELDS, []],
    [TICK_FIELDS, demoPath],
  ]);
  if (!Array.isArray(rows)) {
    warnings.push("parseTicks did not return an array; tick-dependent side/aim data is incomplete");
    return [];
  }
  return rows;
}

async function parseHeader(parser, demoPath) {
  const header = await callAny(parser, ["parseHeader", "getHeader"], [[demoPath]]);
  return header && !Array.isArray(header) ? header : {};
}

function normalizeKill(row) {
  return {
    tick: numberValue(row, ["tick", "event_tick"], 0),
    totalRoundsPlayed: numberValue(row, ["total_rounds_played"], 0),
    killerSteamId: stringValue(row, ["attacker_steamid", "killer_steamid", "user_steamid", "attacker_XUID"]),
    victimSteamId: stringValue(row, ["user_steamid", "victim_steamid", "userid_steamid", "user_XUID"]),
    assisterSteamId: stringValue(row, ["assister_steamid", "assist_steamid", "assister_XUID"]) || undefined,
    killerName: stringValue(row, ["attacker_name", "killer_name"]),
    victimName: stringValue(row, ["user_name", "victim_name", "userid_name"]),
    killerTeamNum: numberValue(row, ["attacker_team_num", "killer_team_num"], 0),
    victimTeamNum: numberValue(row, ["user_team_num", "victim_team_num", "userid_team_num"], 0),
    assisterName: stringValue(row, ["assister_name", "assist_name"]),
    weapon: stringValue(row, ["weapon", "weapon_name"]),
    headshot: boolValue(row, ["headshot", "is_headshot"]),
  };
}

function normalizeDamage(row) {
  return {
    tick: numberValue(row, ["tick", "event_tick"], 0),
    totalRoundsPlayed: numberValue(row, ["total_rounds_played"], 0),
    attackerSteamId: stringValue(row, ["attacker_steamid", "attacker_XUID"]),
    victimSteamId: stringValue(row, ["user_steamid", "victim_steamid", "userid_steamid", "user_XUID"]),
    attackerName: stringValue(row, ["attacker_name"]),
    victimName: stringValue(row, ["user_name", "victim_name", "userid_name"]),
    attackerTeamNum: numberValue(row, ["attacker_team_num"], 0),
    victimTeamNum: numberValue(row, ["user_team_num", "victim_team_num", "userid_team_num"], 0),
    hpDamage: numberValue(row, ["dmg_health", "hp_damage", "damage_health"], 0),
    weapon: stringValue(row, ["weapon", "weapon_name"]),
  };
}

function ensurePlayer(players, steamId, name = "Unknown") {
  if (!steamId) return null;
  if (!players.has(steamId)) {
    players.set(steamId, {
      steamId,
      name: name || steamId,
      kills: 0,
      deaths: 0,
      assists: 0,
      kd: 0,
      damage: 0,
      adr: 0,
      headshotKills: 0,
      headshotPercent: 0,
      kastRounds: 0,
      kastPercent: 0,
      entryKills: 0,
      entryDeaths: 0,
      tradeKills: 0,
      tradedDeaths: 0,
      flashAssists: 0,
      utilityDamage: 0,
      tStats: { ...EMPTY_SIDE },
      ctStats: { ...EMPTY_SIDE },
      weapons: [],
      aim: {},
      movement: {},
    });
  } else if (name && players.get(steamId).name === steamId) {
    players.get(steamId).name = name;
  }
  return players.get(steamId);
}

function isEnemyEvent(leftTeamNum, rightTeamNum) {
  return !leftTeamNum || !rightTeamNum || leftTeamNum !== rightTeamNum;
}

function isValidEnemyKill(kill) {
  return kill.killerSteamId && kill.killerSteamId !== kill.victimSteamId && isEnemyEvent(kill.killerTeamNum, kill.victimTeamNum);
}

function buildVoicePlayers(ticks, playerInfo) {
  const bySteamId = new Map();
  playerInfo.forEach((player, index) => {
    const steamId = stringValue(player, ["steamid", "player_steamid", "xuid", "SteamID"]);
    if (!steamId) return;
    bySteamId.set(steamId, {
      steamId,
      name: stringValue(player, ["name", "player_name"]) || steamId,
      teamNum: numberValue(player, ["team_number", "team_num"], 0),
      entityId: numberValue(player, ["entity_id"], 0),
      playerSlot: numberValue(player, ["player_slot"], 0) || undefined,
      inferredSlot: index,
    });
  });

  for (const tick of ticks) {
    const steamId = stringValue(tick, ["player_steamid", "steamid", "SteamID"]);
    if (!steamId) continue;
    const current = bySteamId.get(steamId) || { steamId, name: steamId };
    bySteamId.set(steamId, {
      ...current,
      name: stringValue(tick, ["player_name", "name"]) || current.name,
      teamNum: numberValue(tick, ["team_num"], current.teamNum || 0),
      entityId: numberValue(tick, ["entity_id"], current.entityId || 0),
      playerSlot: numberValue(tick, ["player_slot"], current.playerSlot || 0) || current.playerSlot,
      inferredSlot: current.inferredSlot,
    });
  }

  return [...bySteamId.values()].filter((player) => player.steamId && player.teamNum && player.entityId);
}

function buildRounds(roundStarts, roundEnds, kills) {
  const latestEndByRound = new Map();
  for (const end of roundEnds) {
    const roundNumber = numberValue(end, ["total_rounds_played"], 0);
    const winner = value(end, ["winner", "winner_side"]);
    if (roundNumber <= 0 || !winner) continue;
    latestEndByRound.set(roundNumber, end);
  }

  return [...latestEndByRound.entries()].sort(([a], [b]) => a - b).map(([roundNumber, end], index, all) => {
    const previousEnd = index > 0 ? numberValue(all[index - 1][1], ["tick", "event_tick"], 0) : 0;
    const matchingStart = roundStarts
      .filter((start) => numberValue(start, ["total_rounds_played"], 0) === roundNumber - 1 && numberValue(start, ["tick", "event_tick"], 0) > previousEnd)
      .sort((a, b) => numberValue(a, ["tick", "event_tick"], 0) - numberValue(b, ["tick", "event_tick"], 0))[0];
    const startTick = matchingStart ? numberValue(matchingStart, ["tick", "event_tick"], previousEnd + 1) : previousEnd + 1;
    const endTick = numberValue(end, ["tick", "event_tick"], startTick);
    const winnerSide = String(value(end, ["winner", "winner_side"]) || "UNKNOWN").toUpperCase();
    return {
      roundNumber,
      winnerSide: winnerSide === "T" || winnerSide === "CT" ? winnerSide : "UNKNOWN",
      startTick,
      endTick,
      kills: kills.filter((kill) => kill.totalRoundsPlayed === roundNumber),
    };
  });
}

function buildKastTable(rounds, players, tickRate) {
  const tradeWindowTicks = tickRate * 5;
  const playerIds = [...players.keys()];
  const kastRows = [];

  for (const round of rounds) {
    const validKills = round.kills.filter(isValidEnemyKill).sort((a, b) => a.tick - b.tick);
    const deaths = new Set(round.kills.map((kill) => kill.victimSteamId).filter(Boolean));
    const state = new Map();

    for (const steamId of playerIds) {
      state.set(steamId, {
        steamId,
        name: players.get(steamId)?.name || steamId,
        roundNumber: round.roundNumber,
        kill: false,
        assist: false,
        survived: !deaths.has(steamId),
        traded: false,
        kast: false,
      });
    }

    for (const kill of validKills) {
      if (state.has(kill.killerSteamId)) state.get(kill.killerSteamId).kill = true;
      if (kill.assisterSteamId && state.has(kill.assisterSteamId)) state.get(kill.assisterSteamId).assist = true;
    }

    const tradedVictimCounts = new Map();
    const tradeKillCounts = new Map();
    for (const current of validKills) {
      const tradedKill = validKills.find((previous) =>
        previous.tick < current.tick &&
        current.tick - previous.tick <= tradeWindowTicks &&
        previous.killerSteamId === current.victimSteamId &&
        previous.victimTeamNum === current.killerTeamNum
      );
      if (!tradedKill) continue;
      tradedVictimCounts.set(tradedKill.victimSteamId, (tradedVictimCounts.get(tradedKill.victimSteamId) || 0) + 1);
      tradeKillCounts.set(current.killerSteamId, (tradeKillCounts.get(current.killerSteamId) || 0) + 1);
      if (state.has(tradedKill.victimSteamId)) state.get(tradedKill.victimSteamId).traded = true;
      if (state.has(current.killerSteamId)) state.get(current.killerSteamId).traded = true;
    }

    for (const [steamId, count] of tradedVictimCounts) ensurePlayer(players, steamId).tradedDeaths += count;
    for (const [steamId, count] of tradeKillCounts) ensurePlayer(players, steamId).tradeKills += count;

    for (const row of state.values()) {
      row.kast = row.kill || row.assist || row.survived || row.traded;
      kastRows.push(row);
    }
  }

  return kastRows;
}

function computeStats(events, ticks, header, playerInfo, updatedFields, demoPath, parserExports, warnings) {
  const rawKills = events.player_death || [];
  const rawDamages = events.player_hurt || [];
  const rawShots = events.weapon_fire || [];
  const rawRoundStarts = events.round_start || [];
  const rawRoundEnds = events.round_end || [];
  const kills = rawKills.map(normalizeKill).filter((kill) => kill.totalRoundsPlayed > 0 && kill.victimSteamId);
  const damages = rawDamages.map(normalizeDamage).filter((damage) => damage.totalRoundsPlayed > 0 && damage.attackerSteamId && damage.victimSteamId);
  const rounds = buildRounds(rawRoundStarts, rawRoundEnds, kills);
  const completedRounds = Math.max(rounds.filter((round) => round.endTick && round.endTick !== Number.MAX_SAFE_INTEGER).length, 1);
  const players = new Map();

  for (const player of playerInfo) ensurePlayer(players, stringValue(player, ["steamid", "player_steamid", "xuid", "SteamID"]), stringValue(player, ["name", "player_name"]));
  for (const tick of ticks) ensurePlayer(players, stringValue(tick, ["player_steamid", "steamid", "SteamID"]), stringValue(tick, ["player_name", "name"]));

  for (const kill of kills) {
    if (isValidEnemyKill(kill)) {
      const killer = ensurePlayer(players, kill.killerSteamId, kill.killerName);
      killer.kills += 1;
      if (kill.headshot) killer.headshotKills += 1;
      const weapon = killer.weapons.find((w) => w.weapon === kill.weapon) || { weapon: kill.weapon || "unknown", kills: 0, shots: 0, hits: 0, headshotKills: 0, accuracyPercent: 0 };
      if (!killer.weapons.includes(weapon)) killer.weapons.push(weapon);
      weapon.kills += 1;
      if (kill.headshot) weapon.headshotKills += 1;
    }
    ensurePlayer(players, kill.victimSteamId, kill.victimName).deaths += 1;
    if (isValidEnemyKill(kill) && kill.assisterSteamId && kill.assisterSteamId !== kill.killerSteamId && kill.assisterSteamId !== kill.victimSteamId) {
      ensurePlayer(players, kill.assisterSteamId, kill.assisterName).assists += 1;
    }
  }

  for (const damage of damages) {
    if (damage.attackerSteamId === damage.victimSteamId || !isEnemyEvent(damage.attackerTeamNum, damage.victimTeamNum)) continue;
    ensurePlayer(players, damage.attackerSteamId, damage.attackerName).damage += damage.hpDamage;
    ensurePlayer(players, damage.victimSteamId, damage.victimName);
  }

  for (const round of rounds) {
    const firstKill = round.kills.find(isValidEnemyKill);
    if (firstKill) {
      ensurePlayer(players, firstKill.killerSteamId).entryKills += 1;
      ensurePlayer(players, firstKill.victimSteamId).entryDeaths += 1;
    }
  }

  const tickRate = Number(header.tickRate || header.tick_rate || 64);
  const perRoundKast = buildKastTable(rounds, players, tickRate);
  const kastByPlayer = new Map();
  for (const row of perRoundKast) {
    const current = kastByPlayer.get(row.steamId) || { kastRounds: 0, roundsPlayed: 0 };
    current.roundsPlayed += 1;
    if (row.kast) current.kastRounds += 1;
    kastByPlayer.set(row.steamId, current);
  }

  for (const player of players.values()) {
    const activeRounds = Math.max(kastByPlayer.get(player.steamId)?.roundsPlayed || rounds.length || completedRounds, 1);
    player.kd = Number((player.kills / Math.max(player.deaths, 1)).toFixed(2));
    player.adr = Number((player.damage / activeRounds).toFixed(1));
    player.headshotPercent = player.kills ? Number(((player.headshotKills / player.kills) * 100).toFixed(1)) : 0;
    player.kastRounds = kastByPlayer.get(player.steamId)?.kastRounds || 0;
    player.kastPercent = Number(((player.kastRounds / activeRounds) * 100).toFixed(1));
  }

  const updatedFieldNames = Array.isArray(updatedFields) ? updatedFields.map((field) => typeof field === "string" ? field : String(field?.name || field?.prop || field)) : [];
  const actualTickFields = new Set(ticks.flatMap((row) => Object.keys(row || {})));
  const missingFields = ticks.length ? TICK_FIELDS.filter((field) => !actualTickFields.has(field)) : [];
  const voicePlayers = buildVoicePlayers(ticks, playerInfo);
  if (!ticks.length) warnings.push("No tick rows read; T/CT side stats, aim, movement and voice-slot POC remain incomplete");
  warnings.push("Events with total_rounds_played = 0 are excluded as warmup/knife-round data");
  if (missingFields.length) warnings.push(`demoparser2 did not advertise these requested tick fields: ${missingFields.join(", ")}`);
  if (missingFields.includes("player_slot")) warnings.push("player_slot is unavailable; Team T/CT voice masks use inferred player order and should be verified against source2-demo");
  warnings.push("Side stats are hidden until reliable per-event side mapping is verified");

  return {
    success: true,
    demo: {
      filepath: demoPath,
      filename: path.basename(demoPath),
      mapName: String(header.map_name || header.mapName || header.map || "unknown"),
      tickRate,
      totalRounds: rounds.length,
      parser: "demoparser2",
      analyzedAt: new Date().toISOString(),
    },
    players: [...players.values()],
    rounds,
    events: { kills, damages, shots: rawShots },
    deathReviews: kills.filter((kill) => kill.killerSteamId && kill.victimSteamId).map((kill) => ({
      round: rounds.find((round) => kill.tick >= round.startTick && kill.tick <= round.endTick)?.roundNumber || 0,
      deathTick: kill.tick,
      startTick: Math.max(0, kill.tick - Number(header.tickRate || header.tick_rate || 64) * 5),
      endTick: kill.tick,
      victimSteamId: kill.victimSteamId,
      killerSteamId: kill.killerSteamId,
      weapon: kill.weapon,
      headshot: kill.headshot,
    })),
    debug: {
      rawKillsCount: rawKills.length,
      rawDeathsCount: rawKills.length,
      rawDamagesCount: rawDamages.length,
      rawShotsCount: rawShots.length,
      rawRoundsCount: rounds.length,
      warnings,
      availableParserExports: parserExports,
      readFields: TICK_FIELDS,
      availableUpdatedFieldsSample: updatedFieldNames.slice(0, 100),
      missingFields,
      playerInfo,
      rawKills,
      rawDamages,
      rawRoundStarts,
      rawRoundEnds,
      normalizedKills: kills,
      normalizedDamages: damages,
      perRoundKast,
      rawRounds: rounds,
      computedPlayers: [...players.values()],
      voicePlayers,
    },
  };
}

async function main() {
  const demoPath = process.argv[2];
  if (!demoPath) throw new Error("Usage: node analyze-demo.js <demo.dem>");
  const parser = await import("@laihoe/demoparser2");
  const warnings = [];
  const [header, events, ticks, playerInfo, updatedFields] = await Promise.all([
    parseHeader(parser, demoPath),
    parseEvents(parser, demoPath, warnings),
    parseTicks(parser, demoPath, warnings),
    callAny(parser, ["parsePlayerInfo"], [[demoPath]]),
    callAny(parser, ["listUpdatedFields"], [[demoPath]]),
  ]);
  console.log(JSON.stringify(computeStats(events, ticks, header, Array.isArray(playerInfo) ? playerInfo : [], updatedFields, demoPath, Object.keys(parser), warnings)));
}

main().catch((error) => {
  console.log(JSON.stringify({
    success: false,
    error: error instanceof Error ? error.message : String(error),
    demo: { filepath: process.argv[2] || "", filename: path.basename(process.argv[2] || ""), mapName: "unknown", tickRate: 64, totalRounds: 0, parser: "demoparser2", analyzedAt: new Date().toISOString() },
    players: [],
    rounds: [],
    debug: { rawKillsCount: 0, rawDamagesCount: 0, rawShotsCount: 0, rawRoundsCount: 0, warnings: [] },
  }));
  process.exitCode = 1;
});
