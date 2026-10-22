/* BUKLOD_CHARACTER_500K_FALLBACK_PROGRESSION_R1 */
import type {
  Tier,
} from './types';

import {
  supabase,
} from '@/lib/supabase';

/**
 * Character fallback tiers only.
 * The canonical user-facing Circle Rank ladder remains server-authoritative.
 */
export const DEFAULT_TIERS:
  readonly Tier[] = [
    {
      index: 1,
      name: 'Seedling',
      minLifetime: 0,
      meaning: 'Just joined the work',
    },
    {
      index: 2,
      name: 'Sprout',
      minLifetime: 100,
      meaning: 'Showing up steadily',
    },
    {
      index: 3,
      name: 'Rooted',
      minLifetime: 250,
      meaning: 'Part of the community rhythm',
    },
    {
      index: 4,
      name: 'Branching',
      minLifetime: 500,
      meaning: 'Bringing others along',
    },
    {
      index: 5,
      name: 'Flourishing',
      minLifetime: 1000,
      meaning: 'Carrying real responsibility',
    },
    {
      index: 6,
      name: 'Cornerstone',
      minLifetime: 2500,
      meaning: 'Others build around you',
    },
    {
      index: 7,
      name: 'Beacon',
      minLifetime: 5000,
      meaning: 'A landmark of service',
    },
    {
      index: 8,
      name: 'Vanguard',
      minLifetime: 10000,
      meaning: 'Long-term service momentum',
    },
    {
      index: 9,
      name: 'Pathfinder',
      minLifetime: 25000,
      meaning: 'Sustained participation over time',
    },
    {
      index: 10,
      name: 'Steward',
      minLifetime: 50000,
      meaning: 'Established long-term contribution',
    },
    {
      index: 11,
      name: 'Luminary',
      minLifetime: 100000,
      meaning: 'A major lifetime participation milestone',
    },
    {
      index: 12,
      name: 'Covenant',
      minLifetime: 200000,
      meaning: 'Deep sustained BUKLOD participation',
    },
    {
      index: 13,
      name: 'Legacy',
      minLifetime: 300000,
      meaning: 'Late-roadmap lifetime contribution',
    },
    {
      index: 14,
      name: 'Summit',
      minLifetime: 400000,
      meaning: 'Near the top of the current roadmap',
    },
    {
      index: 15,
      name: 'Crown',
      minLifetime: 500000,
      meaning: 'Highest current Character reward milestone',
    },
  ] as const;

/** @deprecated Use getActiveTiers() */
export const TIERS = DEFAULT_TIERS;

export const UNLOCK_THRESHOLDS:
  readonly number[] = [
    0,
    100,
    250,
    500,
    1000,
    2500,
    5000,
    10000,
    25000,
    50000,
    75000,
    100000,
    150000,
    200000,
    250000,
    300000,
    350000,
    400000,
    450000,
    500000,
  ] as const;

export const SIMULATOR_STEPS:
  readonly number[] =
    UNLOCK_THRESHOLDS;

let runtimeTiers:
  Tier[] | null = null;

export function getActiveTiers():
  readonly Tier[] {
  return runtimeTiers ??
    DEFAULT_TIERS;
}

export function setRuntimeTiers(
  tiers: Tier[],
) {
  runtimeTiers =
    tiers.length
      ? tiers
      : null;
}

export async function
loadCharacterProgressionConfig():
  Promise<readonly Tier[]> {
  try {
    const {
      data,
      error,
    } =
      await (
        supabase as any
      ).rpc(
        'get_buklod_character_progression_config_v1',
      );

    if (
      error ||
      !Array.isArray(data) ||
      !data.length
    ) {
      return DEFAULT_TIERS;
    }

    const tiers = data
      .map(
        (
          row:
            Record<
              string,
              unknown
            >,
          index: number,
        ) => ({
          index: Number(
            row.index ??
              index + 1,
          ),
          name: String(
            row.name ??
              `Tier ${
                index + 1
              }`,
          ),
          minLifetime:
            Number(
              row.minLifetime ??
                row.min_lifetime ??
                0,
            ),
          meaning: String(
            row.meaning ??
              '',
          ),
        }),
      )
      .filter(
        (tier) =>
          tier.name &&
          Number.isFinite(
            tier.minLifetime,
          ),
      )
      .sort(
        (a, b) =>
          a.minLifetime -
          b.minLifetime,
      );

    if (tiers.length) {
      setRuntimeTiers(
        tiers,
      );
      return tiers;
    }
  }
  catch {
    // fall through
  }

  return DEFAULT_TIERS;
}

export function tierFor(
  lifetimePoints: number,
): Tier {
  const tiers =
    getActiveTiers();

  let current:
    Tier = tiers[0];

  for (const tier of tiers) {
    if (
      lifetimePoints >=
      tier.minLifetime
    ) {
      current = tier;
    }
  }

  return current;
}

export function nextTierFor(
  lifetimePoints: number,
): Tier | null {
  for (
    const tier
    of getActiveTiers()
  ) {
    if (
      tier.minLifetime >
      lifetimePoints
    ) {
      return tier;
    }
  }

  return null;
}

export function tierProgress(
  lifetimePoints: number,
): {
  tier: Tier;
  next: Tier | null;
  ratio: number;
  pointsToNext: number;
} {
  const tier =
    tierFor(lifetimePoints);

  const next =
    nextTierFor(
      lifetimePoints,
    );

  if (!next) {
    return {
      tier,
      next: null,
      ratio: 1,
      pointsToNext: 0,
    };
  }

  const span =
    next.minLifetime -
    tier.minLifetime;

  const gained =
    lifetimePoints -
    tier.minLifetime;

  const ratio =
    span <= 0
      ? 1
      : Math.min(
          1,
          Math.max(
            0,
            gained / span,
          ),
        );

  return {
    tier,
    next,
    ratio,
    pointsToNext:
      next.minLifetime -
      lifetimePoints,
  };
}

export function formatPoints(
  value: number,
): string {
  return Math.round(
    value,
  ).toLocaleString(
    'en-US',
  );
}
