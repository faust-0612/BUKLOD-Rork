/**
 * BUKLOD Report domain client.
 *
 * Definitions remain on the canonical RPC contract. Weekly sender workflow and
 * personal reminder state use the authenticated BUKLOD Report Edge API, which
 * re-validates the signed-in BUKLOD user and exact scope membership server-side.
 */

import { supabase } from '@/lib/supabase';

import {
  readReportDefinitionRow,
  readReportResolvedContext,
  type BuklodReportPhase,
  type ReportAssignmentCard,
  type ReportAssignmentStatus,
  type ReportDefinitionRow,
  type ReportDefinitionStatus,
  type ReportDefinitionUpsertInput,
  type ReportHomeCardStatus,
  type ReportRecurrenceKind,
  type ReportSubmissionStatus,
} from '@/lib/buklodReportContracts';

export type ReportReminderState = {
  status: 'ACTIVE' | 'DONE';
  response: string | null;
  comments: Array<{ text: string; by?: string; at?: string }>;
  completed_at: string | null;
};

export type QuickWeeklyReportContext = {
  scope_id: string;
  scope_name: string;
  scope_type: string;
  report_definition_id: string;
  report_period_id: string;
  report_assignment_id: string;
  period_title: string;
  period_key: string;
  deadline_at: string;
  assignment_status: ReportAssignmentStatus;
  submission_id: string | null;
  submission_status: ReportSubmissionStatus | null;
  content: Record<string, unknown>;
  reminder: ReportReminderState;
};

export type QuickWeeklySaveResult = {
  scope_id: string;
  report_definition_id: string;
  report_period_id: string;
  report_assignment_id: string;
  submission_id: string;
  assignment_status: ReportAssignmentStatus;
  submission_status: ReportSubmissionStatus;
  submitted_at: string | null;
  content: Record<string, unknown>;
};

const preferredAssignmentByScope = new Map<string, string>();

function readObject(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

export function setPreferredReportAssignment(
  scopeId: string,
  assignmentId?: string | null
) {
  const scope = String(scopeId ?? '').trim();
  if (!scope) return;

  const assignment = String(assignmentId ?? '').trim();
  if (!assignment) {
    preferredAssignmentByScope.delete(scope);
    return;
  }

  preferredAssignmentByScope.set(scope, assignment);
}

export function getPreferredReportAssignment(scopeId: string): string {
  return preferredAssignmentByScope.get(String(scopeId ?? '').trim()) ?? '';
}

async function invokeReportApi<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('buklod-report-api-v1', {
    body,
  });

  if (error) throw error;
  if (!data?.ok) {
    throw new Error(String(data?.error ?? 'BUKLOD Report request failed.'));
  }
  return data as T;
}

export async function fetchReportDomainStatus(): Promise<{
  domain: string;
  shared_with_focus_app: string;
  implementation_phase: BuklodReportPhase;
  next_phase: string;
  canonical_ids: string[];
}> {
  const { data, error } = await (supabase as any).rpc(
    'buklod_report_domain_status_v1'
  );

  if (error) throw error;

  const raw = readObject(data);
  return {
    domain: String(raw.domain ?? 'BUKLOD_ORGANIZATIONAL_REPORTS'),
    shared_with_focus_app: String(raw.shared_with_focus_app ?? 'BUKLOD_REPORT'),
    implementation_phase: String(
      raw.implementation_phase ?? 'PHASE_4_SUBMISSION'
    ) as BuklodReportPhase,
    next_phase: String(raw.next_phase ?? 'PHASE_5_REVIEW'),
    canonical_ids: Array.isArray(raw.canonical_ids)
      ? raw.canonical_ids.map((id: unknown) => String(id))
      : [],
  };
}

export async function resolveReportContext(args: {
  assignmentId?: string;
  submissionId?: string;
}) {
  const { data, error } = await (supabase as any).rpc(
    'buklod_report_resolve_context_v1',
    {
      p_assignment_id: args.assignmentId ?? null,
      p_submission_id: args.submissionId ?? null,
    }
  );

  if (error) throw error;
  return readReportResolvedContext(data);
}

export async function isReportScopeEntitled(scopeId: string): Promise<boolean> {
  const { data, error } = await (supabase as any).rpc(
    'buklod_report_scope_entitled_v1',
    { p_scope_id: scopeId }
  );

  if (error) throw error;
  return Boolean(data);
}

