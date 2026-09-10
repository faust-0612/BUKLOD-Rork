/*
 * BUKLOD IGPAT browser autoplay controller.
 * Keeps exactly the most-visible IGPAT video playing as the user swipes.
 * Browser policy fallback retries muted. User pause is respected until the
 * video leaves the viewport and becomes active again on a later swipe.
 */

declare global {
  interface Window {
    __buklodIgpatAutoplayPatched?: boolean;
    __buklodIgpatObserver?: IntersectionObserver;
  }
}

if (
  typeof window !== 'undefined' &&
  typeof HTMLMediaElement !== 'undefined' &&
  !window.__buklodIgpatAutoplayPatched
) {
  window.__buklodIgpatAutoplayPatched = true;

  const originalPlay = HTMLMediaElement.prototype.play;
  const manuallyPaused = new WeakSet<HTMLMediaElement>();
  const visibility = new Map<HTMLMediaElement, number>();

  const safePlay = async (media: HTMLMediaElement) => {
    try {
      const attempt = originalPlay.call(media);
      if (attempt && typeof attempt.then === 'function') await attempt;
    } catch (error: any) {
      const name = String(error?.name ?? '');
      const message = String(error?.message ?? '').toLowerCase();
      if (name === 'AbortError' || message.includes('interrupted by a call to pause')) return;
      if (name === 'NotAllowedError' || message.includes('autoplay')) {
        media.muted = true;
        try {
          const retry = originalPlay.call(media);
          if (retry && typeof retry.then === 'function') await retry;
        } catch (retryError: any) {
          if (String(retryError?.name ?? '') !== 'AbortError') throw retryError;
        }
      }
    }
  };

  // Keep the old play hardening too, because expo-video may call play directly.
  HTMLMediaElement.prototype.play = function patchedPlay(this: HTMLMediaElement) {
    manuallyPaused.delete(this);
    const attempt = originalPlay.call(this);
    if (!attempt || typeof attempt.catch !== 'function') return attempt;
    return attempt.catch(async (error: any) => {
      const name = String(error?.name ?? '');
      const message = String(error?.message ?? '').toLowerCase();
      if (name === 'AbortError' || message.includes('interrupted by a call to pause')) return;
      if (name === 'NotAllowedError' || message.includes('autoplay')) {
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

  const originalPause = HTMLMediaElement.prototype.pause;
  HTMLMediaElement.prototype.pause = function patchedPause(this: HTMLMediaElement) {
    manuallyPaused.add(this);
    return originalPause.call(this);
  } as typeof HTMLMediaElement.prototype.pause;

  const chooseActiveVideo = () => {
    let winner: HTMLMediaElement | null = null;
    let winnerRatio = 0;

    visibility.forEach((ratio, media) => {
      if (!media.isConnected) {
        visibility.delete(media);
        return;
      }
      if (ratio > winnerRatio) {
        winner = media;
        winnerRatio = ratio;
      }
    });

    visibility.forEach((ratio, media) => {
      if (media === winner && winnerRatio >= 0.55) {
        // Leaving and re-entering a page resets an earlier manual pause.
        if (ratio >= 0.55) manuallyPaused.delete(media);
        if (!manuallyPaused.has(media)) void safePlay(media);
      } else if (!media.paused) {
        originalPause.call(media);
      }
    });
  };

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        const media = entry.target as HTMLMediaElement;
        const previous = visibility.get(media) ?? 0;
        visibility.set(media, entry.isIntersecting ? entry.intersectionRatio : 0);
        if (previous >= 0.55 && entry.intersectionRatio < 0.2) {
          manuallyPaused.delete(media);
        }
      });
      chooseActiveVideo();
    },
    { threshold: [0, 0.2, 0.55, 0.75, 0.9] },
  );

  window.__buklodIgpatObserver = observer;

  const observeVideos = (root: ParentNode = document) => {
    root.querySelectorAll?.('video').forEach(video => observer.observe(video));
  };

  const mutation = new MutationObserver(records => {
    records.forEach(record => {
      record.addedNodes.forEach(node => {
        if (!(node instanceof Element)) return;
        if (node.tagName === 'VIDEO') observer.observe(node as HTMLVideoElement);
        observeVideos(node);
      });
    });
  });

  const start = () => {
    observeVideos();
    mutation.observe(document.documentElement, { childList: true, subtree: true });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
}

export {};
