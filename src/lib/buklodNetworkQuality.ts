/**
 * Measured Community network quality.
 * Online/offline from NetInfo is not enough: a connected 3G or a timed-out
 * read is degraded and must not be treated as a healthy feed.
 */

export type BuklodNetworkQuality = 'offline' | 'degraded' | 'normal';

export type NetInfoQualityHint = {
  isConnected?: boolean | null;
  isInternetReachable?: boolean | null;
  type?: string | null;
  cellularGeneration?: string | null;
};

const SAMPLE_LIMIT = 8;
const SAMPLE_WINDOW_MS = 60_000;
const DEGRADED_LATENCY_MS = 2_500;

const samples: Array<{ at: number; ms: number; ok: boolean }> = [];
const listeners = new Set<() => void>();

let hint: NetInfoQualityHint = {};

function emit() {
  listeners.forEach(listener => {
    try {
      listener();
    } catch {
      // Quality listeners are observational.
    }
  });
}

export function subscribeNetworkQuality(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function noteNetInfoHint(next: NetInfoQualityHint) {
  hint = {
    isConnected: next.isConnected ?? null,
    isInternetReachable: next.isInternetReachable ?? null,
    type: next.type ?? null,
    cellularGeneration: next.cellularGeneration ?? null,
  };
  emit();
}

export function noteMeasuredRead(elapsedMs: number, ok: boolean, now = Date.now()) {
  const ms = Math.max(0, Number(elapsedMs) || 0);
  samples.push({ at: now, ms, ok });
  while (samples.length > SAMPLE_LIMIT) samples.shift();
  emit();
}

export function classifyNetworkQuality(now = Date.now()): BuklodNetworkQuality {
  if (hint.isConnected === false || hint.isInternetReachable === false) {
    return 'offline';
  }

  const generation = String(hint.cellularGeneration ?? '').trim().toLowerCase();
  if (generation === '2g' || generation === '3g') {
    return 'degraded';
  }

  const recent = samples.filter(sample => now - sample.at <= SAMPLE_WINDOW_MS);
  if (recent.some(sample => !sample.ok || sample.ms >= DEGRADED_LATENCY_MS)) {
    return 'degraded';
  }

  return 'normal';
}

export function communityFirstPageLimit(quality: BuklodNetworkQuality) {
  return quality === 'degraded' ? 8 : 40;
}

export function communityPhotoPrefetchBudget(quality: BuklodNetworkQuality) {
  if (quality === 'offline') {
    return { concurrency: 0, burst: 0 };
  }

  // On a weak link, visible photos must win the connection. Cached photos
  // still render through expo-image; only speculative requests are disabled.
  if (quality === 'degraded') {
    return { concurrency: 0, burst: 0 };
  }

  // Small, bounded warmup on healthy links avoids racing visible media.
  return { concurrency: 2, burst: 8 };
}

export function communityMediaResignDelayMs(
  attempt: number,
  randomUnit = Math.random(),
) {
  const exponent = Math.min(5, Math.max(0, Math.floor(attempt) || 0));
  const base = 800 * 2 ** exponent;
  const unit = Math.max(0, Math.min(0.999, Number(randomUnit) || 0));
  return Math.min(15_000, base + Math.floor(unit * 350));
}

export function resetNetworkQualityForTests() {
  samples.splice(0, samples.length);
  hint = {};
  emit();
}

export const COMMUNITY_DEGRADED_LATENCY_MS = DEGRADED_LATENCY_MS;
