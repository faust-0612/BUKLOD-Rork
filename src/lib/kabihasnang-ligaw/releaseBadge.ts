/** Only an officially released chapter can carry a new-release badge. */
export function isNewKlRelease(latestId: string | null | undefined, seenId: string | null | undefined): boolean {
  return Boolean(latestId && latestId !== seenId);
}

/** Rewards are only attributed to server-confirmed first completions. */
export function verifiedChapterReward(result: {
  completed?: boolean;
  new_completion?: boolean;
  points_awarded?: number;
} | null | undefined): number {
  return result?.new_completion === true && result.completed !== false
    ? Math.max(0, Number(result.points_awarded) || 0)
    : 0;
}
