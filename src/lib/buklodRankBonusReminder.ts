/**
 * Reminder scheduling is independent of ads. Only server-confirmed, eligible
 * and unredeemed cosmetic bonus records may be counted. A skipped ad never
 * forfeits a bonus. The delivery worker must persist a per-account reminder
 * cursor atomically, recheck pending grants, and respect notification consent.
 */
export const RANK_BONUS_REMINDER_POLICY = Object.freeze({
  firstDelayMs: 24 * 60 * 60 * 1000,
  repeatDelayMs: 72 * 60 * 60 * 1000,
  snoozeDelayMs: 7 * 24 * 60 * 60 * 1000,
  quietHoursStart: 21,
  quietHoursEnd: 8,
  collectionRoute: '/points/progression',
  retainOnSkip: true,
  retainOnAdUnavailable: true,
  automaticAd: false,
  aggregatePerAccount: true,
  expireOnDismiss: false,
});

export type VerifiedPendingRankBonus = {
  id: string;
  availableAtMs: number;
  status: 'unredeemed' | 'redeemed' | 'revoked';
};

export function planRankBonusReminder(input: {
  verifiedBonuses: readonly VerifiedPendingRankBonus[];
  nowMs: number;
  localHour: number;
  remindersEnabled: boolean;
  lastReminderMs?: number | null;
  snoozedUntilMs?: number | null;
}) {
  const p = RANK_BONUS_REMINDER_POLICY;
  const validClock = Number.isFinite(input.nowMs) && input.nowMs >= 0 &&
    Number.isInteger(input.localHour) && input.localHour >= 0 && input.localHour < 24;
  const ids = new Set(input.verifiedBonuses.filter(b =>
    b.status === 'unredeemed' && !!b.id && Number.isFinite(b.availableAtMs) &&
    b.availableAtMs >= 0 && b.availableAtMs <= input.nowMs
  ).map(b => b.id));
  const pendingCount = ids.size;
  const oldEnough = input.verifiedBonuses.some(b =>
    b.status === 'unredeemed' && ids.has(b.id) &&
    input.nowMs - b.availableAtMs >= p.firstDelayMs);
  const last = input.lastReminderMs;
  const snoozed = input.snoozedUntilMs;
  const cadenceOk = last == null || (Number.isFinite(last) && input.nowMs - last >= p.repeatDelayMs);
  const snoozeOk = snoozed == null || (Number.isFinite(snoozed) && input.nowMs >= snoozed);
  const shouldNotify = validClock && input.remindersEnabled && pendingCount > 0 &&
    oldEnough && cadenceOk && snoozeOk && input.localHour >= p.quietHoursEnd &&
    input.localHour < p.quietHoursStart;
  return { pendingCount, shouldNotify, notification: shouldNotify ? {
    title: 'May bonus collection ka pang naghihintay!',
    body: pendingCount === 1 ? 'May 1 cosmetic bonus ka pang hindi nare-redeem. Balikan ito kapag handa ka.' :
      'May ' + pendingCount + ' cosmetic bonuses ka pang hindi nare-redeem. Balikan ang iyong collections.',
    route: p.collectionRoute,
  } : null };
}
