/**
 * BUKLOD_ANDROID_WALL_PHOTO_RECOVERY_R2
 * Never restart an active slow download. Native Fresco is the preferred
 * Android painter; Expo Image is a one-time alternate on a genuinely stalled
 * transfer. A decoded Expo Image without display likewise gets a native try.
 */
export type AndroidPhotoRecoveryDecision = 'keep' | 'fallback' | 'fail';

export type AndroidPhotoRecoveryInput = {
  now: number;
  startedAt: number;
  lastProgressAt: number;
  decodedAt: number;
  renderer: 'expo' | 'native';
  fromDiskCache: boolean;
};

export const ANDROID_PHOTO_STALL_MS = 18_000;
export const ANDROID_PHOTO_NATIVE_STALL_MS = 40_000;
export const ANDROID_PHOTO_DECODE_STALL_MS = 8_000;
export const ANDROID_PHOTO_DEADLINE_MS = 90_000;

export function decideAndroidPhotoRecovery(input: AndroidPhotoRecoveryInput): AndroidPhotoRecoveryDecision {
  const elapsed = Math.max(0, input.now - input.startedAt);
  if (elapsed >= ANDROID_PHOTO_DEADLINE_MS) return 'fail';
  if (input.fromDiskCache) return 'keep';

  const lastActivity = input.lastProgressAt || input.startedAt;
  if (input.renderer === 'native') {
    // Fresco can take much longer than eight seconds on very weak data.
    return input.now - lastActivity >= ANDROID_PHOTO_NATIVE_STALL_MS ? 'fallback' : 'keep';
  }
  if (input.decodedAt > 0) {
    return input.now - input.decodedAt >= ANDROID_PHOTO_DECODE_STALL_MS ? 'fallback' : 'keep';
  }
  return input.now - lastActivity >= ANDROID_PHOTO_STALL_MS ? 'fallback' : 'keep';
}
