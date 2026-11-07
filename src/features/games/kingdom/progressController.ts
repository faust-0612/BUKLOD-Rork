/**
 * Account-scoped, local-only Kingdom ORIGINAL station progress.
 * Does not read the unscoped v1 progress key (which could expose another
 * person's clears on a shared device). Does not grant any reward, XP or points.
 */
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
export type KingdomPreviewStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};
type Listener = (progress: BuklodKingdomPreviewProgress) => void;
type LastReceipt = { signature: string; time: number };

const PREFIX = 'buklod.kingdom.preview.progress.account.v2/';
const DUPLICATE_WINDOW_MS = 1800;
const validAccount = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
const validGame = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-z][a-z0-9-]{2,99}$/.test(value);
const stars = (n: unknown): 0 | 1 | 2 | 3 =>
  Math.min(3, Math.max(0, Math.trunc(Number.isFinite(n) ? Number(n) : 0))) as 0 | 1 | 2 | 3;
const score = (n: unknown): number =>
  Math.min(100_000_000, Math.max(0, Number.isFinite(n) ? Math.round(Number(n)) : 0));

export const emptyKingdomPreviewProgress = (): BuklodKingdomPreviewProgress => ({ version: 1, stations: {} });
export function kingdomAccountKey(userId: string | null | undefined): string | null {
  return validAccount(userId) ? PREFIX + userId.toLowerCase() : null;
}
function normalize(input: unknown): BuklodKingdomPreviewProgress {
  const result = emptyKingdomPreviewProgress();
  if (!input || typeof input !== 'object') return result;
  const original = (input as Partial<BuklodKingdomPreviewProgress>).stations;
  if (!original || typeof original !== 'object' || Array.isArray(original)) return result;
  for (const [id, value] of Object.entries(original)) {
    if (!validGame(id) || !value || typeof value !== 'object' || value.gameId !== id) continue;
    result.stations[id] = {
      gameId: id,
      clears: Math.min(1_000_000, Math.max(0, Math.trunc(Number(value.clears) || 0))),
      bestScore: score(value.bestScore),
      bestStars: stars(value.bestStars),
      lastStatus: value.lastStatus === 'won' ? 'won' : 'lost',
      updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt.slice(0, 40) : '',
    };
  }
  return result;
}
export function validateKingdomPreviewResult(result: BuklodGameResult) {
  if (!result || !validGame(result.gameId) ||
      (result.status !== 'won' && result.status !== 'lost') ||
      !Number.isFinite(result.score) || result.score < 0 || result.score > 100_000_000 ||
      !Number.isInteger(result.stars) || result.stars < 0 || result.stars > 3) {
    throw new Error('Invalid Kingdom local preview result');
  }
}
export function createKingdomProgressController(storage: KingdomPreviewStorage, now: () => number = Date.now) {
  const cache = new Map<string, BuklodKingdomPreviewProgress>();
  const reads = new Map<string, Promise<BuklodKingdomPreviewProgress>>();
  const writes = new Map<string, Promise<BuklodKingdomPreviewProgress>>();
  const listeners = new Map<string, Set<Listener>>();
  const lastByGame = new Map<string, LastReceipt>();

  function getCached(userId: string | null | undefined): BuklodKingdomPreviewProgress | null {
    const key = kingdomAccountKey(userId);
    return key ? cache.get(key) ?? null : null;
  }
  async function load(userId: string | null | undefined): Promise<BuklodKingdomPreviewProgress> {
    const key = kingdomAccountKey(userId);
    if (!key) return emptyKingdomPreviewProgress();
    const existing = cache.get(key);
    if (existing) return existing;
    const inFlight = reads.get(key);
    if (inFlight) return inFlight;
    const read = storage.getItem(key).then(raw => {
      let progress = emptyKingdomPreviewProgress();
      if (raw) {
        try { progress = normalize(JSON.parse(raw)); }
        catch { /* Ignore only corrupt old JSON for this account, never another user's data. */ }
      }
      cache.set(key, progress);
      return progress;
    });
    reads.set(key, read);
    try { return await read; }
    finally { if (reads.get(key) === read) reads.delete(key); }
  }
  function subscribe(userId: string | null | undefined, listener: Listener): () => void {
    const key = kingdomAccountKey(userId);
    if (!key) return () => undefined;
    let set = listeners.get(key);
    if (!set) { set = new Set(); listeners.set(key, set); }
    set.add(listener);
    return () => {
      const current = listeners.get(key);
      current?.delete(listener);
      if (current?.size === 0) listeners.delete(key);
    };
  }
  function publish(key: string, result: BuklodKingdomPreviewProgress) {
    cache.set(key, result);
    for (const listener of listeners.get(key) ?? []) listener(result);
  }
  function record(userId: string | null | undefined, result: BuklodGameResult): Promise<BuklodKingdomPreviewProgress> {
    const key = kingdomAccountKey(userId);
    if (!key) return Promise.resolve(emptyKingdomPreviewProgress());
    try { validateKingdomPreviewResult(result); }
    catch (error) { return Promise.reject(error); }
    const predecessor = writes.get(key) ?? Promise.resolve(emptyKingdomPreviewProgress());
    const active = predecessor.catch(() => emptyKingdomPreviewProgress()).then(async () => {
      const progress = await load(userId);
      const timestamp = now();
      const signature = [result.gameId, result.status, result.score, result.stars].join('|');
      const receiptKey = key + '/' + result.gameId;
      const last = lastByGame.get(receiptKey);
      if (last?.signature === signature && timestamp >= last.time &&
          timestamp - last.time < DUPLICATE_WINDOW_MS) return progress;
      const prior = progress.stations[result.gameId];
      const update: BuklodKingdomStationProgress = {
        gameId: result.gameId,
        clears: Math.min(1_000_000, (prior?.clears ?? 0) + (result.status === 'won' ? 1 : 0)),
        bestScore: Math.max(prior?.bestScore ?? 0, score(result.score)),
        bestStars: Math.max(prior?.bestStars ?? 0, stars(result.stars)) as 0 | 1 | 2 | 3,
        lastStatus: result.status,
        updatedAt: new Date(timestamp).toISOString(),
      };
      const next = { version: 1 as const, stations: { ...progress.stations, [result.gameId]: update } };
      await storage.setItem(key, JSON.stringify(next));
      lastByGame.set(receiptKey, { signature, time: timestamp });
      publish(key, next);
      return next;
    });
    writes.set(key, active);
    void active.finally(() => {
      if (writes.get(key) === active) writes.delete(key);
    }).catch(() => undefined);
    return active;
  }
  return { getCached, load, subscribe, record };
}
