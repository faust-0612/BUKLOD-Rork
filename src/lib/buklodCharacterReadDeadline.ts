/** Bounded, read-only Character state access. Never changes balances or unlocks. */
export const CHARACTER_SESSION_DEADLINE_MS = 9000;
export const CHARACTER_SELECTION_DEADLINE_MS = 12000;

export async function withBuklodCharacterReadDeadline<T>(
  request: Promise<T>,
  milliseconds: number,
  stage: 'session' | 'selection',
): Promise<T> {
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) throw new Error('Invalid Character read deadline');
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<T>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(stage === 'session'
        ? 'Character session timed out. Check your connection and reopen Character.'
        : 'Character data timed out. Check your connection and reopen Character.'));
    }, milliseconds);
  });
  try {
    return await Promise.race([request, deadline]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
