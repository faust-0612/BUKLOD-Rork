/* BUKLOD_AWS_SIGNED_MEDIA_CACHE_R2_BATCHED */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image as ExpoImage } from 'expo-image';

import { withBuklodTimeout } from '@/lib/buklodAsyncTimeout';
import { supabase } from '@/lib/supabase';

const SIGN_STORAGE_KEY = '@buklod/media-sign/v3';
const SIGN_TIMEOUT_MS = 6000;
const SIGN_CACHE_TTL_MS = 50 * 60 * 1000;
const NEGATIVE_CACHE_TTL_MS = 45 * 1000;
const SIGN_BATCH_DELAY_MS = 20;
const PREFETCH_BURST_LIMIT = 12;

type SignedHit = {
  url: string;
  at: number;
};

type SignWaiter = {
  resolve: (url: string | null) => void;
};

const signedCache = new Map<string, SignedHit>();
const negativeCache = new Map<string, number>();
const inFlight = new Map<string, Promise<string | null>>();
const signQueue = new Map<string, SignWaiter[]>();

let hydratePromise: Promise<void> | null = null;
let hydrateCompleted = false;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let signBatchTimer: ReturnType<typeof setTimeout> | null = null;

function isAwsExternalMediaPath(path?: string | null) {
  return String(path ?? '').trim().toLowerCase().startsWith('aws:');
}

function isFresh(hit?: SignedHit | null) {
  return Boolean(
    hit?.url &&
      Number(hit.at ?? 0) > 0 &&
      Date.now() - Number(hit.at) < SIGN_CACHE_TTL_MS,
  );
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
      if (
        path &&
        isFresh(hit) &&
        !isAwsExternalMediaPath(path)
      ) {
        payload[path] = hit;
      }
    }

    void AsyncStorage.setItem(
      SIGN_STORAGE_KEY,
      JSON.stringify(payload),
    ).catch(() => undefined);
  }, 500);
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
  if (!force && isFresh(existing)) return;
  if (existing?.url === signed && isFresh(existing)) return;

  signedCache.set(path, {
    url: signed,
    at: Date.now(),
  });
  negativeCache.delete(path);
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
    if (isFresh(hit)) return hit!.url;
    if (hit) signedCache.delete(path);
  }

  if (preferred) {
    if (path && hydrateCompleted) {
      rememberSignedCommunityMediaUrl(path, preferred, true);
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
          !isFresh(hit) ||
          signedCache.has(path) ||
          isAwsExternalMediaPath(path)
        ) {
          continue;
        }

        signedCache.set(path, {
          url: String(hit.url),
          at: Number(hit.at) || Date.now(),
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

async function flushCommunityMediaSignBatch() {
  signBatchTimer = null;
  const entries = [...signQueue.entries()];
  signQueue.clear();
  if (!entries.length) return;

  const paths = entries.map(([path]) => path);
  const resolvePath = (path: string, url: string | null) => {
    const waiters = entries.find(([candidate]) => candidate === path)?.[1] ?? [];
    for (const waiter of waiters) waiter.resolve(url);
  };

  try {
    const storage: any = supabase.storage.from('community-media');
    const { data, error } = await withBuklodTimeout<any>(
      storage.createSignedUrls(paths, 3600),
      SIGN_TIMEOUT_MS,
      'Community media batch',
    );

    if (error) throw error;

    const byPath = new Map<string, string>();
    for (const row of Array.isArray(data) ? data : []) {
      const path = String(row?.path ?? '').trim();
      const url = String(row?.signedUrl ?? row?.signedURL ?? '').trim();
      if (path && url) byPath.set(path, url);
    }

    for (const path of paths) {
      const url = byPath.get(path) ?? '';
      if (url) {
        rememberSignedCommunityMediaUrl(path, url, true);
        resolvePath(path, url);
      } else {
        negativeCache.set(path, Date.now() + NEGATIVE_CACHE_TTL_MS);
        resolvePath(path, null);
      }
    }
  } catch {
    const until = Date.now() + NEGATIVE_CACHE_TTL_MS;
    for (const path of paths) {
      negativeCache.set(path, until);
      resolvePath(path, null);
    }
  }
}

function queueCommunityMediaSign(path: string) {
  const blockedUntil = Number(negativeCache.get(path) ?? 0);
  if (blockedUntil > Date.now()) {
    return Promise.resolve<string | null>(null);
  }
  if (blockedUntil) negativeCache.delete(path);

  return new Promise<string | null>(resolve => {
    const waiters = signQueue.get(path) ?? [];
    waiters.push({ resolve });
    signQueue.set(path, waiters);

    if (!signBatchTimer) {
      signBatchTimer = setTimeout(() => {
        void flushCommunityMediaSignBatch();
      }, SIGN_BATCH_DELAY_MS);
    }
  });
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

  const task = queueCommunityMediaSign(path);
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
  negativeCache.delete(path);
  inFlight.delete(path);
  return resolveCommunityMediaUrl(path, null);
}

export function prefetchCommunityMedia(
  urls: Array<string | null | undefined>,
) {
  const unique = [
    ...new Set(
      urls
        .map(url => String(url ?? '').trim())
        .filter(value => value && !isLocalMediaUri(value)),
    ),
  ].slice(0, PREFETCH_BURST_LIMIT);

  for (const value of unique) {
    void ExpoImage.prefetch(value).catch(() => undefined);
  }
}

void hydrateCommunityMediaUrlCache();
