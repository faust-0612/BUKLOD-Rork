/** Bounded keyset pagination for the independent Community video viewer. */
export const COMMUNITY_VIDEO_DISCOVERY_PAGE_SIZE = 15;
export const COMMUNITY_VIDEO_DISCOVERY_LIMIT = 50;
export const COMMUNITY_VIDEO_MAX_SCANS_PER_REQUEST = 3;

export type CommunityVideoCursor = { created_at: string; id: string };

export function lastCommunityVideoCursor<T extends {
  id: string;
  created_at: string;
}>(
  rows: readonly T[],
): CommunityVideoCursor | null {
  const last = rows[rows.length - 1];
  return last ? { created_at: last.created_at, id: last.id } : null;
}

export function appendUniqueCommunityVideos<T extends { id: string }>(
  current: readonly T[],
  additional: readonly T[],
  limit = COMMUNITY_VIDEO_DISCOVERY_LIMIT,
): T[] {
  const seen = new Set(current.map(post => String(post.id)));
  const unique = additional.filter(post => {
    const id = String(post.id);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  return [...current, ...unique].slice(0, limit);
}

/**
 * Fair exposure for the public fullscreen video viewer.
 *
 * This is ONLY a presentation pass over a permission-checked metadata page.
 * It does not claim equal play counts or record impressions. Existing entries
 * never move while someone is watching; keyset pagination is left untouched.
 * New creators/low-engagement videos receive discovery slots, with a short
 * author cooldown and a reproducible per-viewer/per-session rotation.
 */
export type CommunityFairVideoCandidate = {
  id: string;
  user_id?: string | null;
  created_at?: string | null;
  total_reactions?: number | null;
  comment_count?: number | null;
};

type CommunityFairVideoLane = 'fresh' | 'underexposed' | 'discovery';
const VIDEO_FAIR_LANES: readonly CommunityFairVideoLane[] = [
  'fresh', 'underexposed', 'discovery', 'underexposed', 'fresh',
  'discovery', 'underexposed', 'discovery', 'fresh', 'discovery',
];
const VIDEO_FRESH_WINDOW_MS = 72 * 60 * 60 * 1000;
const VIDEO_AUTHOR_COOLDOWN = 3;
const VIDEO_ROTATION_POOL = 4;

function safeVideoEngagement(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
}

function isFreshFairVideo(post: CommunityFairVideoCandidate, nowMs: number): boolean {
  const publishedAt = Date.parse(String(post.created_at ?? ''));
  return Number.isFinite(publishedAt) &&
    publishedAt <= nowMs &&
    (nowMs - publishedAt) <= VIDEO_FRESH_WINDOW_MS;
}

function videoFairLaneMatch(
  post: CommunityFairVideoCandidate,
  lane: CommunityFairVideoLane,
  nowMs: number,
): boolean {
  if (lane === 'fresh') return isFreshFairVideo(post, nowMs);
  if (lane === 'underexposed') {
    // Engagement is an availability-safe proxy, NOT an actual view counter.
    return safeVideoEngagement(post.total_reactions) +
      safeVideoEngagement(post.comment_count) <= 2;
  }
  return true;
}

function videoFairRotation(seed: string, slot: number): number {
  const value = seed + ':' + String(slot);
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash * 33) ^ value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function arrangeCommunityVideosForFairExposure<T extends CommunityFairVideoCandidate>(
  existing: readonly T[],
  incoming: readonly T[],
  sessionSeed: string,
  nowMs: number = Date.now(),
): T[] {
  if (incoming.length === 0) return [];

  // The caller can append these rows without moving the already-visible video.
  const seen = new Set(existing.map(post => String(post.id)));
  const remaining = incoming.filter(post => {
    const id = String(post.id);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  const result: T[] = [];

  while (remaining.length > 0) {
    const slot = result.length;
    const lane = VIDEO_FAIR_LANES[slot % VIDEO_FAIR_LANES.length];
    const recentlyPresented = [...existing, ...result].slice(-VIDEO_AUTHOR_COOLDOWN);
    const recentAuthors = new Set(
      recentlyPresented.map(post => String(post.user_id ?? '').trim()).filter(Boolean),
    );
    const authorIsNew = (post: T) => {
      const author = String(post.user_id ?? '').trim();
      return !author || !recentAuthors.has(author);
    };
    const eligible = remaining.filter(post =>
      authorIsNew(post) && videoFairLaneMatch(post, lane, nowMs),
    );
    const diverse = remaining.filter(authorIsNew);
    const fallbackByLane = remaining.filter(post =>
      videoFairLaneMatch(post, lane, nowMs),
    );
    // Prioritize real creator variety over a strict lane if the two conflict.
    const pool = eligible.length ? eligible :
      diverse.length ? diverse :
      fallbackByLane.length ? fallbackByLane : remaining;
    // Rotate within a small, server-chronological window; avoid a costly
    // personalized RPC, offscreen media downloads or a purely random feed.
    const choices = Math.min(VIDEO_ROTATION_POOL, pool.length);
    const chosen = pool[videoFairRotation(sessionSeed, slot) % choices];
    const index = remaining.indexOf(chosen);
    result.push(remaining.splice(index, 1)[0]);
  }

  return result;
}
