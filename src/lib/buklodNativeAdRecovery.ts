/**
 * Session-local SDK health. A prewarmed NativeAd and a visible NativeAd share
 * their real load outcomes, so repeated timeouts no longer make every
 * dashboard wait through another native timeout before its banner fallback.
 *
 * This does NOT manufacture impressions, request extra ads or override the
 * global passive ad cooldown, consent, visibility and route restrictions.
 */
export const NATIVE_FAILURE_THRESHOLD = 2;
export const NATIVE_BANNER_PREFERENCE_MS = 5 * 60 * 1000;
const MAX_TRACKED_PLACEMENTS = 128;

type NativeHealth = {
  failures: number;
  lastFailureAt: number;
  retryNativeAfter: number;
};
const healthByPlacement = new Map<string, NativeHealth>();

export function preferBannerAfterNativeFailures(placementId: string, now = Date.now()): boolean {
  const health = healthByPlacement.get(placementId);
  if (!health) return false;
  if (health.retryNativeAfter > now) return true;
  if (now - health.lastFailureAt >= NATIVE_BANNER_PREFERENCE_MS) {
    healthByPlacement.delete(placementId);
  }
  return false;
}

export function noteNativeRequestFailed(placementId: string, now = Date.now()): void {
  const previous = healthByPlacement.get(placementId);
  const recent = previous && now - previous.lastFailureAt < NATIVE_BANNER_PREFERENCE_MS;
  const failures = Math.min(NATIVE_FAILURE_THRESHOLD, (recent ? previous.failures : 0) + 1);
  healthByPlacement.set(placementId, {
    failures,
    lastFailureAt: now,
    retryNativeAfter: failures >= NATIVE_FAILURE_THRESHOLD
      ? now + NATIVE_BANNER_PREFERENCE_MS
      : 0,
  });
  if (healthByPlacement.size > MAX_TRACKED_PLACEMENTS) {
    healthByPlacement.delete(healthByPlacement.keys().next().value!);
  }
}

export function noteNativeRequestSucceeded(placementId: string): void {
  healthByPlacement.delete(placementId);
}
