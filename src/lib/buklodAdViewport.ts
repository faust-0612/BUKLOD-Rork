import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Dimensions, type View } from 'react-native';

const SETTLE_MS = 400;
const POLL_MS = 1200;

/**
 * Gates ad requests until the slot has been on-screen briefly.
 * Prevents off-screen Home/feed banners from requesting before they can impression.
 */
export function useBuklodAdViewportGate() {
  const ref = useRef<View>(null);
  const [eligible, setEligible] = useState(false);
  const settleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sample = useCallback(() => {
    if (eligible) return;

    ref.current?.measureInWindow((x, y, width, height) => {
      const window = Dimensions.get('window');
      const onScreen =
        width >= 8 &&
        height >= 8 &&
        y < window.height - 8 &&
        y + height > 8 &&
        x < window.width &&
        x + width > 0;

      if (onScreen) {
        if (!settleRef.current) {
          settleRef.current = setTimeout(() => {
            settleRef.current = null;
            setEligible(true);
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
    if (eligible) {
      return;
    }

    sample();
    const poll = setInterval(sample, POLL_MS);
    const app = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        sample();
      }
    });

    return () => {
      clearInterval(poll);
      app.remove();
      if (settleRef.current) {
        clearTimeout(settleRef.current);
        settleRef.current = null;
      }
    };
  }, [eligible, sample]);

  return { ref, eligible };
}
