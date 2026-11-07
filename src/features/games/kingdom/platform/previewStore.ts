/**
 * BUKLOD Kingdom R1 account-scoped, OFFLINE/PREVIEW-only game records.
 *
 * No server authority, Character Points, Circle Rank, cash, XP or collectibles
 * are granted here. Do not treat this module as a production reward ledger.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BuklodGameResult } from '@/features/games/types';

export type KingdomPreviewRecord = {
  version: 1;
  gameId: string;
  attempts: number;
  clears: number;
  bestScore: number;
  bestStars: 0 | 1 | 2 | 3;
  lastStatus: 'won' | 'lost';
  lastPlayedAt: string;
  recentSessionIds: string[];
};

const KEY_PREFIX = '@buklod/kingdom/preview-account-v1/';
const MAX_RECENT_SESSION_IDS = 100;
const pendingByKey = new Map<string, Promise<unknown>>();

function storageKey(userId: string, gameId: string): string {
  if (!/^[0-9a-f-]{36}$/i.test(userId) || !/^[a-z0-9-]{3,100}$/.test(gameId)) {
    throw new Error('Invalid Kingdom account or game ID.');
  }
  return KEY_PREFIX + userId.toLowerCase() + '/' + gameId;
}

function emptyRecord(gameId: string): KingdomPreviewRecord {
  return {
    version: 1, gameId, attempts: 0, clears: 0,
    bestScore: 0, bestStars: 0, lastStatus: 'lost',
    lastPlayedAt: '', recentSessionIds: [],
  };
}

export async function readKingdomPreviewRecord(
  userId: string,
  gameId: string,
): Promise<KingdomPreviewRecord> {
  const raw = await AsyncStorage.getItem(storageKey(userId, gameId));
  if (!raw) return emptyRecord(gameId);
  try {
    const parsed = JSON.parse(raw) as Partial<KingdomPreviewRecord>;
    if (parsed?.version !== 1 || parsed.gameId !== gameId) return emptyRecord(gameId);
    return {
      version: 1, gameId,
      attempts: Math.max(0, Number(parsed.attempts) || 0),
      clears: Math.max(0, Number(parsed.clears) || 0),
      bestScore: Math.max(0, Number(parsed.bestScore) || 0),
      bestStars: Math.max(0, Math.min(3, Number(parsed.bestStars) || 0)) as 0 | 1 | 2 | 3,
      lastStatus: parsed.lastStatus === 'won' ? 'won' : 'lost',
      lastPlayedAt: String(parsed.lastPlayedAt || ''),
      recentSessionIds: Array.isArray(parsed.recentSessionIds)
        ? parsed.recentSessionIds.filter((v): v is string => typeof v === 'string').slice(-MAX_RECENT_SESSION_IDS)
        : [],
    };
  } catch {
    return emptyRecord(gameId);
  }
}

export function recordKingdomPreviewResult(
  userId: string,
  sessionId: string,
  result: BuklodGameResult,
): Promise<KingdomPreviewRecord> {
  const key = storageKey(userId, result.gameId);
  if (!/^[a-z0-9._:-]{8,128}$/i.test(sessionId)) {
    return Promise.reject(new Error('Invalid Kingdom session receipt.'));
  }
  if (!Number.isFinite(result.score) || result.score < 0 || result.score > 100_000_000 ||
      !Number.isInteger(result.stars) || result.stars < 0 || result.stars > 3 ||
      (result.status !== 'won' && result.status !== 'lost')) {
    return Promise.reject(new Error('Invalid Kingdom preview result.'));
  }

  // Serialize same-account/same-game writes in this JS instance.
  const previous = pendingByKey.get(key) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(async () => {
    const state = await readKingdomPreviewRecord(userId, result.gameId);
    if (state.recentSessionIds.includes(sessionId)) return state;
    const next: KingdomPreviewRecord = {
      ...state,
      attempts: state.attempts + 1,
      clears: state.clears + (result.status === 'won' ? 1 : 0),
      bestScore: Math.max(state.bestScore, Math.round(result.score)),
      bestStars: Math.max(state.bestStars, result.stars) as 0 | 1 | 2 | 3,
      lastStatus: result.status,
      lastPlayedAt: new Date().toISOString(),
      recentSessionIds: [...state.recentSessionIds, sessionId].slice(-MAX_RECENT_SESSION_IDS),
    };
    // Intentionally persist NO reward payload, cash value, XP or Character Points.
    await AsyncStorage.setItem(key, JSON.stringify(next));
    return next;
  });
  pendingByKey.set(key, current);
  void current.finally(() => {
    if (pendingByKey.get(key) === current) pendingByKey.delete(key);
  }).catch(() => undefined);
  return current;
}
