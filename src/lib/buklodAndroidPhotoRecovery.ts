/**
 * BUKLOD_ANDROID_WALL_PHOTO_RECOVERY_R1
 * Pure decision logic: progress is not a failed load. A duplicate download
 * starts only after a genuine stall or a decode-without-display condition.
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
export const ANDROID_PHOTO_DISK_PAINT_STALL_MS = 12_000;
export const ANDROID_PHOTO_DECODE_STALL_MS = 8_000;
export const ANDROID_PHOTO_DEADLINE_MS = 90_000;

export function decideAndroidPhotoRecovery(input: AndroidPhotoRecoveryInput): AndroidPhotoRecoveryDecision {
  const elapsed = Math.max(0, input.now - input.startedAt);
  if (elapsed >= ANDROID_PHOTO_DEADLINE_MS) return 'fail';
  if (input.fromDiskCache) {
    return elapsed >= ANDROID_PHOTO_DISK_PAINT_STALL_MS ? 'fallback' : 'keep';
  }
  const lastActivity = input.lastProgressAt || input.startedAt;
  if (input.renderer === 'native') {
    return input.now - lastActivity >= ANDROID_PHOTO_NATIVE_STALL_MS ? 'fallback' : 'keep';
  }
  if (input.decodedAt > 0) {
    return input.now - input.decodedAt >= ANDROID_PHOTO_DECODE_STALL_MS
      ? 'fallback'
      : 'keep';
  }

  return input.now - lastActivity >= ANDROID_PHOTO_STALL_MS
    ? 'fallback'
    : 'keep';
}
