import { supabase } from '@/lib/supabase';

export type FaithPeriod = 'week' | 'month';
export type FaithPeriodStage = { stage_code: number; approved_count: number };
export type FaithPeriodMember = {
  user_id: string;
  member_name: string;
  reading_submitted_days: number;
  reading_approved_days: number;
  reading_revision_days: number;
  devotion_submitted_days: number;
  devotion_completed_days: number;
  devotion_revision_days: number;
  lesson_approved_count: number;
  lesson_pending_count: number;
  lesson_stages: FaithPeriodStage[];
};
export type FaithPeriodResult = {
  scope_id: string;
  scope_name: string;
  period: FaithPeriod;
  start_date: string;
  end_date: string;
  as_of_date: string;
  expected_days: number;
  totals: {
    active_members: number;
    reading_submitted_days: number;
    reading_approved_days: number;
    devotion_submitted_days: number;
    devotion_completed_days: number;
    lesson_approved_count: number;
    lesson_pending_count: number;
    members_with_activity: number;
  };
  members: FaithPeriodMember[];
};

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}
function nonnegative(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
}

export function todayInManila(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const part = (name: string) => parts.find((p) => p.type === name)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function shiftFaithPeriodAnchor(anchor: string, period: FaithPeriod, offset: number): string {
  const date = new Date(`${anchor}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return anchor;
  if (period === 'week') date.setUTCDate(date.getUTCDate() + 7 * offset);
  else {
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + offset);
  }
  return date.toISOString().slice(0, 10);
}

export function percentage(value: number, denominator: number): number {
  if (!denominator) return 0;
  return Math.min(100, Math.round(100 * value / denominator));
}

export async function fetchFaithPeriodReport(
  scopeId: string, period: FaithPeriod, anchor: string,
): Promise<FaithPeriodResult> {
  const { data, error } = await supabase.rpc('buklod_scope_faith_monitoring_period_v1' as any, {
    p_scope_id: scopeId, p_period: period, p_anchor_date: anchor,
  } as any);
  if (error) {
    const message = String(error.message ?? '');
    if (error.code === '42501' || /not authorized|authentication required/i.test(message)) {
      throw new Error('Only authorized workspace leaders can view this report.');
    }
    if (/could not find the function|does not exist|schema cache/i.test(message)) {
      throw new Error('Weekly and monthly reports are not available until the reporting database update is applied.');
    }
    throw error;
  }
  const raw = object(data);
  if (raw.scope_id !== scopeId || raw.period !== period || !Array.isArray(raw.members)) {
    throw new Error('This workspace report is unavailable. Please retry.');
  }
  const totals = object(raw.totals);
  const validDate = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value : '';
  const start = validDate(raw.start_date), end = validDate(raw.end_date), through = validDate(raw.as_of_date);
  if (!start || !end || !through) throw new Error('The report date range was invalid.');
  return {
    scope_id: scopeId,
    scope_name: String(raw.scope_name ?? 'Workspace'),
    period,
    start_date: start, end_date: end, as_of_date: through,
    expected_days: Math.min(31, nonnegative(raw.expected_days)),
    totals: {
      active_members: nonnegative(totals.active_members),
      reading_submitted_days: nonnegative(totals.reading_submitted_days),
      reading_approved_days: nonnegative(totals.reading_approved_days),
      devotion_submitted_days: nonnegative(totals.devotion_submitted_days),
      devotion_completed_days: nonnegative(totals.devotion_completed_days),
      lesson_approved_count: nonnegative(totals.lesson_approved_count),
      lesson_pending_count: nonnegative(totals.lesson_pending_count),
      members_with_activity: nonnegative(totals.members_with_activity),
    },
    members: raw.members.flatMap((value: unknown) => {
      const row = object(value);
      if (typeof row.user_id !== 'string') return [];
      return [{
        user_id: row.user_id,
        member_name: String(row.member_name || 'Member'),
        reading_submitted_days: nonnegative(row.reading_submitted_days),
        reading_approved_days: nonnegative(row.reading_approved_days),
        reading_revision_days: nonnegative(row.reading_revision_days),
        devotion_submitted_days: nonnegative(row.devotion_submitted_days),
        devotion_completed_days: nonnegative(row.devotion_completed_days),
        devotion_revision_days: nonnegative(row.devotion_revision_days),
        lesson_approved_count: nonnegative(row.lesson_approved_count),
        lesson_pending_count: nonnegative(row.lesson_pending_count),
        lesson_stages: (Array.isArray(row.lesson_stages) ? row.lesson_stages : []).flatMap((item: unknown) => {
          const stage = object(item);
          const code = Number(stage.stage_code);
          return Number.isInteger(code) && code >= 101 && code <= 107
            ? [{ stage_code: code, approved_count: nonnegative(stage.approved_count) }] : [];
        }),
      }];
    }),
  };
}

// Prevent spreadsheet formula injection from member-entered display names.
function safeCsvText(text: string): string {
  return /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
}

export function faithPeriodToCsvRows(report: FaithPeriodResult): Record<string, string | number>[] {
  return report.members.map((member) => ({
    'Workspace': safeCsvText(report.scope_name),
    'Period': report.period === 'week' ? 'Weekly' : 'Monthly',
    'From (PH)': report.start_date,
    'To (PH)': report.as_of_date,
    'Member name': safeCsvText(member.member_name),
    'Member ID': member.user_id,
    'Expected days to date': report.expected_days,
    'Reading submitted days': member.reading_submitted_days,
    'Reading approved days': member.reading_approved_days,
    'Reading approved %': percentage(member.reading_approved_days, report.expected_days),
    'Reading needs revision days': member.reading_revision_days,
    'Devotion submitted days': member.devotion_submitted_days,
    'Devotion completed days': member.devotion_completed_days,
    'Devotion completed %': percentage(member.devotion_completed_days, report.expected_days),
    'Devotion needs revision days': member.devotion_revision_days,
    'Lessons approved in period': member.lesson_approved_count,
    'Lessons pending in period': member.lesson_pending_count,
    'Lesson stage breakdown': member.lesson_stages.map((stage) => `BUKLOD ${stage.stage_code}: ${stage.approved_count}`).join('; '),
  }));
}
