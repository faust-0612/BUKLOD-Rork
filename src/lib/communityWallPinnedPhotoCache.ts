/**
 * Account-scoped, offline-first ORIGINAL Community Wall photo pinning.
 *
 * Expo Image's memory/disk cache is an eviction cache, not offline storage.
 * Once an authenticated Wall tile has decoded the authorized original, copy
 * the already-downloaded cache file into this app's private documents folder.
 * No second network download, public Storage URL, or new native dependency.
 *
 * Only an authenticated feed row with a canonical media path may request the
 * corresponding account's pinned file. A signed URL is NEVER persisted here.
 */
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import { Image as ExpoImage } from 'expo-image';

const ROOT = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}buklod-wall-originals/v1/`
  : '';
const MAX_ACCOUNT_BYTES = 160 * 1024 * 1024;
const MAX_ACCOUNT_FILES = 240;
const MAX_SINGLE_PHOTO_BYTES = 20 * 1024 * 1024;
const RETAIN_MS = 45 * 24 * 60 * 60 * 1000;
const TRIM_COOLDOWN_MS = 60 * 1000;

const warm = new Map<string, string>();
const invalidCache = new Set<string>();
const loading = new Map<string, Promise<string | null>>();
const pinning = new Map<string, Promise<void>>();
const trimming = new Map<string, Promise<void>>();
const lastTrim = new Map<string, number>();

const scopedKey = (owner: string, path: string) => `${owner}\n${path}`;
const asFileUri = (path: string) => /^(file|content):\/\//i.test(path) ? path : `file://${path}`;
const localFile = (path: string) => /^(file|content):\/\//i.test(path);
const ownerDirectory = (owner: string) =>
  `${ROOT}${owner.replace(/[^a-zA-Z0-9_-]/g, '_')}/`;
