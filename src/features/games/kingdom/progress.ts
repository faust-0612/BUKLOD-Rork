import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';
import type { BuklodGameResult } from '../types';

export type BuklodKingdomStationProgress = {
  gameId: string;
  clears: number;
  bestScore: number;
  bestStars: 0 | 1 | 2 | 3;
  lastStatus: 'won' | 'lost';
  updatedAt: string;
};
export type BuklodKingdomPreviewProgress = {
  version: 1;
  stations: Record<string, BuklodKingdomStationProgress>;
};

/**
 * Account isolation R1:
 * Legacy anonymous key 'buklod.kingdom.preview.progress.v1' is preserved
 * untouched for an explicit owner-confirmed migration later. Never silently
 * attach anonymous results to the next signed-in account.
 *
 * Local preview progress is NOT cloud sync and does NOT grant Main BUKLOD XP,
 * Points, Circle Rank or character unlocks.
 */
const STORAGE_PREFIX = 'buklod.kingdom.preview.progress.v2.';
const DUPLICATE_RESULT_WINDOW_MS = 1800;
const cache = new Map<string, BuklodKingdomPreviewProgress>();
const loading = new Map<string, Promise<BuklodKingdomPreviewProgress>>();
const lastResult = new Map<string, { signature: string; at: number }>();
const listeners = new Set<{ owner: string; notify: (value: BuklodKingdomPreviewProgress) => void }>();

const emptyProgress = (): BuklodKingdomPreviewProgress => ({ version: 1, stations: {} });
const validOwner = (value: string | null | undefined): value is string =>
  typeof value === 'string' && /^[a-zA-Z0-9-]{8,128}$/.test(value);

async function ownerOf(explicit?: string | null): Promise<string | null> {
  if (explicit !== undefined) return validOwner(explicit) ? explicit : null;
  try {
    const { data } = await supabase.auth.getSession();
    const owner = data.session?.user?.id;
    return validOwner(owner) ? owner : null;
  } catch {
    return null;
  }
}
function normalize(value: unknown): BuklodKingdomPreviewProgress {
  if (!value || typeof value !== 'object') return emptyProgress();
  const candidate = value as Partial<BuklodKingdomPreviewProgress>;
  return {
    version: 1,
    stations: candidate.stations && typeof candidate.stations === 'object'
      ? candidate.stations
      : {},
  };
}
function publish(owner: string, progress: BuklodKingdomPreviewProgress) {
  cache.set(owner, progress);
  listeners.forEach((entry) => { if (entry.owner === owner) entry.notify(progress); });
}

export function getCachedBuklodKingdomPreviewProgress(owner?: string | null) {
  return validOwner(owner) ? cache.get(owner) ?? null : null;
}

export async function loadBuklodKingdomPreviewProgress(userId?: string | null) {
  const owner = await ownerOf(userId);
  if (!owner) return emptyProgress();
  const cached = cache.get(owner);
  if (cached) return cached;
  const pending = loading.get(owner);
  if (pending) return pending;
  const request = (async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_PREFIX + owner);
      const progress = raw ? normalize(JSON.parse(raw)) : emptyProgress();
      publish(owner, progress);
      return progress;
    } catch {
      const progress = emptyProgress();
      publish(owner, progress);
      return progress;
    }
  })();
  loading.set(owner, request);
  try { return await request; }
  finally { loading.delete(owner); }
}

