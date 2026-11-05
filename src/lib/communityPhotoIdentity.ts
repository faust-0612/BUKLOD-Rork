/**
 * Stable photo identity for Community Wall collage/viewer collections.
 * Signed Storage URL query tokens rotate, so compare the underlying object path.
 */
export type CommunityPhotoIdentityItem = {
  media_path?: string | null;
  media_url?: string | null;
  preview_path?: string | null;
  storage_provider?: string | null;
  external_object_key?: string | null;
};

function normalizeObjectReference(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  let path = raw.split(/[?#]/, 1)[0] ?? '';
  try {
    path = new URL(raw, 'https://buklod.invalid').pathname;
  } catch {
    // Raw Storage object keys are valid references too.
  }
  try { path = decodeURIComponent(path); } catch {
    // Preserve malformed encoded paths rather than losing identity.
  }
  path = path.replace(/^\/?storage\/v1\/object\/(?:sign|public|authenticated)\/[^/]+\//i, '');
  return path.replace(/^\/+/, '').replace(/\/{2,}/g, '/').trim();
}

function identityKeys(item: CommunityPhotoIdentityItem): string[] {
  const keys = new Set<string>();
  const path = normalizeObjectReference(item.media_path);
  const urlPath = normalizeObjectReference(item.media_url);
  const preview = normalizeObjectReference(item.preview_path);
  const provider = String(item.storage_provider ?? 'SUPABASE').trim().toUpperCase();
  const externalKey = String(item.external_object_key ?? '').trim();
  if (path) keys.add(`asset:${path}`);
  if (urlPath) keys.add(`asset:${urlPath}`);
  if (preview) keys.add(`preview:${preview}`);
  if (externalKey) keys.add(`external:${provider}:${externalKey}`);
  return [...keys];
}

export function dedupeCommunityPhotoItems<T extends CommunityPhotoIdentityItem>(items: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const keys = identityKeys(item);
    if (!keys.length || keys.some(key => seen.has(key))) continue;
    keys.forEach(key => seen.add(key));
    result.push(item);
  }
  return result;
}
