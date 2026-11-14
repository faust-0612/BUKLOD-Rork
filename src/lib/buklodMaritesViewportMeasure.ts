/**
 * Bound native viewport measurements during fast Wall/Marites scrolling.
 * A burst of scroll events must not enqueue one measureInWindow per frame.
 * Focus/visibility transitions use flush() to pause playback immediately.
 * No video/audio/AdMob lifecycle is modified by this scheduler.
 */
export type MaritesVisibilityClock = {
  now: () => number;
  schedule: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
  cancel: (handle: ReturnType<typeof setTimeout>) => void;
};

const systemClock: MaritesVisibilityClock = {
  now: () => Date.now(),
  schedule: (callback, delayMs) => setTimeout(callback, delayMs),
  cancel: handle => clearTimeout(handle),
};

export function createMaritesVisibilityScheduler(
  measure: () => void,
  clock: MaritesVisibilityClock = systemClock,
  minSpacingMs = 96,
) {
  let pending: ReturnType<typeof setTimeout> | null = null;
  let lastMeasureAt = Number.NEGATIVE_INFINITY;

  const cancel = () => {
    if (pending !== null) {
      clock.cancel(pending);
      pending = null;
    }
  };
  const deliver = () => {
    pending = null;
    lastMeasureAt = clock.now();
    measure();
  };

  return {
    request() {
      if (pending !== null) return;
      const delayMs = Math.max(0, Math.ceil(lastMeasureAt + minSpacingMs - clock.now()));
      if (delayMs === 0) deliver();
      else pending = clock.schedule(deliver, delayMs);
    },
    flush() {
      // Changes to app focus, composer, or fullscreen must never wait for a
      // throttled scroll update before an offscreen video is unmounted.
      cancel();
      deliver();
    },
    cancel,
  };
}

/** Fullscreen Marites and Wall inline video must not own playback together. */
export type BuklodWallMaritesPriorityInput = {
  wallFocused: boolean;
  wallVideoVisible: boolean;
  wallFullscreenOpen: boolean;
  commentOpen: boolean;
  maritesViewerOpen: boolean;
};

export function resolveBuklodWallMaritesVideoPriority(input: BuklodWallMaritesPriorityInput) {
  return {
    wallVideoEligible: input.wallFocused && !input.wallFullscreenOpen && !input.maritesViewerOpen,
    maritesBlocked: !input.wallFocused || input.commentOpen || input.wallFullscreenOpen ||
      (input.wallVideoVisible && !input.maritesViewerOpen),
  };
}
