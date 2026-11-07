import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BuklodGameResult } from '../types';
import {
  createKingdomProgressController,
  emptyKingdomPreviewProgress,
  type BuklodKingdomPreviewProgress,
} from './progressController';

export type { BuklodKingdomPreviewProgress, BuklodKingdomStationProgress } from './progressController';
const controller = createKingdomProgressController(AsyncStorage);

/**
 * Legacy original-station records are now strictly keyed by an authenticated
 * BUKLOD account. Never migrate old globally shared Kingdom v1 records:
 * their author cannot be established safely on shared devices.
 * Unauthenticated game sessions remain playable but not saved.
 */
export function getCachedBuklodKingdomPreviewProgress(userId?: string | null) {
  return controller.getCached(userId);
}
export function loadBuklodKingdomPreviewProgress(userId?: string | null) {
  return controller.load(userId);
}
export function recordBuklodKingdomPreviewResult(
  result: BuklodGameResult, userId?: string | null,
): Promise<BuklodKingdomPreviewProgress> {
  return controller.record(userId, result);
}
export function subscribeBuklodKingdomPreviewProgress(
  userIdOrListener: string | null | ((progress: BuklodKingdomPreviewProgress) => void),
  listener?: (progress: BuklodKingdomPreviewProgress) => void,
) {
  // The original, byte-locked fallback map still calls this with only a callback.
  // It deliberately receives no account progress rather than leaking another user's.
  if (typeof userIdOrListener === 'function') return () => undefined;
  return controller.subscribe(userIdOrListener, listener ?? (() => undefined));
}
export { emptyKingdomPreviewProgress };
