/**
 * Bounded in-memory cache for Community video first-frame posters.
 * Posters are generated only from a player already mounted for visible playback.
 */
const COMMUNITY_VIDEO_POSTER_CACHE_LIMIT = 18;
type PosterListener = (poster: unknown) => void;
const posters = new Map<string, unknown>();
const listeners = new Map<string, Set<PosterListener>>();
const generating = new Set<string>();
const keyFor = (uri: string) => {
  const value = String(uri ?? '').trim();
  // Supabase signed URLs rotate query tokens while the durable object path stays stable.
  return /^https?:\/\//i.test(value) ? value.replace(/[?#].*$/, '') : value;
};

export function getCommunityVideoPoster(uri: string): unknown | null {
  const key = keyFor(uri);
  if (!key) return null;
  const poster = posters.get(key);
  if (poster === undefined) return null;
  posters.delete(key);
  posters.set(key, poster);
  return poster;
}

export function beginCommunityVideoPosterGeneration(uri: string): boolean {
  const key = keyFor(uri);
  if (!key || posters.has(key) || generating.has(key)) return false;
  generating.add(key);
  return true;
}

export function releaseCommunityVideoPosterGeneration(uri: string): void {
  const key = keyFor(uri);
  if (key) generating.delete(key);
}

export function publishCommunityVideoPoster(uri: string, poster: unknown): void {
  const key = keyFor(uri);
  if (!key || !poster) return;
  posters.delete(key);
  posters.set(key, poster);
  while (posters.size > COMMUNITY_VIDEO_POSTER_CACHE_LIMIT) {
    const oldest = posters.keys().next().value as string | undefined;
    if (!oldest) break;
    posters.delete(oldest);
  }
  listeners.get(key)?.forEach(listener => listener(poster));
}

export function subscribeCommunityVideoPoster(uri: string, listener: PosterListener): () => void {
  const key = keyFor(uri);
  if (!key) return () => undefined;
  const bucket = listeners.get(key) ?? new Set<PosterListener>();
  bucket.add(listener);
  listeners.set(key, bucket);
  return () => {
    bucket.delete(listener);
    if (!bucket.size) listeners.delete(key);
  };
}

/** Test-only reset; never called by application code. */
export function __resetCommunityVideoPosterCacheForTests(): void {
  posters.clear();
  listeners.clear();
  generating.clear();
}
