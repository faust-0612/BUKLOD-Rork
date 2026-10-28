/**
 * Stagger independent BUKLOD devices when internet comes back.
 * One fixed delay creates a thundering herd after shared Wi-Fi/cellular loss.
 * The window only controls offline write replay, not immediate UI navigation.
 */
export const AUTO_SYNC_ACTIONS_PER_QUEUE = 8;
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_JITTER_MS = 6_000;

export function buklodReconnectDelayMs(randomUnit = Math.random()): number {
  const unit = Number(randomUnit);
  const normalized = Number.isFinite(unit)
    ? Math.max(0, Math.min(0.999999, unit))
    : 0;
  return RECONNECT_BASE_MS + Math.floor(normalized * RECONNECT_JITTER_MS);
}
