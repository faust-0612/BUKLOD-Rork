import { supabase } from '@/lib/supabase';
import type {
  ReportAssignmentCard,
  ReportAssignmentStatus,
  ReportHomeCardStatus,
  ReportSubmissionStatus,
} from '@/lib/buklodReportContracts';

export type PublishReportDeadlineInput = {
  definitionId: string;
  dueAt: string;
  opensAt?: string | null;
  closesAt?: string | null;
  title?: string | null;
};

export type PublishReportDeadlineResult = {
  ok: boolean;
  alreadyPublished: boolean;
  scopeId: string;
  scopeName: string;
  scopeType: string;
  reportDefinitionId: string;
  reportPeriodId: string;
  periodTitle: string;
  opensAt: string | null;
  deadlineAt: string;
  closesAt: string | null;
  assignedCount: number;
  notificationCount: number;
  membershipSnapshot: boolean;
};

function readObject(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

export async function publishReportDeadline(
  input: PublishReportDeadlineInput
): Promise<PublishReportDeadlineResult> {
  const { data, error } = await (supabase as any).rpc(
    'buklod_report_publish_deadline_v1',
    {
      p_definition_id: input.definitionId,
      p_due_at: input.dueAt,
      p_opens_at: input.opensAt ?? null,
      p_closes_at: input.closesAt ?? null,
      p_title: input.title ?? null,
    }
  );

  if (error) throw error;
  const raw = readObject(data);
  if (!raw.ok || !raw.report_period_id) {
    throw new Error('The report deadline could not be published.');
  }

  return {
    ok: true,
    alreadyPublished: Boolean(raw.already_published),
    scopeId: String(raw.scope_id ?? ''),
    scopeName: String(raw.scope_name ?? ''),
    scopeType: String(raw.scope_type ?? ''),
    reportDefinitionId: String(raw.report_definition_id ?? input.definitionId),
    reportPeriodId: String(raw.report_period_id),
    periodTitle: String(raw.period_title ?? input.title ?? 'Report'),
    opensAt: raw.opens_at ? String(raw.opens_at) : null,
    deadlineAt: String(raw.deadline_at ?? input.dueAt),
    closesAt: raw.closes_at ? String(raw.closes_at) : null,
    assignedCount: Number(raw.assigned_count ?? 0),
    notificationCount: Number(raw.notification_count ?? 0),
    membershipSnapshot: Boolean(raw.membership_snapshot),
  };
}

export async function fetchPublishedReportAssignments(
  scopeId?: string | null,
  limit = 20
): Promise<ReportAssignmentCard[]> {
  const { data, error } = await (supabase as any).rpc(
    'buklod_report_my_assignments_v1',
    {
      p_scope_id: scopeId ?? null,
      p_limit: Math.max(1, Math.min(100, limit)),
    }
  );

  if (error) throw error;
  const raw = readObject(data);
  const rows = Array.isArray(raw.assignments) ? raw.assignments : [];

  return rows.flatMap((value: unknown) => {
    const row = readObject(value);
    if (
      !row.report_assignment_id ||
      !row.report_definition_id ||
      !row.report_period_id ||
      !row.scope_id
    ) {
      return [];
    }

    return [
      {
        report_assignment_id: String(row.report_assignment_id),
        report_definition_id: String(row.report_definition_id),
        report_period_id: String(row.report_period_id),
        scope_id: String(row.scope_id),
        scope_label: row.scope_label ? String(row.scope_label) : undefined,
        report_title: String(row.report_title ?? 'Report'),
        period_label: String(row.period_label ?? ''),
        deadline_at: String(row.deadline_at ?? ''),
        assignment_status: String(
          row.assignment_status ?? 'OPEN'
        ) as ReportAssignmentStatus,
        submission_status: row.submission_status
          ? (String(row.submission_status) as ReportSubmissionStatus)
          : null,
        home_status: String(row.home_status ?? 'DUE') as ReportHomeCardStatus,
        submission_id: row.submission_id ? String(row.submission_id) : null,
        has_unread_remarks: Boolean(row.has_unread_remarks),
      },
    ];
  });
}

export function parseManilaDateTime(value: string): string {
  const normalized = value.trim();
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(normalized)) {
    throw new Error('Use Manila date/time format YYYY-MM-DD HH:mm.');
  }

  const parsed = new Date(`${normalized.replace(' ', 'T')}:00+08:00`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Enter a valid Manila date and time.');
  }
  return parsed.toISOString();
}

export function formatManilaInput(value = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')} ${part('hour')}:${part('minute')}`;
}
