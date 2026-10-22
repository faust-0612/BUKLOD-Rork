import { useEffect, useRef, useState } from 'react';

export type MouthState =
  | 'NEUTRAL'
  | 'OPEN_SMALL'
  | 'OPEN_MEDIUM'
  | 'SMILE';

const TALK_CYCLE: readonly MouthState[] = [
  'NEUTRAL',
  'OPEN_SMALL',
  'OPEN_MEDIUM',
  'OPEN_SMALL',
  'NEUTRAL',
  'SMILE',
  'NEUTRAL',
];

const TALK_DURATIONS: Record<MouthState, number> = {
  NEUTRAL: 520,
  OPEN_SMALL: 180,
  OPEN_MEDIUM: 220,
  SMILE: 340,
};

/** Slow, deliberate mouth cycle while dialogue is visible. */
export function useBuklodCharacterTalk(
  talking: boolean,
  reduceMotion: boolean
): MouthState {
  const [mouth, setMouth] = useState<MouthState>('NEUTRAL');
  const stepRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (!talking || reduceMotion) {
      stepRef.current = 0;
      setMouth('NEUTRAL');
      return;
    }

    let cancelled = false;

    const tick = () => {
      const state = TALK_CYCLE[stepRef.current % TALK_CYCLE.length] ?? 'NEUTRAL';
      setMouth(state);
      stepRef.current += 1;

      timerRef.current = setTimeout(() => {
        if (!cancelled) tick();
      }, TALK_DURATIONS[state]);
    };

    tick();

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [reduceMotion, talking]);

  return mouth;
}
