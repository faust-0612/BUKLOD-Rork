/**
 * Keep asynchronous Community Wall enrichment strictly metadata-only.
 * A slow media RPC can complete after the first 650ms budget but before
 * author ranks and comment previews. A late stale row must never erase a
 * successfully hydrated photo collage.
 */
type WallPost = {
  id?: string | number | null;
  media_items?: any[] | null;
  cluster_name?: string | null;
  author_rank_name?: string | null;
  comment_preview?: unknown;
};

export function applyCommunityWallMediaHydration<T extends WallPost>(
  current: T[],
  mediaByPost: Record<string, any[]>,
): T[] {
  return current.map(post => {
    const loaded = mediaByPost[String(post.id ?? '')];
    if (!Array.isArray(loaded) || !loaded.length) return post;
    return {
      ...post,
      media_items: [...loaded].sort(
        (a, b) => Number(a?.media_position ?? 0) - Number(b?.media_position ?? 0),
      ),
    };
  });
}

export function applyCommunityWallMetadata<T extends WallPost>(
  current: T[],
  enriched: T[],
): T[] {
  const byId = new Map(
    enriched
      .filter(post => post.id != null)
      .map(post => [String(post.id), post] as const),
  );
  return current.map(post => {
    const next = byId.get(String(post.id ?? ''));
    if (!next) return post;
    // Never touch media_items/media_path/media_url or live reactions here.
    return {
      ...post,
      cluster_name: next.cluster_name ?? null,
      author_rank_name: next.author_rank_name ?? null,
      comment_preview: next.comment_preview ?? null,
    };
  });
}

/**
 * Preserve already-visible photos only while the new metadata query is
 * outstanding. Require the same durable primary path so a different post
 * image or a genuine deletion cannot resurrect an unrelated old image.
 */
export function preservePendingCommunityWallMedia<
  T extends WallPost & { media_path?: string | null }
>(current: T[], incoming: T[]): T[] {
  const oldById = new Map(current.filter(p => p.id != null).map(p => [String(p.id), p] as const));
  return incoming.map(post => {
    if (post.media_items?.length || !String(post.media_path ?? '').trim()) return post;
    const old = oldById.get(String(post.id ?? ''));
    if (
      !old?.media_items?.length ||
      String(old.media_path ?? '').trim() !== String(post.media_path ?? '').trim()
    ) return post;
    return { ...post, media_items: old.media_items };
  });
}
