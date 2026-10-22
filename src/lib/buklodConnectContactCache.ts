import { getOfflineCache } from '@/lib/offlineCache';
import type { ConnectSuggestedContact } from '@/lib/buklodConnectSuggestedContacts';

const warm = new Map<string, ConnectSuggestedContact[]>();
const pending = new Map<string, Promise<void>>();
const key = (viewer: string, scope?: string) => `${viewer}:${scope || 'public'}`;
export function getWarmConnectContacts(viewer?: string, scope?: string) {
  return viewer ? warm.get(key(viewer, scope)) ?? [] : [];
}
export function hasWarmConnectContacts(viewer: string, scope?: string) {
  return warm.has(key(viewer, scope));
}
export function rememberConnectContacts(viewer: string, scope: string | undefined, rows: ConnectSuggestedContact[]) {
  warm.set(key(viewer, scope), rows.slice(0, 40));
  while (warm.size > 24) warm.delete(warm.keys().next().value!);
}
export function prewarmConnectContacts(viewer: string, scope?: string) {
  const id = key(viewer, scope);
  if (warm.has(id)) return Promise.resolve();
  const existing = pending.get(id);
  if (existing) return existing;
  const task = getOfflineCache<{ suggestedContacts?: ConnectSuggestedContact[] }>(
    `connect-hub:${scope || 'public'}`, { userId: viewer, allowStale: true },
  ).then(cached => {
    if (!warm.has(id)) rememberConnectContacts(viewer, scope, cached?.data?.suggestedContacts ?? []);
  }).finally(() => { pending.delete(id); });
  pending.set(id, task);
  return task;
}
