import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';
import type { BuklodGameResult } from '../types';

export type BuklodKingdomStationProgress = {
  gameId: string;
  characterKey: string;
  characterName: string;
  regionName: string;
  gameName: string;
  revealOrder: number;
  requiredRankOrder: number | null;
  unlocked: boolean;
  currentLevel: number;
  clearedLevels: number;
  mastered: boolean;
  clears: number;
  attempts: number;
  bestScore: number;
  bestStars: 0 | 1 | 2 | 3;
  lastStatus: 'ready' | 'won' | 'lost';
  worldTier: 0 | 1 | 2 | 3 | 4 | 5;
  collectibleKey: string | null;
  collectibleEarned: boolean;
};

export type BuklodKingdomLastResult = {
  clientResultId: string;
  gameId: string;
  levelNo: number;
  status: 'won' | 'lost';
  score: number;
  stars: 0 | 1 | 2 | 3;
  firstClear: boolean;
  starImproved: boolean;
  kingdomXpAwarded: number;
  gameXpAwarded: number;
  collectibleAwarded: string | null;
};

export type BuklodKingdomProgress = {
  version: 2;
  serverBacked: boolean;
  circleRankOrder: number;
  circleRankName: string;
  systemAdminOverride: boolean;
  kingdomXp: number;
  gameXp: number;
  clearedRegions: number;
  masteredRegions: number;
  stage: 1 | 2 | 3 | 4 | 5;
  stageTitle: string;
  stageSubtitle: string;
  landmarks: {
    trainingGrounds: boolean;
    igpatArena: boolean;
    mentorTower: boolean;
    kingdomUnited: boolean;
  };
  stations: Record<string, BuklodKingdomStationProgress>;
  progressionModel: string;
  economyModel: string;
  pendingResults: number;
  lastResult: BuklodKingdomLastResult | null;
};

export type BuklodKingdomPreviewProgress = BuklodKingdomProgress;

type PendingResult = {
  clientResultId: string;
  result: BuklodGameResult;
};

const CACHE_KEY = 'buklod.kingdom.progress.v2';
const QUEUE_KEY = 'buklod.kingdom.pending-results.v1';
const DUPLICATE_RESULT_WINDOW_MS = 1800;
const listeners = new Set<(progress: BuklodKingdomProgress) => void>();

let cache: BuklodKingdomProgress | null = null;
let lastResultSignature = '';
let lastResultAt = 0;
let resultSequence = 0;
let flushPromise: Promise<void> | null = null;

