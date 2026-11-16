/** Read-only, deterministic Treasury collection journey.
 * This is a UI view of existing SERVER-VERIFIED item ownership, not a badge,
 * token grant, new entitlement, or authority to spend offline.
 */
export type TreasuryJourneySource = 'server' | 'cached' | 'unavailable';
export type TreasuryJourneyItem = Readonly<{key: string; name: string; price: number}>;
export type TreasuryJourneySnapshot = Readonly<{
  balance: number;
  ownedItems: readonly string[];
  source: TreasuryJourneySource;
}>;
export type TreasuryJourneyStep = Readonly<{
  key: string;
  name: string;
  price: number;
  owned: boolean;
  canUnlock: boolean;
}>;

export function buildKingdomTreasuryJourney(
  snapshot: TreasuryJourneySnapshot,
  catalog: readonly TreasuryJourneyItem[],
): {
  ownedCount: number;
  totalCount: number;
  completionPercent: number;
  steps: TreasuryJourneyStep[];
  next: TreasuryJourneyStep | null;
  shardsAway: number;
  source: TreasuryJourneySource;
} {
  const source = snapshot.source;
  const balance = Number.isSafeInteger(snapshot.balance) && snapshot.balance >= 0
    ? snapshot.balance : 0;
  const owned = new Set(source === 'unavailable' ? [] : snapshot.ownedItems);
  const seen = new Set<string>();
  const steps = catalog.map(item => {
    if (!item.key || seen.has(item.key) || !Number.isSafeInteger(item.price) || item.price < 0) {
      throw new Error('Invalid or duplicate Treasury catalog item');
    }
    seen.add(item.key);
    const isOwned = owned.has(item.key);
    return {
      key: item.key,
      name: item.name,
      price: item.price,
      owned: isOwned,
      canUnlock: source === 'server' && !isOwned && balance >= item.price,
    };
  });
  const ownedCount = steps.filter(step => step.owned).length;
  const next = steps.filter(step => !step.owned)
    .sort((a, b) => a.price - b.price || a.key.localeCompare(b.key))[0] ?? null;
  return {
    ownedCount,
    totalCount: steps.length,
    completionPercent: steps.length ? Math.round(100 * ownedCount / steps.length) : 0,
    steps,
    next,
    shardsAway: next ? Math.max(0, next.price - balance) : 0,
    source,
  };
}
