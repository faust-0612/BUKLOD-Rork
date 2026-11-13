import { BUKLOD_FEATURE_LINKS } from '@/lib/buklodNavigationV2';

const MAX_PINNED = 4;
const allowedIds = new Set(BUKLOD_FEATURE_LINKS.map(link => link.id));

/** Account-scoped only. No search queries, history text or user-content bytes. */
export function buklodPinnedNavigationStorageKey(accountId: string): string {
  if (!/^[a-f0-9-]{36}$/i.test(accountId)) {
    throw new Error('Cannot use unverified BUKLOD account identity for local shortcuts');
  }
  return `buklod.nav-v2.favorites.v1:${accountId.toLowerCase()}`;
}

export function normalizeBuklodPinnedNavigation(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const output: string[] = [];
  for (const candidate of value) {
    if (typeof candidate !== 'string' || !allowedIds.has(candidate) ||
        output.includes(candidate)) continue;
    output.push(candidate);
    if (output.length >= MAX_PINNED) break;
  }
  return output;
}

export function toggleBuklodPinnedNavigation(current: readonly string[], id: string): string[] {
  if (!allowedIds.has(id)) return normalizeBuklodPinnedNavigation(current);
  const normalized = normalizeBuklodPinnedNavigation(current);
  return normalized.includes(id)
    ? normalized.filter(candidate => candidate !== id)
    : normalizeBuklodPinnedNavigation([...normalized, id]);
}