const photoExtension = (path: string) =>
  (path.match(/\.(jpe?g|png|webp|heic|avif|gif)(?:$|[?#])/i)?.[1] ?? 'jpg')
    .toLowerCase().replace(/^jpeg$/, 'jpg');

async function targetFor(owner: string, mediaPath: string) {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    scopedKey(owner, mediaPath),
  );
  return `${ownerDirectory(owner)}${digest}.${photoExtension(mediaPath)}`;
}
async function validFile(uri: string) {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists && !info.isDirectory && Number(info.size ?? 0) > 0;
  } catch {
    return false;
  }
}
async function expoCachedFile(cacheKey: string): Promise<string | null> {
  if (!cacheKey) return null;
  try {
    const file = await ExpoImage.getCachePathAsync(cacheKey);
    return file ? asFileUri(file) : null;
  } catch {
    return null;
  }
}

/** Synchronous hot-path: no file-system work on Wall remounts. */
export function peekPinnedCommunityWallPhoto(owner: string | null, mediaPath: string) {
  if (!ROOT || !owner || !mediaPath) return null;
  return warm.get(scopedKey(owner, mediaPath)) ?? null;
}

/**
 * Check the private, account-owned document before touching a signed URL.
 * Fall back to Expo's already-cached original (not its low-quality sidecar).
 * Missing photos never trigger a download from this function.
 */
export async function loadCachedCommunityWallPhoto(input: {
  owner: string | null;
  mediaPath: string;
  cacheKey: string | undefined;
}): Promise<string | null> {
  const { owner, mediaPath, cacheKey } = input;
  if (!ROOT || !owner || !mediaPath) return null;
  const key = scopedKey(owner, mediaPath);
  const hit = warm.get(key);
  if (hit) return hit;
  const active = loading.get(key);
  if (active) return active;
  const task = (async () => {
    const destination = await targetFor(owner, mediaPath);
    if (await validFile(destination)) {
      warm.set(key, destination);
      return destination;
    }
    if (!cacheKey || invalidCache.has(key)) return null;
    const expoFile = await expoCachedFile(cacheKey);
    return expoFile && await validFile(expoFile) ? expoFile : null;
  })().catch(() => null).finally(() => {
    loading.delete(key);
  });
  loading.set(key, task);
  return task;
}

async function trimAccount(owner: string) {
  const now = Date.now();
  if (!ROOT || trimming.has(owner) || now - (lastTrim.get(owner) ?? 0) < TRIM_COOLDOWN_MS) return;
  lastTrim.set(owner, now);
  const task = (async () => {
    const directory = ownerDirectory(owner);
    const names = await FileSystem.readDirectoryAsync(directory).catch(() => []);
    const files: { uri: string; size: number; age: number }[] = [];
    // Small, bounded batches avoid an I/O storm after restoring connectivity.
    for (let i = 0; i < names.length; i += 8) {
      const part = await Promise.all(names.slice(i, i + 8).map(async name => {
        const uri = directory + name;
        const stat = await FileSystem.getInfoAsync(uri).catch(() => null);
        return stat?.exists && !stat.isDirectory
          ? { uri, size: Number(stat.size ?? 0), age: Number(stat.modificationTime ?? 0) * 1000 }
          : null;
      }));
      for (const entry of part) if (entry) files.push(entry);
    }
    files.sort((a, b) => a.age - b.age);
    let bytes = files.reduce((sum, entry) => sum + entry.size, 0);
    let count = files.length;
    for (const file of files) {
      if (count <= MAX_ACCOUNT_FILES && bytes <= MAX_ACCOUNT_BYTES &&
          (file.age <= 0 || now - file.age <= RETAIN_MS)) continue;
      await FileSystem.deleteAsync(file.uri, { idempotent: true }).catch(() => undefined);
      bytes -= file.size;
      count -= 1;
      for (const [key, uri] of warm) {
        if (uri === file.uri) warm.delete(key);
      }
    }
  })().catch(() => undefined).finally(() => trimming.delete(owner));
  trimming.set(owner, task);
  await task;
}

/**
 * Pin only bytes that a real image view already loaded. Expo Image's cache is
 * the source for remote URLs, so saving offline never re-fetches a photo.
 * Repeated completion callbacks and duplicate feed cells share one copy.
 */
export async function pinLoadedCommunityWallPhoto(input: {
  owner: string | null;
  mediaPath: string;
  cacheKey: string | undefined;
  displayedUri: string;
}): Promise<void> {
  const { owner, mediaPath, cacheKey, displayedUri } = input;
  if (!ROOT || !owner || !mediaPath) return;
  const key = scopedKey(owner, mediaPath);
  if (warm.has(key)) return;
  const active = pinning.get(key);
  if (active) return active;
  const task = (async () => {
    const destination = await targetFor(owner, mediaPath);
    if (await validFile(destination)) {
      warm.set(key, destination);
      return;
    }
    // A direct local view can be copied immediately. A remotely loaded Expo
    // image needs the native disk cache to finish writing first.
    let existing = localFile(displayedUri) ? displayedUri : null;
    if (!existing) {
      for (const delay of [0, 180, 600]) {
        if (delay) await new Promise<void>(resolve => setTimeout(resolve, delay));
        existing = await expoCachedFile(cacheKey ?? '');
        if (existing && await validFile(existing)) break;
        existing = null;
      }
    }
    if (!existing || !await validFile(existing)) return;
    if (existing === destination) {
      warm.set(key, destination);
      return;
    }
    const size = Number((await FileSystem.getInfoAsync(existing)).size ?? 0);
    if (!size || size > MAX_SINGLE_PHOTO_BYTES) return;
    const dir = ownerDirectory(owner);
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    const temporary = `${destination}.${Crypto.randomUUID()}.part`;
    try {
      await FileSystem.copyAsync({ from: existing, to: temporary });
      if (!await validFile(temporary)) return;
      if (!await validFile(destination)) {
        await FileSystem.moveAsync({ from: temporary, to: destination });
      }
      if (await validFile(destination)) {
        warm.set(key, destination);
        invalidCache.delete(key);
        void trimAccount(owner);
      }
    } finally {
      await FileSystem.deleteAsync(temporary, { idempotent: true }).catch(() => undefined);
    }
  })().catch(() => undefined).finally(() => pinning.delete(key));
  pinning.set(key, task);
  await task;
}

/** A failed local decode must never trap the tile on a corrupt offline file. */
export async function invalidateCachedCommunityWallPhoto(
  owner: string | null,
  mediaPath: string,
): Promise<void> {
  if (!ROOT || !owner || !mediaPath) return;
  const key = scopedKey(owner, mediaPath);
  warm.delete(key);
  invalidCache.add(key);
  const destination = await targetFor(owner, mediaPath).catch(() => null);
  if (destination) await FileSystem.deleteAsync(destination, { idempotent: true }).catch(() => undefined);
}
