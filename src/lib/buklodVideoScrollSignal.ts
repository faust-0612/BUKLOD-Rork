/** Shared playback pause: one clock, no hidden audio while a feed scrolls. */
export const BUKLOD_VIDEO_SCROLL_IDLE_MS = 180;
type Listener = (scrolling: boolean) => void;
const listeners = new Set<Listener>();
let scrolling = false;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
export function subscribeBuklodVideoScroll(listener: Listener) {
  listeners.add(listener);
  listener(scrolling);
  return () => { listeners.delete(listener); };
}
export function noteBuklodVideoScroll() {
  if (!scrolling) {
    scrolling = true;
    listeners.forEach(listener => listener(true));
  }
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    idleTimer = null;
    scrolling = false;
    listeners.forEach(listener => listener(false));
  }, BUKLOD_VIDEO_SCROLL_IDLE_MS);
}
