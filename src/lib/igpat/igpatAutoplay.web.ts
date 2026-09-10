/*
 * Browser autoplay hardening for BUKLOD IGPAT.
 * Modern browsers may reject unmuted autoplay. We retry muted instead of leaving
 * a dead player, and we suppress AbortError races caused by rapid swipe/pause.
 */

declare global {
  interface Window {
    __buklodIgpatAutoplayPatched?: boolean;
  }
}

if (typeof window !== 'undefined' && typeof HTMLMediaElement !== 'undefined' && !window.__buklodIgpatAutoplayPatched) {
  window.__buklodIgpatAutoplayPatched = true;
  const originalPlay = HTMLMediaElement.prototype.play;

  HTMLMediaElement.prototype.play = function patchedPlay(this: HTMLMediaElement) {
    const attempt = originalPlay.call(this);
    if (!attempt || typeof attempt.catch !== 'function') return attempt;

    return attempt.catch(async (error: any) => {
      const name = String(error?.name ?? '');
      const message = String(error?.message ?? '');

      // Swipe/navigation can pause a player while play() is still pending.
      if (name === 'AbortError' || message.includes('interrupted by a call to pause')) {
        return;
      }

      // Browser autoplay policy: retry muted so visible IGPAT starts automatically.
      if (name === 'NotAllowedError' || message.toLowerCase().includes('autoplay')) {
        this.muted = true;
        try {
          await originalPlay.call(this);
          return;
        } catch (retryError: any) {
          if (String(retryError?.name ?? '') === 'AbortError') return;
          throw retryError;
        }
      }

      throw error;
    });
  } as typeof HTMLMediaElement.prototype.play;
}

export {};
