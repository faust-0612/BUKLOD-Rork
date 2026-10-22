/* BUKLOD_CHARACTER_500K_REWARD_BANDS_R1 */
import type {
  CatalogItem,
  SlotId,
} from './types';

import {
  formatPoints,
} from './tiers';

/**
 * Character reward bands only.
 * Canonical Circle Rank still comes from the server-side BUKLOD rank ladder.
 */
export const WARRIOR_RANKS = [
  'Novice',
  'Scout',
  'Guardian',
  'Warden',
  'Champion',
  'Legend',
  'Vanguard',
  'Pathfinder',
  'Steward',
  'Luminary',
  'Covenant',
  'Legacy',
  'Summit',
  'Crown',
] as const;

export type WarriorRank =
  (typeof WARRIOR_RANKS)[number];

export function warriorRankFor(
  item: CatalogItem,
): number {
  if (item.warriorRank != null) {
    return item.warriorRank;
  }

  const p = item.unlockAtLifetime;

  if (p >= 500000) return 13;
  if (p >= 400000) return 12;
  if (p >= 300000) return 11;
  if (p >= 200000) return 10;
  if (p >= 100000) return 9;
  if (p >= 50000) return 8;
  if (p >= 25000) return 7;
  if (p >= 10000) return 6;
  if (p >= 5000) return 5;
  if (p >= 2500) return 4;
  if (p >= 1000) return 3;
  if (p >= 500) return 2;
  if (p >= 100) return 1;

  return 0;
}

export function warriorRankLabel(
  item: CatalogItem,
): WarriorRank {
  return WARRIOR_RANKS[
    Math.min(
      warriorRankFor(item),
      WARRIOR_RANKS.length - 1,
    )
  ];
}

export function itemPointsLabel(
  item: CatalogItem,
  locked: boolean,
  pointsRemaining: number,
): string {
  if (item.unlockAtLifetime <= 0) {
    return 'FREE';
  }

  if (locked) {
    return `${formatPoints(
      pointsRemaining,
    )} more`;
  }

  return `${formatPoints(
    item.unlockAtLifetime,
  )} pts`;
}

export const WARRIOR_STYLE_SLOTS:
  readonly SlotId[] = [
    'hair',
    'top',
    'bottom',
    'shoes',
    'face',
    'accessory',
    'badge',
    'special',
  ] as const;
