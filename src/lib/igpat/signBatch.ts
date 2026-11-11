/**
 * Private IGPAT URL signing with one background Storage batch.
 * The first visible clip and the immediate next clip are signed separately
 * by the screen; only later rows are handled here. Never persist signed URLs.
 */
export type IgpatSignableRow = {
  id: string;
  media_path: string;
  media_url?: string | null;
};

type BatchSignResult = {
  data?: Array<{
    path?: string | null;
    signedUrl?: string | null;
    signedURL?: string | null;
    error?: unknown;
  }> | null;
  error?: unknown;
};

export async function signIgpatRowsInBatch<T extends IgpatSignableRow>(
  rows: T[],
  signBatch: (paths: string[]) => Promise<BatchSignResult>,
  signOne: (row: T) => Promise<T>,
  isCurrent: () => boolean,
  onPartial?: (rows: T[]) => void,
): Promise<T[]> {
  if (!rows.length || !isCurrent()) return [];
  const paths = [...new Set(rows.map(row => row.media_path).filter(Boolean))];
  const allowedPaths = new Set(paths);
  const signedUrls = new Map<string, string>();

  try {
    const result = await signBatch(paths);
    if (result?.error) throw result.error;
    for (const entry of result?.data ?? []) {
      const path = String(entry?.path ?? '');
      const url = String(entry?.signedUrl ?? entry?.signedURL ?? '');
      if (!entry?.error && allowedPaths.has(path) && url) {
        signedUrls.set(path, url);
      }
    }
  } catch {
    // Recover only missing paths below. Never expose private URLs in logs.
  }

  // Do not start more signing work after navigation, logout or feed change.
  if (!isCurrent()) return [];
  const representativeByPath = new Map(rows.map(row => [row.media_path, row]));
  const missing = paths.filter(path => !signedUrls.has(path))
    .map(path => representativeByPath.get(path)!);

  // A single inaccessible object must not hold already authorized videos
  // hostage while its individual fallback waits on a weak connection.
  if (missing.length && signedUrls.size && onPartial && isCurrent()) {
    onPartial(rows.filter(row => signedUrls.has(row.media_path)).map(row => ({
      ...row,
      media_url: signedUrls.get(row.media_path)!,
    })));
  }
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(2, missing.length) }, async () => {
    while (isCurrent() && cursor < missing.length) {
      const row = missing[cursor++];
      try {
        const signed = await signOne(row);
        if (signed.media_path === row.media_path && signed.media_url) {
          signedUrls.set(row.media_path, signed.media_url);
        }
      } catch {
        // A row that cannot be signed is marked unavailable, not left spinning.
      }
    }
  }));

  if (!isCurrent()) return [];
  return rows.map(row => ({
    ...row,
    media_url: signedUrls.get(row.media_path) ?? null,
  }));
}
