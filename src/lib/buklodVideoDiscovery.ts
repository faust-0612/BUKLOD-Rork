/** Metadata-only candidate selection for the independent Community video viewer. */
export const COMMUNITY_VIDEO_DISCOVERY_PAGE_SIZE = 40;
export const COMMUNITY_VIDEO_DISCOVERY_LIMIT = 50;
export const COMMUNITY_VIDEO_MAX_SCANS_PER_REQUEST = 3;

export function selectCommunityVideoRows<T extends {
  id?: string | null;
  media_mime_type?: string | null;
}>(
  feedRows: readonly T[],
  attachedVideoPostIds: readonly string[],
): T[] {
  const attached = new Set(attachedVideoPostIds.map(String));
  return feedRows.filter(post =>
    String(post.media_mime_type ?? '').toLowerCase().startsWith('video/') ||
    attached.has(String(post.id ?? '')),
  );
}
