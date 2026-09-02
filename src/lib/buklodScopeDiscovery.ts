/**
 * Shared discovery type filter.
 * Nearby Churches v1 is CHURCH-only. Future Discover can pass more
 * eligible buklod_scopes types into the same search RPC.
 */

export const BUKLOD_NEARBY_SCOPE_TYPES = ['CHURCH'] as const;

export type BuklodDiscoveryMode = 'nearby_churches' | 'discover';

export function resolveDiscoveryScopeTypes(input?: {
  mode?: BuklodDiscoveryMode;
  extraTypes?: string[];
}): string[] {
  const extra = (input?.extraTypes ?? [])
    .map((value) => String(value ?? '').trim().toUpperCase())
    .filter(Boolean);

  if (input?.mode === 'discover' && extra.length) {
    return Array.from(new Set(extra));
  }

  return [...BUKLOD_NEARBY_SCOPE_TYPES];
}

export function isNearbyChurchScopeType(scopeType?: string | null) {
  const type = String(scopeType ?? '').trim().toUpperCase();
  return type === 'CHURCH' || type === 'ORGANIZATION';
}
