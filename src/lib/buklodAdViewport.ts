import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Dimensions, type View } from 'react-native';
import { isBuklodAdSlotVisible } from '@/lib/buklodAdViewportVisibility';

const SETTLE_MS = 400;
const POLL_MS = 1200;

const isForeground = () => AppState.currentState !== 'background' &&
  AppState.currentState !== 'inactive';

// Share ONE polling clock and ONE foreground listener across all mounted ad
// probes. A feed can mount many sponsored rows; per-slot intervals and AppState
// subscriptions otherwise accumulate JS/native work on every dashboard switch.
// Every slot still measures its OWN viewport after the existing settle delay.
type ViewportProbe = (active: boolean) => void;
const viewportProbes = new Set<ViewportProbe>();
let viewportPollTimer: ReturnType<typeof setInterval> | null = null;
let viewportAppState: ReturnType<typeof AppState.addEventListener> | null = null;

function subscribeViewportProbe(probe: ViewportProbe) {
  viewportProbes.add(probe);
  if (!viewportPollTimer) {
    viewportPollTimer = setInterval(() => {
      if (!isForeground()) return;
      for (const activeProbe of viewportProbes) activeProbe(true);
    }, POLL_MS);
  }
  if (!viewportAppState) {
    viewportAppState = AppState.addEventListener('change', state => {
      const active = state === 'active';
      for (const activeProbe of viewportProbes) activeProbe(active);
    });
  }

  let unsubscribed = false;
  return () => {
    if (unsubscribed) return;
    unsubscribed = true;
    viewportProbes.delete(probe);
    if (viewportProbes.size !== 0) return;
    if (viewportPollTimer) {
      clearInterval(viewportPollTimer);
      viewportPollTimer = null;
    }
    viewportAppState?.remove();
    viewportAppState = null;
  };
}

/**
 * Keep the existing 400 ms on-screen threshold, but verify position AGAIN
 * after the threshold. A rapidly scrolled-out ad must not allocate a native
 * creative merely because it was on screen when the timer started.
 * This is an ad-slot hook only; never touches video player lifecycle.
 */
export function useBuklodAdViewportGate() {
  const ref = useRef<View>(null);
  const [eligible, setEligible] = useState(false);
  const settleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generationRef = useRef(0);

  const sample = useCallback(() => {
    if (eligible || !isForeground()) return;
    const generation = generationRef.current;
    ref.current?.measureInWindow((x, y, width, height) => {
      if (generation !== generationRef.current || !isForeground()) return;
      const onScreen = isBuklodAdSlotVisible(
        { x, y, width, height },
        Dimensions.get('window'),
      );

      if (onScreen) {
        if (!settleRef.current) {
          settleRef.current = setTimeout(() => {
            settleRef.current = null;
            if (generation !== generationRef.current || !isForeground()) return;
            // The slot may have scrolled away during the 400 ms settle window.
            ref.current?.measureInWindow((sx, sy, sw, sh) => {
              if (generation !== generationRef.current || !isForeground()) return;
              if (isBuklodAdSlotVisible(
                { x: sx, y: sy, width: sw, height: sh },
                Dimensions.get('window'),
              )) {
                setEligible(true);
              }
            });
          }, SETTLE_MS);
        }
        return;
      }

      if (settleRef.current) {
        clearTimeout(settleRef.current);
        settleRef.current = null;
      }
    });
  }, [eligible]);

  useEffect(() => {
    ++generationRef.current;
    if (eligible) return;
    const unsubscribe = subscribeViewportProbe(active => {
      if (active) sample();
      else if (settleRef.current) {
        clearTimeout(settleRef.current);
        settleRef.current = null;
      }
    });
    // First-view inventory starts measuring immediately, without waiting for
    // the shared clock; the 400ms recheck still prevents off-screen requests.
    sample();
    return () => {
      ++generationRef.current;
      unsubscribe();
      if (settleRef.current) {
        clearTimeout(settleRef.current);
        settleRef.current = null;
      }
    };
  }, [eligible, sample]);

  return { ref, eligible };
}
