import { useEffect, useRef, useState } from 'react';

import { MOTION } from '@/lib/character-lab-core/motion';

/** Irregular blink schedule — clipped-base approach, no separate lid assets. */
export function useBuklodCharacterBlink(
  alive: boolean,
  reduceMotion: boolean
) {
  const [lidsClosed, setLidsClosed] = useState(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setLidsClosed(false);

    if (!alive || reduceMotion) return;

    let cancelled = false;

    const schedule = () => {
      const {
        blinkMinGapMs,
        blinkMaxGapMs,
        blinkCloseMs,
        doubleBlinkChance,
      } = MOTION.idle;
      const gap =
        blinkMinGapMs +
        Math.random() * (blinkMaxGapMs - blinkMinGapMs);

      const gapTimer = setTimeout(() => {
        if (cancelled) return;
        setLidsClosed(true);

        const openTimer = setTimeout(() => {
          if (cancelled) return;
          setLidsClosed(false);

          if (Math.random() < doubleBlinkChance) {
            const doubleTimer = setTimeout(() => {
              if (cancelled) return;
              setLidsClosed(true);
              const doubleOpen = setTimeout(() => {
                if (cancelled) return;
                setLidsClosed(false);
                schedule();
              }, blinkCloseMs + 30);
              timersRef.current.push(doubleOpen);
            }, 140);
            timersRef.current.push(doubleTimer);
          } else {
            schedule();
          }
        }, blinkCloseMs + 40);

        timersRef.current.push(openTimer);
      }, gap);

      timersRef.current.push(gapTimer);
    };

    schedule();

    return () => {
      cancelled = true;
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, [alive, reduceMotion]);

  return lidsClosed;
}
