/*
 * BUKLOD IGPAT browser autoplay controller.
 *
 * Stability goals:
 * - exactly one predominantly visible feed video is allowed to play;
 * - autoplay-policy failures retry muted instead of leaving a dead player;
 * - videos that become ready after the swipe receive a bounded retry;
 * - off-screen videos are paused to reduce CPU/network pressure;
 * - no route/UI/points/social behavior is changed here.
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
  const originalPause = HTMLMediaElement.prototype.pause;
  const visibility = new Map<HTMLVideoElement, number>();
  const retryCount = new WeakMap<HTMLVideoElement, number>();
  const retryTimers = new WeakMap<HTMLVideoElement, number>();
  let activeVideo: HTMLVideoElement | null = null;

  const clearRetry = (video: HTMLVideoElement) => {
    const timer = retryTimers.get(video);
    if (timer != null) window.clearTimeout(timer);
    retryTimers.delete(video);
  };

  const safePause = (video: HTMLVideoElement) => {
    clearRetry(video);
    try {
      if (!video.paused) originalPause.call(video);
    } catch {}
  };

  const scheduleRetry = (video: HTMLVideoElement) => {
    if (video !== activeVideo || document.hidden) return;
    const count = retryCount.get(video) ?? 0;
    if (count >= 4 || retryTimers.has(video)) return;
    retryCount.set(video, count + 1);
    const delay = 140 + count * 220;
    const timer = window.setTimeout(() => {
      retryTimers.delete(video);
      if (video === activeVideo && (visibility.get(video) ?? 0) >= 0.5) {
        void safePlay(video);
      }
    }, delay);
    retryTimers.set(video, timer);
  };

  const safePlay = async (video: HTMLVideoElement) => {
    if (video !== activeVideo || document.hidden) return;
    try {
      video.playsInline = true;
      video.preload = 'auto';
      const attempt = originalPlay.call(video);
      if (attempt && typeof attempt.then === 'function') await attempt;
      retryCount.set(video, 0);
      clearRetry(video);
      return;
    } catch (error: any) {
      const name = String(error?.name ?? '');
      const message = String(error?.message ?? '').toLowerCase();

      if (name === 'NotAllowedError' || message.includes('autoplay')) {
        try {
          video.muted = true;
          const retry = originalPlay.call(video);
          if (retry && typeof retry.then === 'function') await retry;
          retryCount.set(video, 0);
          clearRetry(video);
          return;
        } catch {}
      }

      // AbortError/NotSupportedError/early-ready races are retried only while
      // this remains the active predominantly visible feed video.
      scheduleRetry(video);
    }
  };

  // Preserve Expo's direct play calls, but make browser-policy failure safe.
  HTMLMediaElement.prototype.play = function patchedPlay(this: HTMLMediaElement) {
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

  const chooseActiveVideo = () => {
    let winner: HTMLVideoElement | null = null;
    let winnerRatio = 0;

    visibility.forEach((ratio, video) => {
      if (!video.isConnected) {
        visibility.delete(video);
        clearRetry(video);
        return;
      }
      if (ratio > winnerRatio) {
        winner = video;
        winnerRatio = ratio;
      }
    });

    const nextActive = winnerRatio >= 0.5 ? winner : null;
    if (activeVideo !== nextActive) {
      if (activeVideo) safePause(activeVideo);
      activeVideo = nextActive;
      if (activeVideo) retryCount.set(activeVideo, 0);
    }

    visibility.forEach((_ratio, video) => {
      if (video !== activeVideo) safePause(video);
    });

    if (activeVideo) void safePlay(activeVideo);
  };

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        const video = entry.target as HTMLVideoElement;
        visibility.set(video, entry.isIntersecting ? entry.intersectionRatio : 0);
      });
      chooseActiveVideo();
    },
    { threshold: [0, 0.1, 0.35, 0.5, 0.7, 0.9] },
  );

  window.__buklodIgpatObserver = observer;

  const attach = (video: HTMLVideoElement) => {
    if (visibility.has(video)) return;
    visibility.set(video, 0);
    video.playsInline = true;
    video.preload = 'metadata';
    observer.observe(video);

    const retryIfActive = () => {
      if (video === activeVideo && (visibility.get(video) ?? 0) >= 0.5) void safePlay(video);
    };
    video.addEventListener('loadeddata', retryIfActive);
    video.addEventListener('canplay', retryIfActive);
    video.addEventListener('stalled', retryIfActive);
  };

  const observeVideos = (root: ParentNode = document) => {
    root.querySelectorAll?.('video').forEach(node => attach(node as HTMLVideoElement));
  };

  const mutation = new MutationObserver(records => {
    records.forEach(record => {
      record.addedNodes.forEach(node => {
        if (!(node instanceof Element)) return;
        if (node.tagName === 'VIDEO') attach(node as HTMLVideoElement);
        observeVideos(node);
      });
    });
    chooseActiveVideo();
  });

  const onVisibilityChange = () => {
    if (document.hidden) {
      visibility.forEach((_ratio, video) => safePause(video));
      return;
    }
    chooseActiveVideo();
  };

  const start = () => {
    observeVideos();
    mutation.observe(document.documentElement, { childList: true, subtree: true });
    document.addEventListener('visibilitychange', onVisibilityChange);
    chooseActiveVideo();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
}

export {};
