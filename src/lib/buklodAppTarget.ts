import Constants from 'expo-constants';

export type BuklodAppTarget = 'main' | 'classroom';

export function getBuklodAppTarget(): BuklodAppTarget {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
  const configured = String(extra.appTarget ?? '').trim().toLowerCase();

  return configured === 'classroom' ? 'classroom' : 'main';
}

export function isBuklodClassroomApp(): boolean {
  return getBuklodAppTarget() === 'classroom';
}
