/**
 * Immediate local avatar updates after a confirmed profile save.
 * This does not claim to be a remote per-user subscription; remote clients
 * continue to resolve canonical profile URLs through the authorized batch RPC.
 */
export type BuklodAvatarChange = { userId: string; url: string };
const latest = new Map<string, string>();
const listeners = new Set<(change: BuklodAvatarChange) => void>();

export function getBuklodLiveAvatar(userId: string | null | undefined) {
  return latest.get(String(userId ?? '').toLowerCase()) ?? null;
}

export function subscribeBuklodLiveAvatar(listener: (change: BuklodAvatarChange) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function publishBuklodLiveAvatar(change: BuklodAvatarChange) {
  const userId = String(change.userId ?? '').trim().toLowerCase();
  const url = String(change.url ?? '').trim();
  if (!/^[a-f0-9-]{36}$/.test(userId) || !/^https:\/\//i.test(url)) return;
  latest.delete(userId);
  latest.set(userId, url);
  while (latest.size > 64) {
    const oldest = latest.keys().next().value;
    if (oldest) latest.delete(oldest);
  }
  for (const listener of listeners) listener({ userId, url });
}
