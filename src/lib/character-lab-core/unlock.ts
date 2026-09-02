import { CATALOG, itemsForSlot } from './catalog';
import { formatPoints } from './tiers';
import { warriorRankFor } from './warrior';
import type {
  BodyId,
  CatalogItem,
  Equipment,
  ItemVisualState,
  ResolvedItem,
  SlotId,
} from './types';

/**
 * The unlock engine. Everything is derived from LIFETIME points — the spendable
 * balance is never consulted here, so redeeming points can never take a
 * permanent unlock away.
 */
export interface UnlockContext {
  readonly lifetimePoints: number;
  readonly equipment: Equipment;
  /** Item ids unlocked since the user last acknowledged them. */
  readonly newlyUnlocked: ReadonlySet<string>;
}

export function isUnlocked(item: CatalogItem, lifetimePoints: number): boolean {
  return lifetimePoints >= item.unlockAtLifetime;
}

export function requirementLabel(item: CatalogItem): string {
  if (item.unlockAtLifetime <= 0) return 'Starter item';
  return `Unlock at ${formatPoints(item.unlockAtLifetime)} Lifetime Points`;
}

export function resolveItem(item: CatalogItem, ctx: UnlockContext): ResolvedItem {
  const unlocked = isUnlocked(item, ctx.lifetimePoints);
  const equipped = ctx.equipment[item.slot] === item.id;
  let state: ItemVisualState;
  if (!unlocked) state = 'locked';
  else if (equipped) state = 'equipped';
  else if (ctx.newlyUnlocked.has(item.id)) state = 'newly_unlocked';
  else state = 'available';
  return {
    item,
    state,
    isUnlocked: unlocked,
    pointsRemaining: unlocked ? 0 : item.unlockAtLifetime - ctx.lifetimePoints,
    requirementLabel: requirementLabel(item),
  };
}

/** All items for one customizer category, resolved and ordered by threshold. */
export function resolveSlot(slot: SlotId, body: BodyId, ctx: UnlockContext): ResolvedItem[] {
  return itemsForSlot(slot, body)
    .slice()
    .sort((a, b) => {
      const rankDiff = warriorRankFor(a) - warriorRankFor(b);
      if (rankDiff !== 0) return rankDiff;
      return a.unlockAtLifetime - b.unlockAtLifetime;
    })
    .map((item) => resolveItem(item, ctx));
}

/** Every item in the catalog, resolved. Used by MY COLLECTION. */
export function resolveAll(body: BodyId, ctx: UnlockContext): ResolvedItem[] {
  return CATALOG.filter((item) => !item.bodies || item.bodies.includes(body)).map((item) =>
    resolveItem(item, ctx),
  );
}

/**
 * Items that become unlocked when lifetime points move from `from` to `to`.
 * Drives the unlock celebration. Body-filtered so a male player is never told
 * they unlocked a feminine hairstyle.
 */
export function itemsUnlockedBetween(from: number, to: number, body: BodyId): CatalogItem[] {
  if (to <= from) return [];
  return CATALOG.filter(
    (item) =>
      (!item.bodies || item.bodies.includes(body)) &&
      item.unlockAtLifetime > from &&
      item.unlockAtLifetime <= to &&
      item.unlockAtLifetime > 0,
  ).sort((a, b) => a.unlockAtLifetime - b.unlockAtLifetime);
}

/** The next threshold that unlocks anything, with the items it will grant. */
export function nextUnlock(
  lifetimePoints: number,
  body: BodyId,
): { threshold: number; items: CatalogItem[]; pointsAway: number } | null {
  const upcoming = CATALOG.filter(
    (item) =>
      (!item.bodies || item.bodies.includes(body)) && item.unlockAtLifetime > lifetimePoints,
  ).sort((a, b) => a.unlockAtLifetime - b.unlockAtLifetime);
  const first = upcoming[0];
  if (!first) return null;
  const threshold = first.unlockAtLifetime;
  return {
    threshold,
    items: upcoming.filter((item) => item.unlockAtLifetime === threshold),
    pointsAway: threshold - lifetimePoints,
  };
}

/** Counts for the collection header: owned vs total for this body. */
export function collectionTally(
  body: BodyId,
  lifetimePoints: number,
): { owned: number; total: number } {
  const relevant = CATALOG.filter((item) => !item.bodies || item.bodies.includes(body));
  return {
    owned: relevant.filter((item) => isUnlocked(item, lifetimePoints)).length,
    total: relevant.length,
  };
}

/**
 * Keeps equipment legal after lifetime points drop in the simulator: anything
 * no longer unlocked falls back to the slot's starter item.
 */
export function reconcileEquipment(
  equipment: Equipment,
  body: BodyId,
  lifetimePoints: number,
  fallback: Equipment,
): Equipment {
  const next: Equipment = { ...equipment };
  (Object.keys(equipment) as SlotId[]).forEach((slot) => {
    const id = equipment[slot];
    if (!id) return;
    const item = CATALOG.find((entry) => entry.id === id);
    const wrongBody = item?.bodies && !item.bodies.includes(body);
    if (!item || wrongBody || !isUnlocked(item, lifetimePoints)) {
      next[slot] = fallback[slot];
    }
  });
  return next;
}
