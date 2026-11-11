import type { BuklodPfQmpReadiness } from '@/lib/buklodR38AdminEconomy';

/**
 * System-admin display only. The server's canonical readiness remains the
 * final authority. These descriptions never turn on settlement or create cash.
 */
export function getBuklodFinanceMonthCloseBlockers(
  readiness: BuklodPfQmpReadiness | null | undefined,
  controls: { economics_enabled?: boolean; settlement_enabled?: boolean } | null | undefined,
): string[] {
  if (!readiness || !readiness.period_exists) {
    return ['Read-only canonical QMP/Finance readiness is unavailable'];
  }

  const blocked: string[] = [];
  if (readiness.qmp_period_status !== 'OPEN' ||
      (readiness.canonical_finalized_months ?? 0) > 0) {
    blocked.push('Month is not an unfinalized OPEN period');
  }
  if (readiness.month_complete !== true) blocked.push('Calendar month has not ended');
  if ((readiness.unlinked_finance_identities ?? 0) > 0) {
    blocked.push(`${readiness.unlinked_finance_identities} qualified accounts lack canonical Finance identity links`);
  }
  if ((readiness.ineligible_or_risk_held ?? 0) > 0) {
    blocked.push(`${readiness.ineligible_or_risk_held} accounts are ineligible or risk-held`);
  }
  if ((readiness.pending_qmp_reviews ?? 0) > 0 || (readiness.held_qmp_reviews ?? 0) > 0) {
    blocked.push('QMP reviews or held contributions remain unresolved');
  }
  if ((readiness.legacy_share_records ?? 0) > 0) {
    blocked.push('Legacy allocations need reconciliation before canonical settlement');
  }
  if ((readiness.reconciled_eligible_revenue_sources ?? 0) <= 0) {
    blocked.push('No verified reconciled eligible revenue; AdMob estimates and BP cannot create cash');
  }
  if (controls?.economics_enabled !== true || readiness.finance_enabled !== true) {
    blocked.push('Finance economics remain disabled');
  }
  if (controls?.settlement_enabled !== true || readiness.settlement_enabled !== true) {
    blocked.push('Canonical settlement remains disabled');
  }
  if (!blocked.length && readiness.ready_for_finalization !== true) {
    blocked.push('Server did not authorize finalization; inspect canonical readiness');
  }
  return blocked;
}
