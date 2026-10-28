/* BUKLOD_AWS_SIGNED_MEDIA_CACHE_R2_BATCHED */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { withBuklodTimeout } from '@/lib/buklodAsyncTimeout';
import { runCommunityMediaPrefetch } from '@/lib/communityMediaPrefetch';
import { supabase } from '@/lib/supabase';

const SIGN_STORAGE_KEY = '@buklod/media-sign/v4';
// Allow a slow cellular link to finish signing; the request still has a bound.
const SIGN_TIMEOUT_MS = 12000;
const SIGN_CACHE_TTL_MS = 50 * 60 * 1000;
const NEGATIVE_CACHE_TTL_MS = 45 * 1000;
const TRANSIENT_NEGATIVE_CACHE_TTL_MS = 5 * 1000;
const SIGN_BATCH_DELAY_MS = 20;
const MAX_INDIVIDUAL_SIGNS = 3;
let activeIndividualSigns = 0;

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

  // Feed/disk URLs have no trusted mint time. Re-sign from the durable
  // Storage path instead of giving an expired credential a new cache age.
  if (preferred && isUsableDirectMediaUri(preferred)) {
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
  const waitersByPath = new Map(entries);
  const resolvePath = (path: string, url: string | null) => {
    for (const waiter of waitersByPath.get(path) ?? []) waiter.resolve(url);
  };
  const storage: any = supabase.storage.from('community-media');

  // Recover only missing items, with bounded concurrency. Avoid a Storage
  // request storm if batch signing fails during backend degradation.
  const recoverMissing = async (missing: string[]) => {
    const concurrency = Math.min(3, missing.length);
    let next = 0;
    await Promise.all(Array.from({ length: concurrency }, async () => {
      while (next < missing.length) {
        const path = missing[next++];
        try {
          // A UI timeout does not cancel Storage's request. Keep its global
          // slot until the actual operation settles; saturation fails closed.
          if (activeIndividualSigns >= MAX_INDIVIDUAL_SIGNS) {
            throw new Error('Community media signing capacity reached');
          }
          activeIndividualSigns += 1;
          const request = Promise.resolve()
            .then(() => storage.createSignedUrl(path, 3600))
            .finally(() => { activeIndividualSigns -= 1; });
          const { data, error } = await withBuklodTimeout<any>(
            request,
            SIGN_TIMEOUT_MS,
            'Community media individual sign',
          );
          if (error) throw error;
          const url = String(data?.signedUrl ?? data?.signedURL ?? '').trim();
          if (!url) throw new Error('Missing signed media URL');
          rememberSignedCommunityMediaUrl(path, url, true);
          resolvePath(path, url);
        } catch (error) {
          // A weak-signal timeout is not a missing file. Cool down briefly;
          // preserve the longer negative cache for absent/forbidden objects.
          const detail = String((error as any)?.code ?? '') + ' ' + String((error as any)?.message ?? error ?? '');
          const permanent = /NoSuchKey|not found|404|401|403|forbidden|unauthorized|row.level.security/i.test(detail);
          negativeCache.set(path, Date.now() + (permanent ? NEGATIVE_CACHE_TTL_MS : TRANSIENT_NEGATIVE_CACHE_TTL_MS));
          resolvePath(path, null);
        }
      }
    }));
  };

  try {
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
    const missing: string[] = [];
    for (const path of paths) {
      const url = byPath.get(path);
      if (url) {
        rememberSignedCommunityMediaUrl(path, url, true);
        resolvePath(path, url);
      } else {
        missing.push(path);
      }
    }
    await recoverMissing(missing);
  } catch {
    await recoverMissing(paths);
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
  const path = String(mediaPath ?? '').trim();
  const preferred = String(preferredUri ?? '').trim();
  // A usable URL must not wait for disk cache hydration on weak devices.
  // Preserve AWS short-lived URL handling and existing authorization rules.
  if (isAwsExternalMediaPath(path)) return preferred || null;

  const immediate = peekCommunityMediaUrl(path, preferred);
  if (immediate) return immediate;
  if (!path) return null;

  await hydrateCommunityMediaUrlCache();
  // Hydration may have restored a still-valid signed URL from disk.
  const hydrated = peekCommunityMediaUrl(path, preferred);
  if (hydrated) return hydrated;

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
  urls: Array<
    | string
    | null
    | undefined
    | { uri: string; cacheKey?: string }
  >,
) {
  void runCommunityMediaPrefetch(urls).catch(() => undefined);
}

void hydrateCommunityMediaUrlCache();
