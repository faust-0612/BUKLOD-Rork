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
export function emitBuklodEmergencySignal(signal: BuklodEmergencySignal) {
  if (!isBuklodEmergencyId(signal.incidentId)) return;
  for (const handler of listeners) {
    try { handler(signal); } catch { /* a bad view must never abort SOS dispatch */ }
  }
}
