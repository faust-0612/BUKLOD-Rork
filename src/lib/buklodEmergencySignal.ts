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
const UUID = /^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;

export function isBuklodEmergencyId(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}
export function subscribeBuklodEmergencySignal(handler: Handler) {
  listeners.add(handler);
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
  return delivered;
}