export async function ensureQuickWeeklyReport(
  scopeId: string,
  assignmentId?: string | null
): Promise<QuickWeeklyReportContext> {
  const preferredAssignmentId =
    String(assignmentId ?? '').trim() || getPreferredReportAssignment(scopeId);

  const payload = await invokeReportApi<{ ok: true; context: Record<string, any> }>({
    action: 'bootstrap_scope',
    scope_id: scopeId,
    assignment_id: preferredAssignmentId || null,
  });
  const raw = readObject(payload.context);
  if (!raw.report_assignment_id || !raw.report_definition_id || !raw.report_period_id) {
    throw new Error('Weekly report context is incomplete.');
  }
  const reminder = readObject(raw.reminder);

  const context: QuickWeeklyReportContext = {
    scope_id: String(raw.scope_id ?? scopeId),
    scope_name: String(raw.scope_name ?? 'Selected scope'),
    scope_type: String(raw.scope_type ?? ''),
    report_definition_id: String(raw.report_definition_id),
    report_period_id: String(raw.report_period_id),
    report_assignment_id: String(raw.report_assignment_id),
    period_title: String(raw.period_title ?? 'Quick Weekly Report'),
    period_key: String(raw.period_key ?? ''),
    deadline_at: String(raw.deadline_at ?? ''),
    assignment_status: String(raw.assignment_status ?? 'OPEN') as ReportAssignmentStatus,
    submission_id: raw.submission_id ? String(raw.submission_id) : null,
    submission_status: raw.submission_status
      ? (String(raw.submission_status) as ReportSubmissionStatus)
      : null,
    content: readObject(raw.content),
    reminder: {
      status: String(reminder.status ?? 'ACTIVE') === 'DONE' ? 'DONE' : 'ACTIVE',
      response: reminder.response ? String(reminder.response) : null,
      comments: Array.isArray(reminder.comments)
        ? reminder.comments.map((row: unknown) => {
            const item = readObject(row);
            return {
              text: String(item.text ?? ''),
              by: item.by ? String(item.by) : undefined,
              at: item.at ? String(item.at) : undefined,
            };
          }).filter((row: { text: string }) => row.text)
        : [],
      completed_at: reminder.completed_at ? String(reminder.completed_at) : null,
    },
  };

  setPreferredReportAssignment(context.scope_id, context.report_assignment_id);
  return context;
}

export async function saveQuickWeeklyReport(args: {
  scopeId: string;
  assignmentId: string;
  content: Record<string, unknown>;
  submit?: boolean;
  idempotencyKey?: string | null;
}): Promise<QuickWeeklySaveResult> {
  const payload = await invokeReportApi<{ ok: true; result: Record<string, any> }>({
    action: 'save_weekly',
    scope_id: args.scopeId,
    assignment_id: args.assignmentId,
    content: args.content,
    submit: Boolean(args.submit),
    idempotency_key: args.idempotencyKey ?? null,
  });
  const raw = readObject(payload.result);
  if (!raw.submission_id) throw new Error('Report submission could not be saved.');

  return {
    scope_id: String(raw.scope_id ?? args.scopeId),
    report_definition_id: String(raw.report_definition_id ?? ''),
    report_period_id: String(raw.report_period_id ?? ''),
    report_assignment_id: String(raw.report_assignment_id ?? args.assignmentId),
    submission_id: String(raw.submission_id),
    assignment_status: String(raw.assignment_status ?? 'OPEN') as ReportAssignmentStatus,
    submission_status: String(raw.submission_status ?? 'DRAFT') as ReportSubmissionStatus,
    submitted_at: raw.submitted_at ? String(raw.submitted_at) : null,
    content: readObject(raw.content),
  };
}

export async function updateQuickWeeklyReminder(args: {
  scopeId: string;
  assignmentId?: string | null;
  kind: 'ACK' | 'COMMENT' | 'DONE';
  value?: string;
}): Promise<ReportReminderState> {
  const preferredAssignmentId =
    String(args.assignmentId ?? '').trim() || getPreferredReportAssignment(args.scopeId);

  const payload = await invokeReportApi<{ ok: true; reminder: Record<string, any> }>({
    action: 'reminder_action',
    scope_id: args.scopeId,
    assignment_id: preferredAssignmentId || null,
    kind: args.kind,
    value: args.value ?? '',
  });
  const raw = readObject(payload.reminder);
  return {
    status: String(raw.status ?? 'ACTIVE') === 'DONE' ? 'DONE' : 'ACTIVE',
    response: raw.response ? String(raw.response) : null,
    comments: Array.isArray(raw.comments)
      ? raw.comments.map((row: unknown) => {
          const item = readObject(row);
          return { text: String(item.text ?? ''), by: item.by ? String(item.by) : undefined, at: item.at ? String(item.at) : undefined };
        }).filter((row: { text: string }) => row.text)
      : [],
    completed_at: raw.completed_at ? String(raw.completed_at) : null,
  };
}

