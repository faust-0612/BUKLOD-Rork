import Constants from 'expo-constants';

export type BuklodAppTarget = 'main' | 'classroom';

function normalizeTarget(value: unknown): BuklodAppTarget | null {
  const normalized = String(value ?? '').trim().toLowerCase();

  if (normalized === 'classroom') return 'classroom';
  if (normalized === 'main') return 'main';
  return null;
}

const embeddedTarget = normalizeTarget(
  Constants.expoConfig?.extra?.appTarget
);

const environmentTarget = normalizeTarget(
  process.env.BUKLOD_APP_TARGET
);

/**
 * Runtime identity must follow the Expo config baked into the build/export.
 * The environment fallback is only for local/test contexts where expoConfig
 * is not populated yet. Main remains the default for legacy Main workflows.
 */
export const BUKLOD_APP_TARGET: BuklodAppTarget =
  embeddedTarget ?? environmentTarget ?? 'main';

export const IS_BUKLOD_CLASSROOM =
  BUKLOD_APP_TARGET === 'classroom';

export const BUKLOD_APP_DISPLAY_NAME = IS_BUKLOD_CLASSROOM
  ? 'BUKLOD Classroom'
  : 'BUKLOD';

export const BUKLOD_AUTHENTICATED_HOME = IS_BUKLOD_CLASSROOM
  ? '/classroom'
  : '/(tabs)/messages';

export const BUKLOD_FRESH_LOGIN_HOME = IS_BUKLOD_CLASSROOM
  ? '/classroom'
  : '/(tabs)/home';
