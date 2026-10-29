/**
 * Community Wall private preview sidecar v1.
 *
 * The presence bit is encoded in new original filenames ONLY AFTER their
 * actual sidecar upload succeeds. This avoids schema/RPC changes and stops
 * all legacy photos from probing a non-existent preview (404 flood).
 *
 * The author-owned path stays inside the existing private bucket; viewers
 * still require normal signed media URL authorization. Original files remain
 * unchanged and are used by the fullscreen viewer.
 */
export function communityWallPreviewOriginalPath(path: string): string | null {
  const value = String(path ?? '').trim();
  if (!/\/post-[^/]+\.jpg$/i.test(value) || /-p1(?:-preview)?\.jpg$/i.test(value)) return null;
  return value.replace(/\.jpg$/i, '-p1.jpg');
}

export function communityWallPreviewPath(originalPath: string | null | undefined): string | null {
  const path = String(originalPath ?? '').trim();
  // Only our explicitly marker-tagged, successfully paired uploads.
  if (!/\/post-[^/]+-p1\.jpg$/i.test(path)) return null;
  return path.replace(/-p1\.jpg$/i, '-p1-preview.jpg');
}

/** Only accept a backfilled thumbnail when the server's indexed path
 * matches this original exactly. Never probe thumbnails for unindexed posts.
 */
export function verifiedLegacyWallPreviewPath(
  originalPath: string | null | undefined,
  indexedPreviewPath: string | null | undefined,
): string | null {
  const original = String(originalPath ?? '').trim();
  const indexed = String(indexedPreviewPath ?? '').trim();
  if (!/^[^?#]+\/[^/]+\.jpg$/i.test(original) || /-(?:p1|p1-preview|legacy-preview)\.jpg$/i.test(original)) return null;
  const expected = original.replace(/\.jpg$/i, '-legacy-preview.jpg');
  return indexed === expected ? indexed : null;
}