export async function fetchMyActionableReportAssignments(
  limit = 10,
  scopeId?: string | null
): Promise<ReportAssignmentCard[]> {
  const { data, error } = await (supabase as any).rpc(
    'buklod_report_my_assignments_v1',
    {
      p_scope_id: scopeId ?? null,
      p_limit: Math.max(1, Math.min(100, limit)),
    }
  );
  if (error) return [];
  const raw = readObject(data);
  const rows = Array.isArray(raw.assignments) ? raw.assignments : [];
  return rows.flatMap((value: unknown) => {
    const row = readObject(value);
    if (!row.report_assignment_id || !row.report_definition_id || !row.report_period_id || !row.scope_id) return [];
    return [{
      report_assignment_id: String(row.report_assignment_id),
      report_definition_id: String(row.report_definition_id),
      report_period_id: String(row.report_period_id),
      scope_id: String(row.scope_id),
      scope_label: row.scope_label ? String(row.scope_label) : undefined,
      report_title: String(row.report_title ?? 'Report'),
      period_label: String(row.period_label ?? ''),
      deadline_at: String(row.deadline_at ?? ''),
      assignment_status: String(row.assignment_status ?? 'OPEN') as ReportAssignmentStatus,
      submission_status: row.submission_status ? String(row.submission_status) as ReportSubmissionStatus : null,
      home_status: String(row.home_status ?? 'DUE') as ReportHomeCardStatus,
      submission_id: row.submission_id ? String(row.submission_id) : null,
      has_unread_remarks: Boolean(row.has_unread_remarks),
    }];
  });
}

export async function fetchReportsNeedingReviewCount(): Promise<number> {
  return 0;
}

function buildRecurrenceConfig(input: ReportDefinitionUpsertInput) {
  const base = { ...(input.recurrenceConfig ?? {}) };
  if (input.effectiveFrom) base.effective_from = input.effectiveFrom;
  if (input.effectiveTo) base.effective_to = input.effectiveTo;
  if (input.dueRule) base.due_rule = input.dueRule;
  return base;
}

export async function listReportDefinitions(scopeId: string, includeArchived = false): Promise<ReportDefinitionRow[]> {
  const { data, error } = await (supabase as any).rpc('buklod_report_definitions_list_v1', {
    p_scope_id: scopeId,
    p_include_archived: includeArchived,
  });
  if (error) throw error;
  const raw = readObject(data);
  const rows = Array.isArray(raw.definitions) ? raw.definitions : [];
  return rows.map((row: unknown) => readReportDefinitionRow(row)).filter((row: ReportDefinitionRow | null): row is ReportDefinitionRow => row !== null);
}

export async function getReportDefinition(definitionId: string): Promise<ReportDefinitionRow> {
  const { data, error } = await (supabase as any).rpc('buklod_report_definition_get_v1', { p_definition_id: definitionId });
  if (error) throw error;
  const row = readReportDefinitionRow(data);
  if (!row) throw new Error('Report definition not found');
  return row;
}

export async function upsertReportDefinition(input: ReportDefinitionUpsertInput): Promise<ReportDefinitionRow> {
  const { data, error } = await (supabase as any).rpc('buklod_report_definition_upsert_v1', {
    p_scope_id: input.scopeId,
    p_code: input.code,
    p_title: input.title,
    p_description: input.description ?? null,
    p_instructions: input.instructions ?? null,
    p_recurrence_kind: input.recurrenceKind,
    p_recurrence_config: buildRecurrenceConfig(input),
    p_submitter_rules: input.submitterRules ?? {},
    p_recipient_rules: input.recipientRules ?? {},
    p_content_requirements: input.contentRequirements ?? {},
    p_validation_config: input.validationConfig ?? {},
    p_auto_approval_config: input.autoApprovalConfig ?? {},
    p_form_mode: input.formMode ?? 'FLEXIBLE',
    p_reminder_config: input.reminderConfig ?? [],
    p_raw_retention_days: input.rawRetentionDays ?? 30,
    p_status: input.status ?? 'DRAFT',
    p_is_required: Boolean(input.isRequired),
    p_definition_id: input.definitionId ?? null,
  });
  if (error) throw error;
  const row = readReportDefinitionRow(data);
  if (!row) throw new Error('Report definition could not be saved');
  return row;
}

export async function setReportDefinitionStatus(definitionId: string, status: ReportDefinitionStatus): Promise<ReportDefinitionRow> {
  const { data, error } = await (supabase as any).rpc('buklod_report_definition_set_status_v1', {
    p_definition_id: definitionId,
    p_status: status,
  });
  if (error) throw error;
  const row = readReportDefinitionRow(data);
  if (!row) throw new Error('Report definition status could not be updated');
  return row;
}

export const REPORT_RECURRENCE_OPTIONS: ReportRecurrenceKind[] = [
  'ONE_TIME', 'DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY', 'CUSTOM',
];
export const REPORT_DEFINITION_STATUS_OPTIONS: ReportDefinitionStatus[] = [
  'DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED',
];
