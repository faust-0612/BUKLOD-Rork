/*
 * The startup logo stays on screen until the trusted-device fingerprint
 * prompt has finished. The prompt resizes the Android window, so hiding
 * the logo at that moment makes the mark jump upward.
 */

type Listener = () => void;

let ready = false;
const listeners = new Set<Listener>();

export function markBuklodStartupChromeReady() {
  if (ready) {
    return;
  }

  ready = true;
  listeners.forEach(listener => listener());
  listeners.clear();
}

export function subscribeBuklodStartupChromeReady(
  listener: Listener
) {
  if (ready) {
    listener();
    return () => {};
  }

  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
