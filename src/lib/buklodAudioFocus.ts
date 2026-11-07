/** Only explicit Play requests take focus; listeners pause competing audio. */
type Listener = (owner: string) => void;
const listeners = new Set<Listener>();
export function requestBuklodAudioFocus(owner: string) {
  if (!owner) return;
  for (const listener of [...listeners]) {
    try { listener(owner); } catch { /* isolated media failure */ }
  }
}
export function subscribeBuklodAudioFocus(listener: Listener) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