function clampInt(value: unknown, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return min;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function emptyProgress(): BuklodKingdomProgress {
  return {
    version: 2,
    serverBacked: false,
    circleRankOrder: 1,
    circleRankName: 'Circle Starter V',
    systemAdminOverride: false,
    kingdomXp: 0,
    gameXp: 0,
    clearedRegions: 0,
    masteredRegions: 0,
    stage: 1,
    stageTitle: 'A SMALL BEGINNING',
    stageSubtitle: 'A greater tomorrow starts here',
    landmarks: {
      trainingGrounds: false,
      igpatArena: false,
      mentorTower: false,
      kingdomUnited: false,
    },
    stations: {},
    progressionModel: 'SERVER_13_REGIONS_20_LEVELS_SEQUENTIAL_V1',
    economyModel: 'KINGDOM_XP_SEPARATE_FROM_CIRCLE_POINTS_V1',
    pendingResults: 0,
    lastResult: null,
  };
}

function normalizeStation(value: any): BuklodKingdomStationProgress | null {
  const gameId = String(value?.game_id ?? value?.gameId ?? '').trim();
  if (!gameId) return null;
  return {
    gameId,
    characterKey: String(value?.character_key ?? value?.characterKey ?? ''),
    characterName: String(value?.character_name ?? value?.characterName ?? ''),
    regionName: String(value?.region_name ?? value?.regionName ?? ''),
    gameName: String(value?.game_name ?? value?.gameName ?? ''),
    revealOrder: clampInt(value?.reveal_order ?? value?.revealOrder, 1, 99),
    requiredRankOrder:
      value?.required_rank_order == null && value?.requiredRankOrder == null
        ? null
        : clampInt(value?.required_rank_order ?? value?.requiredRankOrder, 1, 99),
    unlocked: Boolean(value?.unlocked),
    currentLevel: clampInt(value?.current_level ?? value?.currentLevel, 1, 20),
    clearedLevels: clampInt(value?.cleared_levels ?? value?.clearedLevels, 0, 20),
    mastered: Boolean(value?.mastered),
    clears: Math.max(0, Number(value?.clears ?? 0) || 0),
    attempts: Math.max(0, Number(value?.attempts ?? 0) || 0),
    bestScore: Math.max(0, Number(value?.best_score ?? value?.bestScore ?? 0) || 0),
    bestStars: clampInt(value?.best_stars ?? value?.bestStars, 0, 3) as 0 | 1 | 2 | 3,
    lastStatus: ['won', 'lost'].includes(String(value?.last_status ?? value?.lastStatus))
      ? (String(value?.last_status ?? value?.lastStatus) as 'won' | 'lost')
      : 'ready',
    worldTier: clampInt(value?.world_tier ?? value?.worldTier, 0, 5) as 0 | 1 | 2 | 3 | 4 | 5,
    collectibleKey:
      value?.collectible_key == null && value?.collectibleKey == null
        ? null
        : String(value?.collectible_key ?? value?.collectibleKey),
    collectibleEarned: Boolean(value?.collectible_earned ?? value?.collectibleEarned),
  };
}

function normalizeLastResult(value: any): BuklodKingdomLastResult | null {
  if (!value || typeof value !== 'object') return null;
  const gameId = String(value?.game_id ?? value?.gameId ?? '');
  const clientResultId = String(value?.client_result_id ?? value?.clientResultId ?? '');
  if (!gameId || !clientResultId) return null;
  return {
    clientResultId,
    gameId,
    levelNo: clampInt(value?.level_no ?? value?.levelNo, 1, 20),
    status: value?.status === 'lost' ? 'lost' : 'won',
    score: Math.max(0, Number(value?.score ?? 0) || 0),
    stars: clampInt(value?.stars, 0, 3) as 0 | 1 | 2 | 3,
    firstClear: Boolean(value?.first_clear ?? value?.firstClear),
    starImproved: Boolean(value?.star_improved ?? value?.starImproved),
    kingdomXpAwarded: Math.max(0, Number(value?.kingdom_xp_awarded ?? value?.kingdomXpAwarded ?? 0) || 0),
    gameXpAwarded: Math.max(0, Number(value?.game_xp_awarded ?? value?.gameXpAwarded ?? 0) || 0),
    collectibleAwarded:
      value?.collectible_awarded == null && value?.collectibleAwarded == null
        ? null
        : String(value?.collectible_awarded ?? value?.collectibleAwarded),
  };
}

function normalize(value: any, pendingResults = 0): BuklodKingdomProgress {
  const stations: Record<string, BuklodKingdomStationProgress> = {};
  const rows = Array.isArray(value?.stations)
    ? value.stations
    : value?.stations && typeof value.stations === 'object'
      ? Object.values(value.stations)
      : [];

  for (const row of rows) {
    const station = normalizeStation(row);
    if (station) stations[station.gameId] = station;
  }

  const stage = clampInt(value?.stage, 1, 5) as 1 | 2 | 3 | 4 | 5;
  return {
    version: 2,
    serverBacked: Boolean(value?.server_backed ?? value?.serverBacked),
    circleRankOrder: clampInt(value?.circle_rank_order ?? value?.circleRankOrder, 1, 99),
    circleRankName: String(value?.circle_rank_name ?? value?.circleRankName ?? 'Circle Starter V'),
    systemAdminOverride: Boolean(value?.system_admin_override ?? value?.systemAdminOverride),
    kingdomXp: Math.max(0, Number(value?.kingdom_xp ?? value?.kingdomXp ?? 0) || 0),
    gameXp: Math.max(0, Number(value?.game_xp ?? value?.gameXp ?? 0) || 0),
    clearedRegions: clampInt(value?.cleared_regions ?? value?.clearedRegions, 0, 13),
    masteredRegions: clampInt(value?.mastered_regions ?? value?.masteredRegions, 0, 13),
    stage,
    stageTitle: String(value?.stage_title ?? value?.stageTitle ?? emptyProgress().stageTitle),
    stageSubtitle: String(value?.stage_subtitle ?? value?.stageSubtitle ?? emptyProgress().stageSubtitle),
    landmarks: {
      trainingGrounds: Boolean(value?.landmarks?.training_grounds ?? value?.landmarks?.trainingGrounds),
      igpatArena: Boolean(value?.landmarks?.igpat_arena ?? value?.landmarks?.igpatArena),
      mentorTower: Boolean(value?.landmarks?.mentor_tower ?? value?.landmarks?.mentorTower),
      kingdomUnited: Boolean(value?.landmarks?.kingdom_united ?? value?.landmarks?.kingdomUnited),
    },
    stations,
    progressionModel: String(
      value?.progression_model ?? value?.progressionModel ?? 'SERVER_13_REGIONS_20_LEVELS_SEQUENTIAL_V1',
    ),
    economyModel: String(
      value?.economy_model ?? value?.economyModel ?? 'KINGDOM_XP_SEPARATE_FROM_CIRCLE_POINTS_V1',
    ),
    pendingResults,
    lastResult: normalizeLastResult(value?.last_result ?? value?.lastResult),
  };
}

async function readQueue(): Promise<PendingResult[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeQueue(queue: PendingResult[]) {
  if (queue.length) {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } else {
    await AsyncStorage.removeItem(QUEUE_KEY);
  }
}

async function persist(progress: BuklodKingdomProgress) {
  cache = progress;
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(progress)).catch(() => undefined);
  listeners.forEach((listener) => listener(progress));
}

async function readCached() {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) {
      const queue = await readQueue();
      cache = normalize(JSON.parse(raw), queue.length);
      return cache;
    }
  } catch {
    // Fall through to an empty state.
  }
  cache = emptyProgress();
  return cache;
}

