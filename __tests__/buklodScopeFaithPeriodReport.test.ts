jest.mock('@/lib/supabase', () => ({ supabase: { rpc: jest.fn() } }));

import { supabase } from '@/lib/supabase';
import {
  faithPeriodToCsvRows, fetchFaithPeriodReport, percentage, shiftFaithPeriodAnchor,
  type FaithPeriodResult,
} from '@/lib/buklodScopeFaithPeriodReport';

const payload = {
  scope_id: 'scope-1', scope_name: 'Mission Worker', period: 'week',
  start_date: '2026-10-26', end_date: '2026-11-01', as_of_date: '2026-11-01',
  expected_days: 7,
  totals: { active_members: 2, reading_approved_days: 7, devotion_completed_days: 4 },
  members: [
    { user_id: 'one', member_name: 'Member One', reading_submitted_days: 7,
      reading_approved_days: 6, devotion_completed_days: 4,
      lesson_approved_count: 2, lesson_stages: [{ stage_code: 101, approved_count: 2 }] },
    { user_id: 'two', member_name: '=HYPERLINK("bad")', reading_submitted_days: 0,
      reading_approved_days: 0, devotion_completed_days: 0, lesson_stages: [] },
  ],
};

describe('Faith Monitoring period reports', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('requests a bounded period and preserves each member name and progress', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: payload, error: null });
    const report = await fetchFaithPeriodReport('scope-1', 'week', '2026-11-01');
    expect(supabase.rpc).toHaveBeenCalledWith('buklod_scope_faith_monitoring_period_v3', {
      p_scope_id: 'scope-1', p_period: 'week', p_anchor_date: '2026-11-01',
    });
    expect(report.members).toHaveLength(2);
    expect(report.members[0].reading_approved_days).toBe(6);
    expect(report.members[0].lesson_stages).toEqual([{ stage_code: 101, approved_count: 2 }]);
    expect(report.members[1].reading_approved_days).toBe(0);
    expect(report.expected_days).toBe(7);
  });

  it('preserves scheduled versus actual completion and exports identical counts', async () => {
    const dates = [
      { scheduled_date: '2026-10-27', status: 'APPROVED', completion_dates: ['2026-10-28'] },
      { scheduled_date: '2026-10-28', status: 'APPROVED', completion_dates: ['2026-10-28'] },
    ];
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({ error: null, data: {
      ...payload, devotion_date_basis: 'scheduled', members: [{ ...payload.members[0],
        devotion_completed_days: 2, devotion_completed_count: 2,
        devotion_actual_completion_days: 1, devotion_dates: dates, kl_chapter_count: 3 }],
    } });
    const report = await fetchFaithPeriodReport('scope-1', 'week', '2026-11-01');
    expect(report.devotion_date_basis).toBe('scheduled');
    expect(report.members[0].devotion_dates).toEqual(dates);
    const csv = faithPeriodToCsvRows(report)[0];
    expect(csv['Devotion completed days']).toBe(2);
    expect(csv['Actual completion days']).toBe('1');
    expect(csv['KL verified chapters']).toBe('3');
    expect(csv['Children teaching sessions']).toBe('Not available');
  });

  it('falls back only for missing versioned RPC and labels legacy dates', async () => {
    (supabase.rpc as jest.Mock)
      .mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'buklod_scope_faith_monitoring_period_v3 not found' } })
      .mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'buklod_scope_faith_monitoring_period_v2 not found' } })
      .mockResolvedValueOnce({ data: payload, error: null });
    const report = await fetchFaithPeriodReport('scope-1', 'week', '2026-11-01');
    expect(report.devotion_date_basis).toBe('legacy');
    expect(report.members[0].devotion_dates).toBeUndefined();
    expect(supabase.rpc).toHaveBeenLastCalledWith('buklod_scope_faith_monitoring_period_v1', expect.anything());
  });

  it('does not fall back after access denial', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'Not authorized' } });
    await expect(fetchFaithPeriodReport('scope-1', 'week', '2026-11-01')).rejects.toThrow('authorized workspace leaders');
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
  });

  it('rejects cross-scope data without displaying another workspace roster', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({
      error: null, data: { ...payload, scope_id: 'another-scope' },
    });
    await expect(fetchFaithPeriodReport('scope-1', 'week', '2026-11-01')).rejects.toThrow(
      'workspace report is unavailable',
    );
  });

  it('keeps weekly and monthly dates calendar-correct, including month ends', () => {
    expect(shiftFaithPeriodAnchor('2026-11-01', 'week', -1)).toBe('2026-10-25');
    expect(shiftFaithPeriodAnchor('2026-03-31', 'month', -1)).toBe('2026-02-01');
    expect(shiftFaithPeriodAnchor('2026-12-31', 'month', 1)).toBe('2027-01-01');
    expect(percentage(6, 7)).toBe(86);
    expect(percentage(0, 0)).toBe(0);
  });

  it('exports named rows and prevents member names from becoming CSV formulas', () => {
    const report = { ...payload, members: payload.members } as FaithPeriodResult;
    const rows = faithPeriodToCsvRows(report);
    expect(rows).toHaveLength(2);
    expect(rows[0]['Member name']).toBe('Member One');
    expect(rows[0]['Reading approved %']).toBe(86);
    expect(rows[1]['Member name']).toBe('\'=HYPERLINK("bad")');
  });

  it('returns an actionable warning when migration has not deployed', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({
      data: null, error: { code: 'PGRST202', message: 'Could not find the function in the schema cache' },
    });
    await expect(fetchFaithPeriodReport('scope-1', 'month', '2026-11-01')).rejects.toThrow(
      'reporting database update',
    );
  });
});
