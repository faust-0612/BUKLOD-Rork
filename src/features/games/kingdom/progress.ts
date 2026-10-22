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

const STORAGE_KEY = 'buklod.kingdom.preview.progress.v1';
const DUPLICATE_RESULT_WINDOW_MS = 1800;
const listeners = new Set<(progress: BuklodKingdomPreviewProgress) => void>();
let cache: BuklodKingdomPreviewProgress | null = null;
let lastResultSignature = '';
let lastResultAt = 0;

const emptyProgress = (): BuklodKingdomPreviewProgress => ({ version: 1, stations: {} });

function normalize(value: unknown): BuklodKingdomPreviewProgress {
  if (!value || typeof value !== 'object') return emptyProgress();
  const row = value as Partial<BuklodKingdomPreviewProgress>;
  return {
    version: 1,
    stations: row.stations && typeof row.stations === 'object' ? row.stations : {},
  };
}

function publish(progress: BuklodKingdomPreviewProgress) {
  cache = progress;
  listeners.forEach((listener) => listener(progress));
}

function resultSignature(result: BuklodGameResult) {
  return [result.gameId, result.status, result.score || 0, result.stars].join('|');
}

export function getCachedBuklodKingdomPreviewProgress() {
  return cache;
}

export async function loadBuklodKingdomPreviewProgress() {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const progress = raw ? normalize(JSON.parse(raw)) : emptyProgress();
    publish(progress);
    return progress;
  } catch {
    const progress = emptyProgress();
    publish(progress);
    return progress;
  }
}

export async function recordBuklodKingdomPreviewResult(result: BuklodGameResult) {
  // Older route screens may still forward the same finish result while the shared
  // BuklodGameStage also records it. Treat the same near-simultaneous result as one
  // completion so one game finish can never add two Kingdom clears.
  const signature = resultSignature(result);
  const now = Date.now();
  if (signature === lastResultSignature && now - lastResultAt < DUPLICATE_RESULT_WINDOW_MS) {
    return loadBuklodKingdomPreviewProgress();
  }
  lastResultSignature = signature;
  lastResultAt = now;

  const current = await loadBuklodKingdomPreviewProgress();
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

  cache = next;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } finally {
    publish(next);
  }
  return next;
}

export function subscribeBuklodKingdomPreviewProgress(
  listener: (progress: BuklodKingdomPreviewProgress) => void,
) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