async function fetchServerState() {
  const queue = await readQueue();
  const { data, error } = await (supabase as any).rpc('get_my_buklod_kingdom_v1');
  if (error) throw error;
  const progress = normalize(data, queue.length);
  await persist(progress);
  return progress;
}

async function submitPending(item: PendingResult) {
  const { data, error } = await (supabase as any).rpc('submit_my_buklod_kingdom_result_v1', {
    p_client_result_id: item.clientResultId,
    p_game_id: item.result.gameId,
    p_status: item.result.status,
    p_score: Math.max(0, Math.floor(item.result.score || 0)),
    p_stars: clampInt(item.result.stars, 0, 3),
  });
  if (error) throw error;
  return data;
}

async function flushPendingQueue() {
  if (flushPromise) return flushPromise;
  flushPromise = (async () => {
    const queue = await readQueue();
    if (!queue.length) return;

    const remaining = [...queue];
    let latest: any = null;

    while (remaining.length) {
      const item = remaining[0];
      try {
        latest = await submitPending(item);
        remaining.shift();
        await writeQueue(remaining);
      } catch {
        break;
      }
    }

    if (latest) {
      await persist(normalize(latest, remaining.length));
    }
  })().finally(() => {
    flushPromise = null;
  });
  return flushPromise;
}

function resultSignature(result: BuklodGameResult) {
  return [result.gameId, result.status, result.score || 0, result.stars].join('|');
}

function makeClientResultId(gameId: string) {
  resultSequence += 1;
  return [
    'kingdom',
    gameId,
    Date.now().toString(36),
    resultSequence.toString(36),
    Math.random().toString(36).slice(2, 10),
  ].join(':');
}

export function getCachedBuklodKingdomProgress() {
  return cache;
}

export function getCachedBuklodKingdomPreviewProgress() {
  return cache;
}

export async function loadBuklodKingdomProgress() {
  await flushPendingQueue().catch(() => undefined);
  try {
    return await fetchServerState();
  } catch {
    const fallback = await readCached();
    const queue = await readQueue();
    const next = { ...fallback, serverBacked: false, pendingResults: queue.length };
    cache = next;
    return next;
  }
}

export async function loadBuklodKingdomPreviewProgress() {
  return loadBuklodKingdomProgress();
}

export async function recordBuklodKingdomResult(result: BuklodGameResult) {
  const signature = resultSignature(result);
  const now = Date.now();
  if (signature === lastResultSignature && now - lastResultAt < DUPLICATE_RESULT_WINDOW_MS) {
    return loadBuklodKingdomProgress();
  }
  lastResultSignature = signature;
  lastResultAt = now;

  const item: PendingResult = {
    clientResultId: makeClientResultId(result.gameId),
    result: {
      ...result,
      score: Math.max(0, Math.floor(result.score || 0)),
      stars: clampInt(result.stars, 0, 3) as 0 | 1 | 2 | 3,
    },
  };

  try {
    const data = await submitPending(item);
    const queue = await readQueue();
    const progress = normalize(data, queue.length);
    await persist(progress);
    return progress;
  } catch {
    const queue = await readQueue();
    if (!queue.some((row) => row.clientResultId === item.clientResultId)) {
      queue.push(item);
      await writeQueue(queue);
    }
    const fallback = await readCached();
    const next = { ...fallback, serverBacked: false, pendingResults: queue.length };
    await persist(next);
    return next;
  }
}

/**
 * Compatibility alias for older screens. New routes submit only through BuklodGameStage.
 */
export async function recordBuklodKingdomPreviewResult(result: BuklodGameResult) {
  return recordBuklodKingdomResult(result);
}

export function subscribeBuklodKingdomProgress(
  listener: (progress: BuklodKingdomProgress) => void,
) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function subscribeBuklodKingdomPreviewProgress(
  listener: (progress: BuklodKingdomProgress) => void,
) {
  return subscribeBuklodKingdomProgress(listener);
}

export async function flushBuklodKingdomPendingResults() {
  await flushPendingQueue();
  return loadBuklodKingdomProgress();
}
