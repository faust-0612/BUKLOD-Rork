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

/**
 * A cluster of independent native-slot timeouts usually points to a shared
 * SDK/network/inventory stall, not a fault limited to one placement.
 * Temporarily prefer the existing banner fallback across the app instead of
 * making every Home/Wall/Profile/Connect first-view wait through 9-12 seconds.
 *
 * The circuit is session-local, never creates an ad, never bypasses consent,
 * never fires synthetic impression events, and always auto-recovers. Count
 * failures from DISTINCT placements so one recycler cannot mute inventory.
 */
export const NATIVE_SHARED_FAILURE_THRESHOLD = 3;
export const NATIVE_SHARED_FAILURE_WINDOW_MS = 60_000;
export const NATIVE_SHARED_BANNER_PREFERENCE_MS = 2 * 60_000;
const recentNativeFailures = new Map<string, number>();
let sharedNativeBannerUntil = 0;

function expireSharedFailures(now: number) {
  for (const [id, time] of recentNativeFailures) {
    if (now - time >= NATIVE_SHARED_FAILURE_WINDOW_MS || time > now) {
      recentNativeFailures.delete(id);
    }
  }
  if (recentNativeFailures.size > MAX_TRACKED_PLACEMENTS) {
    for (const id of [...recentNativeFailures.keys()].slice(0, recentNativeFailures.size - MAX_TRACKED_PLACEMENTS)) {
      recentNativeFailures.delete(id);
    }
  }
}

function isSharedNativeDegraded(now: number) {
  if (sharedNativeBannerUntil > now) return true;
  if (sharedNativeBannerUntil > 0 && sharedNativeBannerUntil <= now) {
    sharedNativeBannerUntil = 0;
    recentNativeFailures.clear();
  }
  return false;
}

export function preferBannerAfterNativeFailures(placementId: string, now = Date.now()): boolean {
  // All call sites (including the prewarm pool) share this protection.
  if (isSharedNativeDegraded(now)) return true;
  const health = healthByPlacement.get(placementId);
  if (!health) return false;
  if (health.retryNativeAfter > now) return true;
  if (now - health.lastFailureAt >= NATIVE_BANNER_PREFERENCE_MS) {
    healthByPlacement.delete(placementId);
  }
  return false;
}

export function noteNativeRequestFailed(placementId: string, now = Date.now()): void {
  // Do not endlessly extend a muted circuit from leftover SDK completions.
  if (!isSharedNativeDegraded(now)) {
    expireSharedFailures(now);
    recentNativeFailures.set(placementId, now);
    if (recentNativeFailures.size >= NATIVE_SHARED_FAILURE_THRESHOLD) {
      sharedNativeBannerUntil = now + NATIVE_SHARED_BANNER_PREFERENCE_MS;
      recentNativeFailures.clear();
    }
  }
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
  // A real SDK load is positive evidence that shared native inventory works;
  // re-enable its next eligible request without waiting for a mute timer.
  sharedNativeBannerUntil = 0;
  recentNativeFailures.clear();
}
