import type { BuklodGameFeedbackEvent } from './feedbackTypes';

/**
 * A small global limiter shared by native/web game-feedback adapters.
 * It intentionally never suppresses a different event's terminal feedback:
 * a move immediately followed by success must still sound successful.
 * No timers, jobs, network, or shared user data.
 */
const cooldowns: Record<BuklodGameFeedbackEvent, number> = {
  move: 110,
  collect: 80,
  impact: 180,
  success: 450,
  unlock: 450,
  failure: 450,
};

export function createBuklodGameFeedbackLimiter(now: () => number = Date.now) {
  const last = new Map<BuklodGameFeedbackEvent, number>();
  let lastNonTerminal = -Infinity;

  return function allow(event: BuklodGameFeedbackEvent): boolean {
    const timestamp = now();
    if (!Number.isFinite(timestamp)) return false;
    const previous = last.get(event) ?? -Infinity;
    if (timestamp - previous < cooldowns[event]) return false;

    const terminal = event === 'success' || event === 'unlock' || event === 'failure';
    if (!terminal && timestamp - lastNonTerminal < 55) return false;

    last.set(event, timestamp);
    if (!terminal) lastNonTerminal = timestamp;
    return true;
  };
}
