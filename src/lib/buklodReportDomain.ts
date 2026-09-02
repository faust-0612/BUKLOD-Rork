/**
 * Report domain API — thin client over canonical backend RPCs.
 * Workflows return empty until Phase 3+; resolver enforces backend auth.
 */

import { supabase } from '@/lib/supabase';

import {
  readReportDefinitionRow,
  readReportResolvedContext,
  type BuklodReportPhase,
  type ReportAssignmentCard,
  type ReportDefinitionRow,
  type ReportDefinitionStatus,
  type ReportDefinitionUpsertInput,
  type ReportRecurrenceKind,
} from '@/lib/buklodReportContracts';

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

  if (error) {
    throw error;
  }

  const raw =
    data && typeof data === 'object'
      ? (data as Record<string, unknown>)
      : {};

  return {
    domain: String(raw.domain ?? 'BUKLOD_ORGANIZATIONAL_REPORTS'),
    shared_with_focus_app: String(raw.shared_with_focus_app ?? 'BUKLOD_REPORT'),
    implementation_phase: String(
      raw.implementation_phase ?? 'FOUNDATION'
    ) as BuklodReportPhase,
    next_phase: String(raw.next_phase ?? 'PHASE_3_DEFINITIONS'),
    canonical_ids: Array.isArray(raw.canonical_ids)
      ? raw.canonical_ids.map((id) => String(id))
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

  if (error) {
    throw error;
  }

  return readReportResolvedContext(data);
}

export async function isReportScopeEntitled(scopeId: string): Promise<boolean> {
  const { data, error } = await (supabase as any).rpc(
    'buklod_report_scope_entitled_v1',
    { p_scope_id: scopeId }
  );

  if (error) {
    throw error;
  }

  return Boolean(data);
}

/**
 * Phase 4: paginated actionable assignments for Home "Reports to Submit".
 * Foundation stub — returns empty until Phase 3 assignment generation ships.
 */
export async function fetchMyActionableReportAssignments(
  _limit = 10
): Promise<ReportAssignmentCard[]> {
  return [];
}

/**
 * Phase 5: reviewer inbox count for Action Center.
 * Foundation stub — returns zero until review RPCs ship.
 */
export async function fetchReportsNeedingReviewCount(): Promise<number> {
  return 0;
}

function buildRecurrenceConfig(input: ReportDefinitionUpsertInput) {
  const base = { ...(input.recurrenceConfig ?? {}) };

  if (input.effectiveFrom) {
    base.effective_from = input.effectiveFrom;
  }

  if (input.effectiveTo) {
    base.effective_to = input.effectiveTo;
  }

  if (input.dueRule) {
    base.due_rule = input.dueRule;
  }

  return base;
}

export async function listReportDefinitions(
  scopeId: string,
  includeArchived = false
): Promise<ReportDefinitionRow[]> {
  const { data, error } = await (supabase as any).rpc(
    'buklod_report_definitions_list_v1',
    {
      p_scope_id: scopeId,
      p_include_archived: includeArchived,
    }
  );

  if (error) {
    throw error;
  }

  const raw =
    data && typeof data === 'object'
      ? (data as Record<string, unknown>)
      : {};

  const rows = Array.isArray(raw.definitions) ? raw.definitions : [];

  return rows
    .map((row) => readReportDefinitionRow(row))
    .filter((row): row is ReportDefinitionRow => row !== null);
}

export async function getReportDefinition(
  definitionId: string
): Promise<ReportDefinitionRow> {
  const { data, error } = await (supabase as any).rpc(
    'buklod_report_definition_get_v1',
    { p_definition_id: definitionId }
  );

  if (error) {
    throw error;
  }

  const row = readReportDefinitionRow(data);

  if (!row) {
    throw new Error('Report definition not found');
  }

  return row;
}

export async function upsertReportDefinition(
  input: ReportDefinitionUpsertInput
): Promise<ReportDefinitionRow> {
  const { data, error } = await (supabase as any).rpc(
    'buklod_report_definition_upsert_v1',
    {
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
    }
  );

  if (error) {
    throw error;
  }

  const row = readReportDefinitionRow(data);

  if (!row) {
    throw new Error('Report definition could not be saved');
  }

  return row;
}

export async function setReportDefinitionStatus(
  definitionId: string,
  status: ReportDefinitionStatus
): Promise<ReportDefinitionRow> {
  const { data, error } = await (supabase as any).rpc(
    'buklod_report_definition_set_status_v1',
    {
      p_definition_id: definitionId,
      p_status: status,
    }
  );

  if (error) {
    throw error;
  }

  const row = readReportDefinitionRow(data);

  if (!row) {
    throw new Error('Report definition status could not be updated');
  }

  return row;
}

export const REPORT_RECURRENCE_OPTIONS: ReportRecurrenceKind[] = [
  'ONE_TIME',
  'DAILY',
  'WEEKLY',
  'MONTHLY',
  'QUARTERLY',
  'ANNUALLY',
  'CUSTOM',
];

export const REPORT_DEFINITION_STATUS_OPTIONS: ReportDefinitionStatus[] = [
  'DRAFT',
  'ACTIVE',
  'PAUSED',
  'ARCHIVED',
];