export async function recordBuklodKingdomPreviewResult(result: BuklodGameResult, userId?: string | null) {
  const owner = await ownerOf(userId);
  if (!owner) return emptyProgress();
  if (!result.gameId || (result.status !== 'won' && result.status !== 'lost')) {
    return loadBuklodKingdomPreviewProgress(owner);
  }
  const signature = [result.gameId, result.status, result.score || 0, result.stars].join('|');
  const now = Date.now();
  const previousResult = lastResult.get(owner);
  if (previousResult?.signature === signature && now - previousResult.at < DUPLICATE_RESULT_WINDOW_MS) {
    return loadBuklodKingdomPreviewProgress(owner);
  }
  lastResult.set(owner, { signature, at: now });

  const current = await loadBuklodKingdomPreviewProgress(owner);
  const previous = current.stations[result.gameId];
  const won = result.status === 'won';
  const nextStation: BuklodKingdomStationProgress = {
    gameId: result.gameId,
    clears: Math.max(0, previous?.clears ?? 0) + (won ? 1 : 0),
    bestScore: Math.max(previous?.bestScore ?? 0, Math.max(0, result.score || 0)),
    bestStars: Math.max(previous?.bestStars ?? 0, result.stars) as 0 | 1 | 2 | 3,
    lastStatus: result.status,
    updatedAt: new Date().toISOString(),
  };
  const next: BuklodKingdomPreviewProgress = {
    version: 1,
    stations: { ...current.stations, [result.gameId]: nextStation },
  };
  // Progress is local preview data. A storage failure should never block gameplay.
  try {
    await AsyncStorage.setItem(STORAGE_PREFIX + owner, JSON.stringify(next));
    publish(owner, next);
  } catch {
    publish(owner, next);
  }
  return next;
}

export function subscribeBuklodKingdomPreviewProgress(
  listener: (progress: BuklodKingdomPreviewProgress) => void,
  userId: string | null,
) {
  if (!validOwner(userId)) return () => {};
  const entry = { owner: userId, notify: listener };
  listeners.add(entry);
  return () => { listeners.delete(entry); };
}


const LEGACY_STORAGE_KEY = 'buklod.kingdom.preview.progress.v1';
const LEGACY_OWNER_KEY = 'buklod.kingdom.preview.legacy.owner.r1';
const LEGACY_IMPORT_PREFIX = 'buklod.kingdom.preview.legacy.imported.r1.';

/**
 * Legacy v1 results were device-global. Never auto-merge them into whichever
 * user happens to sign in next. Import is an explicit, one-owner action.
 */
export async function canImportLegacyBuklodKingdomProgress(userId: string | null) {
  if (!validOwner(userId)) return false;
  try {
    const [raw, owner, imported] = await Promise.all([
      AsyncStorage.getItem(LEGACY_STORAGE_KEY),
      AsyncStorage.getItem(LEGACY_OWNER_KEY),
      AsyncStorage.getItem(LEGACY_IMPORT_PREFIX + userId),
    ]);
    return !!raw && !imported && (!owner || owner === userId);
  } catch {
    return false;
  }
}

export async function importLegacyBuklodKingdomProgress(userId: string) {
  if (!(await canImportLegacyBuklodKingdomProgress(userId))) {
    throw new Error('Legacy Kingdom preview data is unavailable or belongs to another account.');
  }
  const raw = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) return loadBuklodKingdomPreviewProgress(userId);
  const legacy = normalize(JSON.parse(raw));
  const current = await loadBuklodKingdomPreviewProgress(userId);
  const stations = { ...current.stations };
  Object.entries(legacy.stations).forEach(([id, old]) => {
    if (!old || typeof old !== 'object' || !id) return;
    const now = stations[id];
    const oldClears = Math.max(0, Number(old.clears) || 0);
    const oldScore = Math.max(0, Number(old.bestScore) || 0);
    const oldStars = Math.min(3, Math.max(0, Number(old.bestStars) || 0)) as 0 | 1 | 2 | 3;
    stations[id] = {
      gameId: id,
      clears: Math.max(now?.clears ?? 0, oldClears),
      bestScore: Math.max(now?.bestScore ?? 0, oldScore),
      bestStars: Math.max(now?.bestStars ?? 0, oldStars) as 0 | 1 | 2 | 3,
      lastStatus: now?.lastStatus ?? (old.lastStatus === 'lost' ? 'lost' : 'won'),
      updatedAt: now?.updatedAt ?? (typeof old.updatedAt === 'string' ? old.updatedAt : new Date().toISOString()),
    };
  });
  const merged: BuklodKingdomPreviewProgress = { version: 1, stations };
  // Mark ownership before publishing new results so another account cannot
  // consume the same anonymous results during an account switch.
  await AsyncStorage.setItem(LEGACY_OWNER_KEY, userId);
  await AsyncStorage.setItem(STORAGE_PREFIX + userId, JSON.stringify(merged));
  await AsyncStorage.setItem(LEGACY_IMPORT_PREFIX + userId, 'yes');
  publish(userId, merged);
  return merged;
}
