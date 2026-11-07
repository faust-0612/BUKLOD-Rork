/**
 * BUKLOD SOS screen coordination (no network, no stored coordinates).
 * Notification payloads are untrusted. Receivers must verify the signed-in
 * account's canonical notification row and the active proximity-gated RPC
 * before showing any incident details or enabling response actions.
 */
export type BuklodEmergencySignal = {
  incidentId: string;
  origin: 'sender' | 'recipient';
};
type Handler = (signal: BuklodEmergencySignal) => void;
const listeners = new Set<Handler>();
// Cold-launch notifications may arrive before the root SOS host mounts.
// Retain only UUID + origin, never coordinates/identity/content. Bound the
// queue so stale notifications cannot keep resurfacing after a long delay.
const MAX_QUEUED_SIGNALS = 4;
const PENDING_TTL_MS = 2 * 60 * 1000;
const pending: Array<{ signal: BuklodEmergencySignal; queuedAt: number }> = [];
const UUID = /^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;

export function isBuklodEmergencyId(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}
export function subscribeBuklodEmergencySignal(handler: Handler) {
  listeners.add(handler);
  if (pending.length) {
    const now = Date.now();
    const queued = pending.splice(0);
    for (const entry of queued) {
      if (now - entry.queuedAt > PENDING_TTL_MS) continue;
      try { handler(entry.signal); } catch { /* host failure must not crash app */ }
    }
  }
  return () => { listeners.delete(handler); };
}
/**
 * Returns whether a mounted subscriber accepted the incident handoff.
 * If no global host is ready (for example on a cold notification launch),
 * the notification router can restore the locked R1 Community deep link.
 * Neither path authorizes displaying data until host RLS/proximity checks.
 */
export function emitBuklodEmergencySignal(signal: BuklodEmergencySignal): boolean {
  if (!isBuklodEmergencyId(signal.incidentId)) return false;
  let delivered = false;
  for (const handler of listeners) {
    try {
      handler(signal);
      delivered = true;
    } catch {
      // A bad view must never abort SOS notification navigation.
    }
  }
  if (!delivered) {
    const now = Date.now();
    for (let index = pending.length - 1; index >= 0; index--) {
      if (now - pending[index].queuedAt > PENDING_TTL_MS ||
          pending[index].signal.incidentId === signal.incidentId) {
        pending.splice(index, 1);
      }
    }
    pending.push({ signal, queuedAt: now });
    if (pending.length > MAX_QUEUED_SIGNALS) {
      pending.splice(0, pending.length - MAX_QUEUED_SIGNALS);
    }
  }
  return delivered;
}
