import AsyncStorage from '@react-native-async-storage/async-storage';

const AD_LIGHT_PASS_UNTIL_KEY =
  '@buklod/ad/ad-light-pass-until';

export const BUKLOD_AD_LIGHT_PASS_DURATION_MS =
  15 * 60 * 1000;

export type BuklodAdLightPassStatus = {
  active: boolean;
  expiresAt: number | null;
  remainingMs: number;
};

function normalizeExpiry(value: string | null): number | null {
  if (!value) return null;

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export async function getBuklodAdLightPassStatus(
  now = Date.now(),
): Promise<BuklodAdLightPassStatus> {
  const stored = await AsyncStorage.getItem(
    AD_LIGHT_PASS_UNTIL_KEY,
  );
  const expiresAt = normalizeExpiry(stored);

  if (!expiresAt || expiresAt <= now) {
    if (stored) {
      await AsyncStorage.removeItem(
        AD_LIGHT_PASS_UNTIL_KEY,
      );
    }

    return {
      active: false,
      expiresAt: null,
      remainingMs: 0,
    };
  }

  return {
    active: true,
    expiresAt,
    remainingMs: Math.max(0, expiresAt - now),
  };
}

export async function isBuklodAdLightPassActive(
  now = Date.now(),
): Promise<boolean> {
  const status = await getBuklodAdLightPassStatus(now);
  return status.active;
}

export async function activateBuklodAdLightPass(
  now = Date.now(),
): Promise<BuklodAdLightPassStatus> {
  const expiresAt =
    now + BUKLOD_AD_LIGHT_PASS_DURATION_MS;

  await AsyncStorage.setItem(
    AD_LIGHT_PASS_UNTIL_KEY,
    String(expiresAt),
  );

  return {
    active: true,
    expiresAt,
    remainingMs: BUKLOD_AD_LIGHT_PASS_DURATION_MS,
  };
}
