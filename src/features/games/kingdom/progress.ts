import AsyncStorage from '@react-native-async-storage/async-storage';

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

const STORAGE_PREFIX = 'buklod.kingdom.preview.progress.v2';
const DUPLICATE_RESULT_WINDOW_MS = 1800;

type Listener = (progress: BuklodKingdomPreviewProgress) => void;

const caches = new Map<string, BuklodKingdomPreviewProgress>();
const listeners = new Map<string, Set<Listener>>();
const lastResults = new Map<string, { signature: string; at: number }>();
let activeOwnerId: string | null = null;

const emptyProgress = (): BuklodKingdomPreviewProgress => ({ version: 1, stations: {} });

export function setBuklodKingdomProgressOwner(ownerId?: string | null) {
  activeOwnerId = String(ownerId ?? '').trim() || null;
}

function resolvedOwner(ownerId?: string | null) {
  return ownerId === undefined ? activeOwnerId : ownerId;
}

function ownerKey(ownerId?: string | null) {
  const normalized = String(resolvedOwner(ownerId) ?? '').trim();
  return normalized ? normalized.replace(/[^a-zA-Z0-9_-]/g, '_') : 'guest';
}

function storageKey(ownerId?: string | null) {
  return `${STORAGE_PREFIX}.${ownerKey(ownerId)}`;
}

function normalize(value: unknown): BuklodKingdomPreviewProgress {
  if (!value || typeof value !== 'object') return emptyProgress();
  const row = value as Partial<BuklodKingdomPreviewProgress>;
  return {
    version: 1,
    stations: row.stations && typeof row.stations === 'object' ? row.stations : {},
  };
}

function publish(ownerId: string | null | undefined, progress: BuklodKingdomPreviewProgress) {
  const key = ownerKey(ownerId);
  caches.set(key, progress);
  listeners.get(key)?.forEach((listener) => listener(progress));
}

function resultSignature(result: BuklodGameResult) {
  return [result.gameId, result.status, result.score || 0, result.stars].join('|');
}

export function getCachedBuklodKingdomPreviewProgress(ownerId?: string | null) {
  return caches.get(ownerKey(ownerId)) ?? null;
}

export async function loadBuklodKingdomPreviewProgress(ownerId?: string | null) {
  const key = ownerKey(ownerId);
  const cached = caches.get(key);
  if (cached) return cached;

  try {
    const raw = await AsyncStorage.getItem(storageKey(ownerId));
    const progress = raw ? normalize(JSON.parse(raw)) : emptyProgress();
    publish(ownerId, progress);
    return progress;
  } catch {
    const progress = emptyProgress();
    publish(ownerId, progress);
    return progress;
  }
}

export async function recordBuklodKingdomPreviewResult(
  result: BuklodGameResult,
  ownerId?: string | null,
) {
  const key = ownerKey(ownerId);
  const signature = resultSignature(result);
  const now = Date.now();
  const previousResult = lastResults.get(key);

  // Legacy route screens may still forward the same finish result while the shared
  // BuklodGameStage also records it. Treat the same near-simultaneous result as one
  // completion so one game finish can never add two Kingdom clears.
  if (
    previousResult?.signature === signature &&
    now - previousResult.at < DUPLICATE_RESULT_WINDOW_MS
  ) {
    return loadBuklodKingdomPreviewProgress(ownerId);
  }
  lastResults.set(key, { signature, at: now });

  const current = await loadBuklodKingdomPreviewProgress(ownerId);
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

  caches.set(key, next);
  try {
    await AsyncStorage.setItem(storageKey(ownerId), JSON.stringify(next));
  } finally {
    publish(ownerId, next);
  }
  return next;
}

/**
 * System-admin QA only: clears the current account/device Kingdom preview state.
 * The caller must enforce system_admin authorization and explicit confirmation.
 */
export async function resetBuklodKingdomPreviewProgress(ownerId?: string | null) {
  const key = ownerKey(ownerId);
  const next = emptyProgress();
  caches.set(key, next);
  lastResults.delete(key);
  try {
    await AsyncStorage.removeItem(storageKey(ownerId));
  } finally {
    publish(ownerId, next);
  }
  return next;
}

export function subscribeBuklodKingdomPreviewProgress(
  listener: Listener,
  ownerId?: string | null,
) {
  const key = ownerKey(ownerId);
  let bucket = listeners.get(key);
  if (!bucket) {
    bucket = new Set<Listener>();
    listeners.set(key, bucket);
  }
  bucket.add(listener);
  return () => {
    const current = listeners.get(key);
    current?.delete(listener);
    if (current && current.size === 0) listeners.delete(key);
  };
}
