/**
 * BUKLOD Universal Device Cache — native-first, OTA-safe.
 *
 * One shared persistent cache for eligible HTTP media (images/videos/audio).
 * The caller MUST supply a stable content/version ID, never a signed URL:
 * signed URLs rotate and must not trigger repeat downloads.
 * Never cache live streams, DRM, private/revoked media or credentials.
 * This helper does not automatically wire every renderer.
 */
import { File, Directory, Paths } from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const ROOT = new Directory(Paths.document, 'buklod-media-v1');
const INDEX_KEY = '@buklod/media-index/v1';
const MAX_BYTES = 350 * 1024 * 1024;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
type Entry = { key: string; file: string; bytes: number; accessedAt: number; expiresAt: number };
let queue: Promise<unknown> = Promise.resolve();
const inflight = new Map<string, Promise<string>>();

function serial<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(fn, fn);
  queue = next.then(() => undefined, () => undefined);
  return next;
}
async function index(): Promise<Entry[]> {
  try {
    const rows: unknown = JSON.parse((await AsyncStorage.getItem(INDEX_KEY)) || '[]');
    return Array.isArray(rows) ? rows.filter((e): e is Entry =>
      !!e && typeof e.key === 'string' && typeof e.file === 'string' &&
      typeof e.bytes === 'number' && typeof e.accessedAt === 'number' &&
      typeof e.expiresAt === 'number') : [];
  } catch { return []; }
}
function ensureRoot() { if (!ROOT.exists) ROOT.create({ intermediates: true, idempotent: true }); }
function safeFile(id: string, version: string, extension: string) {
  // Stable hash-like filename from caller-supplied opaque ID. Do not use URLs.
  const value = id + ':' + version;
  let a = 2166136261;
  let b = 5381;
  for (let i = 0; i < value.length; i++) {
    a = Math.imul(a ^ value.charCodeAt(i), 16777619);
    b = Math.imul(b, 33) ^ value.charCodeAt(i);
  }
  return (a >>> 0).toString(16).padStart(8, '0') +
    (b >>> 0).toString(16).padStart(8, '0') + '.' + extension;
}
function eligible(url: string, ext: string) {
  return /^https:\/\//i.test(url) && /^(jpg|jpeg|png|webp|mp4|m4v|mp3|m4a)$/i.test(ext);
}
export async function resolveBuklodCachedMedia(args: {
  url: string;
  contentId: string;
  version: string;
  extension: 'jpg' | 'jpeg' | 'png' | 'webp' | 'mp4' | 'm4v' | 'mp3' | 'm4a';
  publicOrOfflineAuthorized: boolean;
  online: boolean;
  expiresAt?: number;
}): Promise<string> {
  if (Platform.OS === 'web' || !args.publicOrOfflineAuthorized ||
      !args.contentId || !args.version || !eligible(args.url, args.extension)) {
    return args.url;
  }
  const key = args.contentId + ':' + args.version;
  const fileName = safeFile(args.contentId, args.version, args.extension);
  const target = new File(ROOT, fileName);
  const existing = await serial(async () => {
    const rows = await index();
    const hit = rows.find(e => e.key === key && e.file === fileName &&
      e.expiresAt > Date.now() && target.exists);
    if (!hit) return null;
    hit.accessedAt = Date.now();
    await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(rows));
    return target.uri;
  });
  if (existing) return existing;
  if (!args.online) return args.url;
  const running = inflight.get(key);
  if (running) return running;
  const job = (async () => {
    try {
      ensureRoot();
      const downloaded = await File.downloadFileAsync(args.url, target, { idempotent: true });
      if (!downloaded.exists || downloaded.size <= 0) return args.url;
      await serial(async () => {
        let rows = (await index()).filter(e => e.key !== key);
        rows.unshift({
          key, file: fileName, bytes: downloaded.size,
          accessedAt: Date.now(),
          expiresAt: Math.min(args.expiresAt ?? Date.now() + MAX_AGE_MS, Date.now() + MAX_AGE_MS),
        });
        rows.sort((a, b) => b.accessedAt - a.accessedAt);
        let total = 0;
        const keep: Entry[] = [];
        for (const row of rows) {
          const file = new File(ROOT, row.file);
          if (row.expiresAt <= Date.now() || !file.exists || total + row.bytes > MAX_BYTES) {
            try { if (file.exists) file.delete(); } catch {}
          } else { total += row.bytes; keep.push(row); }
        }
        await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(keep));
      });
      return downloaded.exists ? downloaded.uri : args.url;
    } catch { return args.url; }
  })().finally(() => inflight.delete(key));
  inflight.set(key, job);
  return job;
}

/** Explicit invalidation for revoked or changed access; never retain protected media. */
export async function clearBuklodMediaCache() {
  await serial(async () => {
    const rows = await index();
    for (const row of rows) {
      try { const f = new File(ROOT, row.file); if (f.exists) f.delete(); } catch {}
    }
    await AsyncStorage.removeItem(INDEX_KEY);
  });
}
