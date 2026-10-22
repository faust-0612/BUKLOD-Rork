/**
 * LOCKED: Canonical organizational report domain contracts.
 * ONE backend for Main BUKLOD and BUKLOD Report focus app.
 * Phase 3+ implements workflows; this module defines stable shared IDs/types.
 */

/** Approved implementation phases (do not skip). */
export const BUKLOD_REPORT_PHASES = {
  FOUNDATION: 'FOUNDATION',
  PHASE_3_DEFINITIONS: 'PHASE_3_DEFINITIONS',
  PHASE_4_SUBMISSION: 'PHASE_4_SUBMISSION',
  PHASE_4B_RETENTION: 'PHASE_4B_RETENTION',
  PHASE_5_REVIEW: 'PHASE_5_REVIEW',
  PHASE_6_VALIDATION: 'PHASE_6_VALIDATION',
  PHASE_7_EVALUATION: 'PHASE_7_EVALUATION',
} as const;

export type BuklodReportPhase =
  typeof BUKLOD_REPORT_PHASES[keyof typeof BUKLOD_REPORT_PHASES];

/** Canonical ID fields — deep links pass these; backend re-validates auth. */
export type BuklodReportCanonicalIds = {
  scope_id: string;
  report_definition_id?: string;
  report_period_id?: string;
  report_assignment_id?: string;
  submission_id?: string;
  review_id?: string;
  remark_id?: string;
};

/** Assignment lifecycle (deadline-driven). */
export type ReportAssignmentStatus =
  | 'OPEN'
  | 'DUE'
  | 'DUE_SOON'
  | 'EXPIRED'
  | 'SUBMITTED';

/** Submission / review lifecycle (workflow-driven). */
export type ReportSubmissionStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'PROCESSING'
  | 'NEEDS_REVIEW'
  | 'NEEDS_REVISION'
  | 'AUTO_APPROVED'
  | 'APPROVED'
  | 'REJECTED'
  | 'CLOSED';

export type ReportReviewStatus =
  | 'SUBMITTED'
  | 'PROCESSING'
  | 'NEEDS_REVIEW'
  | 'NEEDS_REVISION'
  | 'AUTO_APPROVED'
  | 'APPROVED'
  | 'REJECTED'
  | 'CLOSED';

/** Home / Action Center display statuses. */
export type ReportHomeCardStatus =
  | 'DUE'
  | 'DUE_SOON'
  | 'SUBMITTED'
  | 'PROCESSING'
  | 'NEEDS_REVIEW'
  | 'NEEDS_REVISION'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXPIRED';

export type ReportRecurrenceKind =
  | 'ONE_TIME'
  | 'DAILY'
  | 'WEEKLY'
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'ANNUALLY'
  | 'CUSTOM';

export type ReportFormMode = 'STRICT_FORM' | 'FLEXIBLE';

export type ReportDefinitionStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'PAUSED'
  | 'ARCHIVED';

export type ReportDefinitionRow = {
  id: string;
  scope_id: string;
  code: string;
  title: string;
  description: string | null;
  instructions: string | null;
  recurrence_kind: ReportRecurrenceKind;
  recurrence_config: Record<string, unknown>;
  submitter_rules: Record<string, unknown>;
  recipient_rules: Record<string, unknown>;
  content_requirements: Record<string, unknown>;
  validation_config: Record<string, unknown>;
  auto_approval_config: Record<string, unknown>;
  sample_reference: Record<string, unknown>;
  form_mode: ReportFormMode;
  reminder_config: unknown[];
  raw_retention_days: number;
  status: ReportDefinitionStatus;
  is_required: boolean;
  effective_from: string | null;
  effective_to: string | null;
  due_rule: Record<string, unknown>;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ReportDefinitionUpsertInput = {
  scopeId: string;
  definitionId?: string | null;
  code: string;
  title: string;
  description?: string;
  instructions?: string;
  recurrenceKind: ReportRecurrenceKind;
  recurrenceConfig?: Record<string, unknown>;
  submitterRules?: Record<string, unknown>;
  recipientRules?: Record<string, unknown>;
  contentRequirements?: Record<string, unknown>;
  validationConfig?: Record<string, unknown>;
  autoApprovalConfig?: Record<string, unknown>;
  formMode?: ReportFormMode;
  reminderConfig?: unknown[];
  rawRetentionDays?: number;
  status?: ReportDefinitionStatus;
  isRequired?: boolean;
  effectiveFrom?: string;
  effectiveTo?: string;
  dueRule?: Record<string, unknown>;
};

export type ReportEntitlementSource =
  | 'MZB_EXEMPTION'
  | 'SUBSCRIPTION'
  | 'ONE_TIME_PURCHASE'
  | 'TRIAL'
  | 'SYSTEM_GRANT'
  | 'FREE_TIER';

export function readReportDefinitionRow(data: unknown): ReportDefinitionRow | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const raw = data as Record<string, unknown>;

  if (!raw.id || !raw.scope_id || !raw.code || !raw.title) {
    return null;
  }

  return {
    id: String(raw.id),
    scope_id: String(raw.scope_id),
    code: String(raw.code),
    title: String(raw.title),
    description: raw.description ? String(raw.description) : null,
    instructions: raw.instructions ? String(raw.instructions) : null,
    recurrence_kind: String(
      raw.recurrence_kind ?? 'ONE_TIME'
    ) as ReportRecurrenceKind,
    recurrence_config:
      raw.recurrence_config && typeof raw.recurrence_config === 'object'
        ? (raw.recurrence_config as Record<string, unknown>)
        : {},
    submitter_rules:
      raw.submitter_rules && typeof raw.submitter_rules === 'object'
        ? (raw.submitter_rules as Record<string, unknown>)
        : {},
    recipient_rules:
      raw.recipient_rules && typeof raw.recipient_rules === 'object'
        ? (raw.recipient_rules as Record<string, unknown>)
        : {},
    content_requirements:
      raw.content_requirements && typeof raw.content_requirements === 'object'
        ? (raw.content_requirements as Record<string, unknown>)
        : {},
    validation_config:
      raw.validation_config && typeof raw.validation_config === 'object'
        ? (raw.validation_config as Record<string, unknown>)
        : {},
    auto_approval_config:
      raw.auto_approval_config && typeof raw.auto_approval_config === 'object'
        ? (raw.auto_approval_config as Record<string, unknown>)
        : {},
    sample_reference:
      raw.sample_reference && typeof raw.sample_reference === 'object'
        ? (raw.sample_reference as Record<string, unknown>)
        : {},
    form_mode: String(raw.form_mode ?? 'FLEXIBLE') as ReportFormMode,
    reminder_config: Array.isArray(raw.reminder_config) ? raw.reminder_config : [],
    raw_retention_days: Number(raw.raw_retention_days ?? 30),
    status: String(raw.status ?? 'DRAFT') as ReportDefinitionStatus,
    is_required: Boolean(raw.is_required),
    effective_from: raw.effective_from ? String(raw.effective_from) : null,
    effective_to: raw.effective_to ? String(raw.effective_to) : null,
    due_rule:
      raw.due_rule && typeof raw.due_rule === 'object'
        ? (raw.due_rule as Record<string, unknown>)
        : {},
    created_by: raw.created_by ? String(raw.created_by) : null,
    updated_by: raw.updated_by ? String(raw.updated_by) : null,
    created_at: String(raw.created_at ?? ''),
    updated_at: String(raw.updated_at ?? ''),
  };
}

