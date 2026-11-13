const MAX_PINNED = 4;

/**
 * Account-scoped only. Caller supplies its verified, authorized catalog IDs
 * rather than duplicating the registry in storage code. No search query/history
 * text or user-content bytes are persisted.
 */
export function buklodPinnedNavigationStorageKey(accountId: string): string {
  if (!/^[a-f0-9-]{36}$/i.test(accountId)) {
    throw new Error('Cannot use unverified BUKLOD account identity for local shortcuts');
  }
  return `buklod.nav-v2.favorites.v1:${accountId.toLowerCase()}`;
}

export function normalizeBuklodPinnedNavigation(
  value: unknown,
  validFeatureIds: readonly string[],
): string[] {
  if (!Array.isArray(value)) return [];
  const allowedIds = new Set(validFeatureIds);
  const result: string[] = [];
  for (const candidate of value) {
    if (typeof candidate !== 'string' || !allowedIds.has(candidate) ||
        result.includes(candidate)) continue;
    result.push(candidate);
    if (result.length >= MAX_PINNED) break;
  }
  return result;
}

export function toggleBuklodPinnedNavigation(
  current: readonly string[],
  id: string,
  validFeatureIds: readonly string[],
): string[] {
  const normalized = normalizeBuklodPinnedNavigation(current, validFeatureIds);
  if (!validFeatureIds.includes(id)) return normalized;
  return normalized.includes(id)
    ? normalized.filter(candidate => candidate !== id)
    : normalizeBuklodPinnedNavigation([...normalized, id], validFeatureIds);
}
