/**
 * Short-lived, account-scoped IGPAT warm feed. The source keeps signed media
 * URLs valid for 20 minutes; never re-use a token older than eight minutes.
 * Only in-memory: no signed links in persistent or cross-account storage.
 * expo-video is responsible for actual video byte caching.
 */
export type IgpatWarmRow = {
  id: string;
  media_path: string;
  media_url?: string | null;
};

type Entry = { storedAt: number; rows: IgpatWarmRow[] };
const MAX_AGE_MS = 8 * 60 * 1000;
const MAX_ENTRIES = 6;
const feed = new Map<string, Entry>();

export function igpatFeedKey(
  userId: string | null | undefined,
  mode: string,
  dataSaver: boolean,
): string | null {
  if (!userId) return null;
  return JSON.stringify([userId, mode, dataSaver ? 'saver' : 'normal']);
}

export function getIgpatWarmFeed<T extends IgpatWarmRow>(
  userId: string | null | undefined,
  mode: string,
  dataSaver: boolean,
  now = Date.now(),
): T[] {
  const key = igpatFeedKey(userId, mode, dataSaver);
  if (!key) return [];
  const entry = feed.get(key);
  if (!entry) return [];
  if (now < entry.storedAt || now - entry.storedAt >= MAX_AGE_MS) {
    feed.delete(key);
    return [];
  }
  return entry.rows.map(row => ({ ...row })) as unknown as T[];
}

/**
 * A quick Wall → IGPAT → Wall → IGPAT switch should reuse fresh signed
 * playback metadata rather than immediately re-request the entire feed.
 * Explicit retry still fetches because it occurs on an already-visible feed.
 */
export function isIgpatWarmFeedFresh(
  userId: string | null | undefined,
  mode: string,
  dataSaver: boolean,
  maxAgeMs = 45_000,
  now = Date.now(),
): boolean {
  const key = igpatFeedKey(userId, mode, dataSaver);
  if (!key) return false;
  const entry = feed.get(key);
  if (!entry || now < entry.storedAt) return false;
  return now - entry.storedAt < Math.min(MAX_AGE_MS, Math.max(0, maxAgeMs)) &&
    entry.rows.some(row => Boolean(row.media_url));
}

export function rememberIgpatWarmFeed<T extends IgpatWarmRow>(
  userId: string | null | undefined,
  mode: string,
  dataSaver: boolean,
  rows: T[],
  now = Date.now(),
): void {
  const key = igpatFeedKey(userId, mode, dataSaver);
  if (!key || !rows.some(row => Boolean(row.media_url))) return;
  // No persisted URLs. Do not let a failed refresh silently refresh their TTL.
  feed.delete(key);
  feed.set(key, { storedAt: now, rows: rows.map(row => ({ ...row })) });
  while (feed.size > MAX_ENTRIES) {
    const oldestKey = feed.keys().next().value;
    if (oldestKey === undefined) break;
    feed.delete(oldestKey);
  }
}

export function updateIgpatWarmFeedRow<T extends IgpatWarmRow>(
  userId: string | null | undefined,
  mode: string,
  dataSaver: boolean,
  row: T,
  now = Date.now(),
): void {
  if (!row.media_url) return;
  const key = igpatFeedKey(userId, mode, dataSaver);
  if (!key) return;
  const entry = feed.get(key);
  if (!entry || now < entry.storedAt || now - entry.storedAt >= MAX_AGE_MS) {
    feed.delete(key);
    return;
  }
  const index = entry.rows.findIndex(item => item.id === row.id && item.media_path === row.media_path);
  if (index < 0) return;
  entry.rows[index] = { ...row };
  // Keep original TTL; background signing must not extend older URLs indefinitely.
}

export function resetIgpatWarmFeedForTests(): void {
  feed.clear();
}