/** Member-facing assignment card (paginated — not full history). */
export type ReportAssignmentCard = {
  report_assignment_id: string;
  report_definition_id: string;
  report_period_id: string;
  scope_id: string;
  scope_label?: string;
  report_title: string;
  period_label: string;
  deadline_at: string;
  assignment_status: ReportAssignmentStatus;
  submission_status?: ReportSubmissionStatus | null;
  home_status: ReportHomeCardStatus;
  submission_id?: string | null;
  has_unread_remarks?: boolean;
};

/** Resolved deep-link context from buklod_report_resolve_context_v1. */
export type ReportResolvedContext = BuklodReportCanonicalIds & {
  authorized: boolean;
  assignment_status?: ReportAssignmentStatus;
  submission_status?: ReportSubmissionStatus;
  deadline_at?: string;
};

/** Notification event types — carry canonical IDs for exact routing. */
export const BUKLOD_REPORT_NOTIFICATION_EVENTS = [
  'report_assigned',
  'report_due',
  'report_due_soon',
  'report_expired',
  'report_deadline_extended',
  'report_submitted',
  'report_needs_review',
  'report_needs_revision',
  'report_remark_added',
  'report_reply_added',
  'report_approved',
  'report_rejected',
  'report_forwarded',
  'report_ack_required',
  'report_file_expiring',
] as const;

export type BuklodReportNotificationEvent =
  typeof BUKLOD_REPORT_NOTIFICATION_EVENTS[number];

export const BUKLOD_REPORT_FOCUS_APP_ID = 'report' as const;

/**
 * Required-report reminders cannot be disabled inside BUKLOD Report.
 * OS notification permission remains user-controlled; in-app indicators mandatory.
 */
export const BUKLOD_REPORT_REMINDER_POLICY = {
  allowDisableRequiredReminders: false,
  mandatoryInAppIndicators: [
    'badge',
    'needs_action',
    'due_soon',
    'overdue_expired',
    'required_report_card',
  ],
} as const;

/** Default raw file retention after final review (days). */
export const BUKLOD_REPORT_DEFAULT_RAW_RETENTION_DAYS = 30;

export function readReportResolvedContext(data: unknown): ReportResolvedContext {
  const raw =
    data && typeof data === 'object'
      ? (data as Record<string, unknown>)
      : {};

  return {
    authorized: Boolean(raw.authorized),
    scope_id: String(raw.scope_id ?? ''),
    report_definition_id: raw.report_definition_id
      ? String(raw.report_definition_id)
      : undefined,
    report_period_id: raw.report_period_id
      ? String(raw.report_period_id)
      : undefined,
    report_assignment_id: raw.report_assignment_id
      ? String(raw.report_assignment_id)
      : undefined,
    submission_id: raw.submission_id
      ? String(raw.submission_id)
      : undefined,
    assignment_status: raw.assignment_status
      ? (String(raw.assignment_status) as ReportAssignmentStatus)
      : undefined,
    submission_status: raw.submission_status
      ? (String(raw.submission_status) as ReportSubmissionStatus)
      : undefined,
    deadline_at: raw.deadline_at ? String(raw.deadline_at) : undefined,
  };
}
