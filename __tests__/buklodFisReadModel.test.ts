import { buildFisReadModel, createFisCsv, previousFisMonth } from '@/lib/buklodFisReadModel';
import type { CanonicalAdminEconomySnapshot } from '@/lib/buklodCanonicalAdminEconomy';

const specimen = {
  period_key: '2026-11',
  finance: {
    period_key: '2026-11',
    policy: { version: 'v3' },
    controls: { economics_enabled: false, settlement_enabled: false, withdrawal_enabled: false, payout_processing_enabled: false },
    settlement: null,
    user_shares: [],
    community_allocations: [],
    financial_entries: [
      { id: '1', entry_type: 'AD_REVENUE', direction: 'CREDIT', amount_php: 25, reconciliation_state: 'RECONCILED', source_system: 'admob', created_at: '2026-11-10' },
      { id: '2', entry_type: 'OTHER_COST', direction: 'DEBIT', amount_php: 10, reconciliation_state: 'RECONCILED', source_system: 'ops', created_at: '2026-11-10' },
      { id: '3', entry_type: '=FORMULA', direction: 'CREDIT', amount_php: 999, reconciliation_state: 'ESTIMATED', source_system: '=bad', created_at: '2026-11-10' },
    ],
  },
  qmp: { period_key: '2026-11', period_exists: true, month_complete: false, ready_for_finalization: false },
} as unknown as CanonicalAdminEconomySnapshot;

describe('BUKLOD FIS canonical reporting', () => {
  it('handles Manila-year rollover', () => {
    expect(previousFisMonth('2026-01')).toBe('2025-12');
    expect(previousFisMonth('2026-02')).toBe('2026-01');
    expect(() => previousFisMonth('2026-13')).toThrow();
  });
  it('does not present provisional revenue as reconciled or finalized cash', () => {
    const m = buildFisReadModel(specimen, null);
    expect(m.journalReconciledCredits).toBe(25);
    expect(m.journalReconciledDebits).toBe(10);
    expect(m.journalPendingAmount).toBe(999);
    expect(m.journalPendingCount).toBe(1);
    expect(m.finalized).toBe(false);
    expect(m.settlementNet).toBeNull();
    expect(m.retained).toBeNull();
    expect(m.payoutDataAvailable).toBe(false);
    expect(m.closeReady).toBe(false);
  });
  it('produces capped safe CSV without payout destinations', () => {
    const csv = createFisCsv(specimen);
    expect(csv).toContain("'=bad");
    expect(csv).toContain("'=FORMULA");
    expect(csv).not.toContain('payout_destination');
  });
});
