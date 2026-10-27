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
