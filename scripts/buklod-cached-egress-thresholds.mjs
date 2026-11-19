/**
 * Evaluates AUTHORITATIVE organization-wide Supabase monthly cached egress.
 * An edge-log estimate or current project's bytes cannot substitute for usage.
 * The provider adapter is intentionally absent until an authenticated, official
 * organization usage endpoint is verified. No notifications are sent by itself.
 */
export const QUOTA_ALERT_THRESHOLDS = Object.freeze([50, 70, 85, 95]);

export function evaluateCachedEgressQuota(snapshot, last = null) {
  if (!snapshot || snapshot.source !== 'SUPABASE_ORGANIZATION_USAGE') {
    return { status: 'UNVERIFIED', crossed: [], reason: 'Authoritative organization billing usage unavailable' };
  }
  const { cycleStart, usedGb, quotaGb } = snapshot;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cycleStart || '') ||
      !Number.isFinite(usedGb) || usedGb < 0 ||
      !Number.isFinite(quotaGb) || quotaGb <= 0) {
    return { status: 'UNVERIFIED', crossed: [], reason: 'Incomplete monthly quota snapshot' };
  }
  const percent = usedGb / quotaGb * 100;
  const previousPercent = last?.cycleStart === cycleStart && Number.isFinite(last?.usedGb) &&
      Number.isFinite(last?.quotaGb) && last.quotaGb > 0
    ? last.usedGb / last.quotaGb * 100 : 0;

  const crossed = QUOTA_ALERT_THRESHOLDS.filter(x => previousPercent < x && percent >= x);
  return { status: 'VERIFIED', cycleStart, usedGb, quotaGb,
    percent: Number(percent.toFixed(2)),
    crossed, severity: percent >= 95 ? 'RED' : percent >= 70 ? 'YELLOW' : 'GREEN' };
}
