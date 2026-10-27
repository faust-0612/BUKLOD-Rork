import { communityQmpMetrics } from '../src/lib/buklodEconomyQmp';

describe('Community QMP economy reporting', () => {
  it('shows actual monthly QMP, total QMP and percentage instead of Profit-First gated zero', () => {
    const result = communityQmpMetrics({
      period: { key: '2026-10' },
      this_month_qmp: 168,
      total_qualified_qmp: 5221,
      share_weight: 168 / 5221,
    });
    expect(result?.monthlyQmp).toBe(168);
    expect(result?.totalQmp).toBe(5221);
    expect(result?.participationPct).toBeCloseTo(3.2178, 3);
    expect(result?.periodKey).toBe('2026-10');
  });

  it('preserves real zero only when the backend returned a valid period and counts', () => {
    expect(communityQmpMetrics({
      period: { key: '2026-10' },
      this_month_qmp: 0,
      total_qualified_qmp: 0,
      share_weight: 0,
    })).toMatchObject({ monthlyQmp: 0, totalQmp: 0, participationPct: 0 });
  });

  it('does not mistake absent, impossible or malformed data for zero', () => {
    expect(communityQmpMetrics(null)).toBeNull();
    expect(communityQmpMetrics({ period: { key: '2026-10' } })).toBeNull();
    expect(communityQmpMetrics({ period: { key: '2026-13' }, this_month_qmp: 1, total_qualified_qmp: 2 })).toBeNull();
    expect(communityQmpMetrics({ period: { key: '2026-10' }, this_month_qmp: 3, total_qualified_qmp: 2 })).toBeNull();
    expect(communityQmpMetrics({ period: { key: '2026-10' }, this_month_qmp: -1, total_qualified_qmp: 2 })).toBeNull();
    expect(communityQmpMetrics({ period: { key: '2026-10' }, this_month_qmp: 1, total_qualified_qmp: 2, share_weight: 3 })).toBeNull();
  });

  it('can derive participation from canonical QMP counts if the weight field is absent', () => {
    expect(communityQmpMetrics({
      period: { key: '2026-10' },
      this_month_qmp: 25,
      total_qualified_qmp: 100,
    })?.participationPct).toBe(25);
  });
});
