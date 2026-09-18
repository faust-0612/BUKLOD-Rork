import type { BuklodCharacterReaction } from '@/components/points/BuklodCharacterMotion';

export type BuklodGameCharacterMotionEvent = {
  id: number;
  type: BuklodCharacterReaction;
};

type Listener = (event: BuklodGameCharacterMotionEvent) => void;

const listeners = new Set<Listener>();
let sequence = 0;

export function emitBuklodGameCharacterMotion(type: BuklodCharacterReaction) {
  sequence += 1;
  const event = { id: sequence, type };
  for (const listener of listeners) listener(event);
}

export function subscribeBuklodGameCharacterMotion(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
