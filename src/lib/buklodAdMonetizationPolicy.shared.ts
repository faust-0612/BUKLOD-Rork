function intEnv(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
) {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

/**
 * BUKLOD_AD_POLICY_R3
 * One authoritative monetization policy for Main.
 * Platform files may re-export this module, but must not silently invent a
 * denser cadence. Production tuning is environment/config driven.
 */
export const COMMUNITY_AD_MIN_LEADING = intEnv(
  process.env.EXPO_PUBLIC_ADS_WALL_MIN_CONTENT_BEFORE_FIRST_AD,
  8,
  4,
  30,
);

export const COMMUNITY_AD_INTERVAL = intEnv(
  process.env.EXPO_PUBLIC_ADS_WALL_CONTENT_INTERVAL,
  10,
  6,
  30,
);

export const COMMUNITY_AD_INTERVAL_MIN = intEnv(
  process.env.EXPO_PUBLIC_ADS_WALL_INTERVAL_MIN,
  8,
  4,
  30,
);

export const COMMUNITY_AD_INTERVAL_MAX = Math.max(
  COMMUNITY_AD_INTERVAL_MIN,
  intEnv(
    process.env.EXPO_PUBLIC_ADS_WALL_INTERVAL_MAX,
    12,
    COMMUNITY_AD_INTERVAL_MIN,
    40,
  ),
);

export const REELS_AD_MIN_LEADING = intEnv(
  process.env.EXPO_PUBLIC_ADS_REELS_MIN_CONTENT_BEFORE_FIRST_AD,
  8,
  4,
  30,
);

export const REELS_AD_INTERVAL = intEnv(
  process.env.EXPO_PUBLIC_ADS_REELS_CONTENT_INTERVAL,
  10,
  6,
  30,
);

export const REELS_AD_INTERVAL_MIN = intEnv(
  process.env.EXPO_PUBLIC_ADS_REELS_INTERVAL_MIN,
  8,
  4,
  30,
);

export const REELS_AD_INTERVAL_MAX = Math.max(
  REELS_AD_INTERVAL_MIN,
  intEnv(
    process.env.EXPO_PUBLIC_ADS_REELS_INTERVAL_MAX,
    12,
    REELS_AD_INTERVAL_MIN,
    40,
  ),
);

export const INTERSTITIAL_MIN_EVENT_COUNT = intEnv(
  process.env.EXPO_PUBLIC_ADS_INTERSTITIAL_MIN_EVENTS,
  3,
  1,
  20,
);

export const INTERSTITIAL_COOLDOWN_MS = intEnv(
  process.env.EXPO_PUBLIC_ADS_INTERSTITIAL_MIN_INTERVAL_MS,
  12 * 60 * 1000,
  60 * 1000,
  24 * 60 * 60 * 1000,
);

export const INTERSTITIAL_SESSION_CAP = intEnv(
  process.env.EXPO_PUBLIC_ADS_SESSION_INTERSTITIAL_CAP,
  3,
  0,
  3,
);

export const BANNER_RETRY_DELAYS_MS = [
  intEnv(process.env.EXPO_PUBLIC_ADS_RETRY_1_MS, 8_000, 3_000, 60_000),
  intEnv(process.env.EXPO_PUBLIC_ADS_RETRY_2_MS, 20_000, 5_000, 120_000),
  intEnv(process.env.EXPO_PUBLIC_ADS_RETRY_3_MS, 45_000, 10_000, 180_000),
] as const;

export const AD_OPERATIONAL_FLUSH_MS = intEnv(
  process.env.EXPO_PUBLIC_ADS_TELEMETRY_FLUSH_MS,
  45_000,
  15_000,
  5 * 60 * 1000,
);

export const AD_OPERATIONAL_MAX_BATCH_KEYS = intEnv(
  process.env.EXPO_PUBLIC_ADS_TELEMETRY_BATCH_KEYS,
  20,
  5,
  25,
);

export const AD_SLOT_REMOUNT_COOLDOWN_MS = intEnv(
  process.env.EXPO_PUBLIC_ADS_SLOT_REMOUNT_COOLDOWN_MS,
  2 * 60 * 1000,
  30 * 1000,
  30 * 60 * 1000,
);
