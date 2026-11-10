/**
 * Optional Community comment ads, separate from the server's BUKLOD Points
 * qualification, daily caps and anti-farming checks. There is no comment
 * submission/claim gate, rewarded credit, or dependency on ad availability.
 *
 * Counts only server-confirmed comment submissions. The first five daily
 * successes are ad-free; the sixth and every fifth additional success queue
 * at most one optional interstitial for the NEXT natural editor close.
 * Manila-day and account isolation; intentionally ephemeral on app restart.
 */
export const COMMUNITY_COMMENT_AD_FREE_ACTIONS = 5;
export const COMMUNITY_COMMENT_AD_EXTRA_INTERVAL = 5;
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const MAX_ACCOUNTS = 64;

type AdSession = {
  dayKey: string;
  successful: number;
  pending: boolean;
};
const sessions = new Map<string, AdSession>();

function dayKey(now: Date): string {
  return new Date(now.getTime() + MANILA_OFFSET_MS).toISOString().slice(0, 10);
}

function sessionFor(accountId: string, now: Date): AdSession | null {
  const id = String(accountId ?? '').trim();
  if (!id) return null;
  const today = dayKey(now);
  const cached = sessions.get(id);
  if (cached?.dayKey === today) return cached;
  const session: AdSession = { dayKey: today, successful: 0, pending: false };
  sessions.delete(id);
  sessions.set(id, session);
  while (sessions.size > MAX_ACCOUNTS) {
    const oldest = sessions.keys().next().value;
    if (!oldest) break;
    sessions.delete(oldest);
  }
  return session;
}

export function recordConfirmedCommunityComment(
  accountId: string,
  now: Date = new Date(),
): { successful: number; shouldWarm: boolean } {
  const state = sessionFor(accountId, now);
  if (!state) return { successful: 0, shouldWarm: false };
  state.successful += 1;
  const extra = state.successful - COMMUNITY_COMMENT_AD_FREE_ACTIONS;
  if (extra > 0 && (extra - 1) % COMMUNITY_COMMENT_AD_EXTRA_INTERVAL === 0) {
    state.pending = true;
  }
  return {
    successful: state.successful,
    shouldWarm: state.successful >= COMMUNITY_COMMENT_AD_FREE_ACTIONS &&
      (state.successful - COMMUNITY_COMMENT_AD_FREE_ACTIONS) %
        COMMUNITY_COMMENT_AD_EXTRA_INTERVAL === 0,
  };
}

export function takePendingCommunityCommentAdBreak(
  accountId: string,
  now: Date = new Date(),
): boolean {
  const state = sessionFor(accountId, now);
  if (!state?.pending) return false;
  state.pending = false;
  return true;
}

