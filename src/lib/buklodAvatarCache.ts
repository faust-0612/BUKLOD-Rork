import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';

type AvatarRow = { url: string | null; at: number };
const KEY = 'buklod:public-avatar-urls:v2';
const MAX_ROWS = 200;
const TTL = 7 * 24 * 60 * 60 * 1000;
export const avatarCache = new Map<string, AvatarRow>();
const pending = new Map<string, Promise<string | null>>();
const attempted = new Map<string, number>();
let hydration: Promise<void> | null = null;
let persist: ReturnType<typeof setTimeout> | null = null;

export function normalizeAvatarUrl(raw: string | null | undefined) {
  const value = String(raw ?? '').trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  const path = value.replace(/^\/+/, '').replace(/^profile-avatars\//i, '').split('?')[0];
  return path ? supabase.storage.from('profile-avatars').getPublicUrl(path).data.publicUrl : null;
}

export function rememberAvatarUrl(id: string, url: string | null) {
  if (!id) return;
  avatarCache.delete(id);
  avatarCache.set(id, { url, at: Date.now() });
  while (avatarCache.size > MAX_ROWS) avatarCache.delete(avatarCache.keys().next().value!);
  if (persist) clearTimeout(persist);
  persist = setTimeout(() => {
    persist = null;
    // Only public profile URL metadata; never credentials or private media.
    void AsyncStorage.setItem(KEY, JSON.stringify([...avatarCache]))
      .catch(() => undefined);
  }, 180);
}

export function hydrateAvatarCache() {
  if (!hydration) {
    hydration = AsyncStorage.getItem(KEY).then(raw => {
      const rows: unknown = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(rows)) return;
      for (const item of rows.slice(-MAX_ROWS)) {
        if (!Array.isArray(item) || typeof item[0] !== 'string') continue;
        const [id, row] = item as [string, AvatarRow];
        if (!row || Date.now() - row.at > TTL || avatarCache.has(id)) continue;
        if (row.url !== null && typeof row.url !== 'string') continue;
        avatarCache.set(id, row);
      }
    }).catch(() => undefined);
  }
  return hydration;
}

/** One authoritative read per person, with shared cooldown after image failures. */
export async function resolveAvatarUrl(id: string, force = false) {
  await hydrateAvatarCache();
  const cached = avatarCache.get(id);
  if (!force && cached && Date.now() - cached.at < TTL) return cached.url;
  const existing = pending.get(id);
  if (existing) return existing;
  if (Date.now() - (attempted.get(id) ?? 0) < 60_000) return cached?.url ?? null;
  attempted.set(id, Date.now());
  if (attempted.size > MAX_ROWS) attempted.delete(attempted.keys().next().value!);
  const task = (async () => {
    const { data, error } = await (supabase as any).rpc('get_buklod_profile_avatars_v1', {
      p_user_ids: [id],
    });
    if (error) return cached?.url ?? null;
    const row = Array.isArray(data) ? data.find((value: any) => value.user_id === id || value.id === id) ?? data[0] : data;
    const url = normalizeAvatarUrl(row?.avatar_url);
    rememberAvatarUrl(id, url);
    return url;
  })().finally(() => { pending.delete(id); });
  pending.set(id, task);
  return task;
}
