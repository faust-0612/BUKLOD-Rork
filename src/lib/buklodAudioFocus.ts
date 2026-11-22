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

// Transient PTT voice activity is not a permanent audio-focus takeover.
const pttVoiceListeners = new Set<(active: boolean) => void>();
let pttVoiceActive = false;

export function isBuklodPttVoiceActive() { return pttVoiceActive; }

export function setBuklodPttVoiceActive(active: boolean) {
  const value = Boolean(active);
  if (pttVoiceActive === value) return;
  pttVoiceActive = value;
  for (const listener of [...pttVoiceListeners]) {
    try { listener(value); } catch { /* optional audio client isolation */ }
  }
}

export function subscribeBuklodPttVoiceActivity(listener: (active: boolean) => void) {
  pttVoiceListeners.add(listener);
  listener(pttVoiceActive);
  return () => { pttVoiceListeners.delete(listener); };
}
