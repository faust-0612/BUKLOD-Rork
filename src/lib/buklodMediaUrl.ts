/* BUKLOD_AWS_SIGNED_MEDIA_CACHE_R1 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image as ExpoImage } from 'expo-image';

import { withBuklodTimeout } from '@/lib/buklodAsyncTimeout';
import { supabase } from '@/lib/supabase';

const SIGN_STORAGE_KEY = '@buklod/media-sign/v2';
const SIGN_TIMEOUT_MS = 4000;

type SignedHit = {
  url: string;
  at: number;
};

const signedCache = new Map<string, SignedHit>();
const inFlight = new Map<string, Promise<string | null>>();

let hydratePromise: Promise<void> | null = null;
let hydrateCompleted = false;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function isAwsExternalMediaPath(path?: string | null) {
  return String(path ?? '').trim().toLowerCase().startsWith('aws:');
}

export function isLocalMediaUri(uri: string) {
  return /^(file|content|data|blob|ph|assets-library):/i.test(
    String(uri ?? '').trim(),
  );
}

export function isSignedStorageUri(uri: string) {
  const value = String(uri ?? '').trim();
  if (!value) return false;

  return (
    value.includes('/storage/v1/object/sign/') ||
    /[?&]token=/.test(value) ||
    /[?&]X-Amz-(?:Algorithm|Signature|Credential)=/i.test(value)
  );
}

export function isUsableDirectMediaUri(uri: string) {
  const value = String(uri ?? '').trim();
  if (!value) return false;

  if (isLocalMediaUri(value)) return true;
  if (isSignedStorageUri(value)) return false;
  return /^https?:\/\//i.test(value);
}

export function communityMediaCacheKey(
  mediaPath?: string | null,
  uri?: string | null,
) {
  const path = String(mediaPath ?? '').trim();
  if (path) return `community-media:${path}`;

  const value = String(uri ?? '').trim();
  return value || undefined;
}

function schedulePersist() {
  if (persistTimer) clearTimeout(persistTimer);

  persistTimer = setTimeout(() => {
    const payload: Record<string, SignedHit> = {};
    for (const [path, hit] of signedCache) {
      if (path && hit?.url && !isAwsExternalMediaPath(path)) {
        payload[path] = hit;
      }
    }

    void AsyncStorage.setItem(
      SIGN_STORAGE_KEY,
      JSON.stringify(payload),
    ).catch(() => undefined);
  }, 350);
}

export function rememberSignedCommunityMediaUrl(
  mediaPath: string,
  url: string,
  force = false,
) {
  const path = String(mediaPath ?? '').trim();
  const signed = String(url ?? '').trim();
  if (!path || !signed || isAwsExternalMediaPath(path)) return;

  const existing = signedCache.get(path);
  if (!force && existing?.url) return;
  if (existing?.url === signed) return;

  signedCache.set(path, {
    url: signed,
    at: Date.now(),
  });
  schedulePersist();
}

export function peekCommunityMediaUrl(
  mediaPath?: string | null,
  preferredUri?: string | null,
) {
  const path = String(mediaPath ?? '').trim();
  const preferred = String(preferredUri ?? '').trim();

  /* AWS view URLs expire after a few minutes. Never let a disk/in-memory
   * Supabase signing cache override the fresh URL returned by the secure
   * AWS media API. */
  if (isAwsExternalMediaPath(path)) {
    return preferred || null;
  }

  if (path) {
    const hit = signedCache.get(path);
    if (hit?.url) return hit.url;
  }

  if (preferred) {
    if (path && hydrateCompleted) {
      rememberSignedCommunityMediaUrl(path, preferred);
    }
    return preferred;
  }

  return null;
}

export async function hydrateCommunityMediaUrlCache() {
  if (hydratePromise) return hydratePromise;

  hydratePromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(SIGN_STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as Record<string, SignedHit>;
      for (const [path, hit] of Object.entries(parsed ?? {})) {
        if (
          !path ||
          !hit?.url ||
          signedCache.has(path) ||
          isAwsExternalMediaPath(path)
        ) {
          continue;
        }

        signedCache.set(path, {
          url: String(hit.url),
          at: Number(hit.at) || 0,
        });
      }
    } catch {
      // Cache is optional.
    } finally {
      hydrateCompleted = true;
    }
  })();

  return hydratePromise;
}

export async function resolveCommunityMediaUrl(
  mediaPath?: string | null,
  preferredUri?: string | null,
): Promise<string | null> {
  await hydrateCommunityMediaUrlCache();

  const path = String(mediaPath ?? '').trim();
  const preferred = String(preferredUri ?? '').trim();
  if (isAwsExternalMediaPath(path)) {
    return preferred || null;
  }

  const peeked = peekCommunityMediaUrl(path, preferred);
  if (peeked) return peeked;
  if (!path) return null;

  const pending = inFlight.get(path);
  if (pending) return pending;

  const task = (async () => {
    try {
      const { data, error } = await withBuklodTimeout(
        supabase.storage
          .from('community-media')
          .createSignedUrl(path, 3600),
        SIGN_TIMEOUT_MS,
        'Community photo',
      );

      const signed = !error
        ? String(data?.signedUrl ?? '').trim()
        : '';

      if (signed) {
        rememberSignedCommunityMediaUrl(path, signed);
        return signed;
      }
    } catch {
      // Keep last known URL so disk-cached photos can still render.
    }

    return peekCommunityMediaUrl(path, preferred);
  })();

  inFlight.set(path, task);

  try {
    return await task;
  } finally {
    inFlight.delete(path);
  }
}

export async function resignCommunityMediaUrl(
  mediaPath?: string | null,
): Promise<string | null> {
  const path = String(mediaPath ?? '').trim();
  if (!path || isAwsExternalMediaPath(path)) return null;

  signedCache.delete(path);
  inFlight.delete(path);
  return resolveCommunityMediaUrl(path, null);
}

export function prefetchCommunityMedia(
  urls: Array<string | null | undefined>,
) {
  for (const url of urls) {
    const value = String(url ?? '').trim();
    if (!value || isLocalMediaUri(value)) continue;

    void ExpoImage.prefetch(value).catch(() => undefined);
  }
}

void hydrateCommunityMediaUrlCache();
