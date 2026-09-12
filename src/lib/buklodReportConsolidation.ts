import * as XLSX from 'xlsx';

import { supabase } from '@/lib/supabase';
import { readReportDefinitionRow, type ReportDefinitionRow } from '@/lib/buklodReportContracts';
import { outputReportWorkbook } from '@/lib/buklodReportWorkbookOutput';

type ConsolidatedPeriod = {
  id: string;
  title: string;
  period_key: string;
  opens_at: string | null;
  due_at: string | null;
  closes_at: string | null;
  status: string;
  assigned_count: number;
  submitted_count: number;
};

type ConsolidatedSubmission = {
  submission_id: string;
  assignment_id: string;
  period_id: string;
  period_title: string;
  period_key: string;
  submitter_user_id: string;
  submitter_name: string;
  submitter_username: string | null;
  submission_status: string;
  review_status: string | null;
  submitted_at: string | null;
  content: Record<string, unknown>;
  extracted_metrics: Record<string, unknown>;
};

export type ConsolidatedReportData = {
  definition: ReportDefinitionRow;
  periods: ConsolidatedPeriod[];
  submissions: ConsolidatedSubmission[];
};

export type ManagementRangePreset = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'ANNUAL' | 'ALL';

export type ScopeManagementDefinition = {
  id: string;
  code: string;
  title: string;
  recurrence_kind: string;
  status: string;
  content_requirements: Record<string, unknown>;
};

export type ScopeManagementPeriod = {
  id: string;
  definition_id: string;
  definition_title: string;
  title: string;
  period_key: string;
  opens_at: string | null;
  due_at: string | null;
  closes_at: string | null;
  status: string;
  assigned_count: number;
  submitted_count: number;
  overdue_count: number;
};

export type ScopeManagementSubmission = {
  submission_id: string;
  assignment_id: string;
  definition_id: string;
  definition_title: string;
  period_id: string;
  period_title: string;
  period_key: string;
  submitter_user_id: string;
  submitter_name: string;
  submitter_username: string | null;
  submission_status: string;
  review_status: string | null;
  submitted_at: string | null;
  content: Record<string, unknown>;
  extracted_metrics: Record<string, unknown>;
  validation_summary: Record<string, unknown>;
};

export type ScopeManagementPerson = {
  user_id: string;
  name: string;
  username: string | null;
  assigned_count: number;
  submitted_count: number;
  pending_count: number;
  overdue_count: number;
  last_deadline_at: string | null;
};

export type ReportActionType =
  | 'FEEDBACK'
  | 'FOLLOW_UP'
  | 'MENTORING'
  | 'COUNSELLING'
  | 'VISITATION'
  | 'LEADERSHIP_TRAINING'
  | 'SUPPORT'
  | 'WARNING'
  | 'REASSIGNMENT_REVIEW'
  | 'SUSPENSION_REVIEW'
  | 'DISMISSAL_REVIEW'
  | 'OTHER';

export type ReportActionStatus = 'SUGGESTED' | 'PLANNED' | 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';

export type ScopeManagementAction = {
  id: string;
  scope_id: string;
  submission_id: string | null;
  assignee_user_id: string | null;
  assignee_name: string | null;
  action_type: ReportActionType;
  title: string;
  rationale: string | null;
  status: ReportActionStatus;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  due_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  outcome: string | null;
  next_action: string | null;
  source_kind: 'AUTO_RULE' | 'SUPERVISOR' | 'SYSTEM';
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ScopeManagementData = {
  scope: { id: string; name: string; scope_type: string };
  range: { from_at: string | null; to_at: string | null };
  definitions: ScopeManagementDefinition[];
  periods: ScopeManagementPeriod[];
  submissions: ScopeManagementSubmission[];
  people: ScopeManagementPerson[];
  actions: ScopeManagementAction[];
};

export type ManagementSuggestion = {
  key: string;
  actionType: ReportActionType;
  title: string;
  rationale: string;
  assigneeUserId: string | null;
  assigneeName: string | null;
  submissionId: string | null;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
};

export type ManagementAnalytics = {
  assigned: number;
  submitted: number;
  pending: number;
  overdue: number;
  coverageRate: number;
  reviewAttention: number;
  activeActions: number;
  completedActions: number;
  summary: string;
  concernHighlights: Array<{ reporter: string; report: string; text: string }>;
  byDefinition: Array<{ definitionId: string; title: string; assigned: number; submitted: number; overdue: number; coverageRate: number }>;
  suggestions: ManagementSuggestion[];
};

function objectValue(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function sanitizeFileName(value: string) {
  return value.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 100) || 'BUKLOD_Report';
}

function flattenObject(value: unknown, prefix = '', output: Record<string, unknown> = {}) {
  if (value === null || value === undefined) {
    if (prefix) output[prefix] = '';
    return output;
  }
  if (Array.isArray(value)) {
    output[prefix || 'value'] = value.map((item) => typeof item === 'object' ? JSON.stringify(item) : String(item)).join(' | ');
    return output;
  }
  if (typeof value !== 'object') {
    output[prefix || 'value'] = value;
    return output;
  }
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    const next = prefix ? `${prefix}.${key}` : key;
    if (item && typeof item === 'object' && !Array.isArray(item)) flattenObject(item, next, output);
    else if (Array.isArray(item)) output[next] = item.map((entry) => typeof entry === 'object' ? JSON.stringify(entry) : String(entry)).join(' | ');
    else output[next] = item ?? '';
  }
  return output;
}

function dynamicFieldLabels(definition: ReportDefinitionRow | ScopeManagementDefinition) {
  const requirements = objectValue(definition.content_requirements);
  const labels = new Map<string, string>();
  const fields = Array.isArray(requirements.fields) ? requirements.fields : [];
  for (const fieldValue of fields) {
    const field = objectValue(fieldValue);
    const id = String(field.id ?? '').trim();
    const label = String(field.label ?? '').trim();
    if (id && label) labels.set(id, label);
  }
  return labels;
}

function submissionValues(definition: ReportDefinitionRow | ScopeManagementDefinition, content: Record<string, unknown>) {
  const schema = String(objectValue(definition.content_requirements).schema ?? '');
  if (schema === 'BUKLOD_DYNAMIC_FORM_V1') {
    const labels = dynamicFieldLabels(definition);
    const answers = objectValue(content.answers);
    const row: Record<string, unknown> = {};
    for (const [fieldId, answer] of Object.entries(answers)) {
      row[`Response · ${labels.get(fieldId) ?? fieldId}`] = Array.isArray(answer) ? answer.join(' | ') : answer ?? '';
    }
    return row;
  }
  return flattenObject(content);
}

export function managementRangeForPreset(preset: ManagementRangePreset, now = new Date()) {
  const end = new Date(now);
  end.setMilliseconds(end.getMilliseconds() + 1);
  if (preset === 'ALL') return { fromAt: null, toAt: null, label: 'All available periods' };
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (preset === 'WEEKLY') start.setDate(start.getDate() - 6);
  if (preset === 'MONTHLY') start.setDate(1);
  if (preset === 'QUARTERLY') start.setMonth(Math.floor(start.getMonth() / 3) * 3, 1);
  if (preset === 'SEMIANNUAL') start.setMonth(start.getMonth() < 6 ? 0 : 6, 1);
  if (preset === 'ANNUAL') start.setMonth(0, 1);
  const labels: Record<Exclude<ManagementRangePreset, 'ALL'>, string> = {
    WEEKLY: 'Weekly', MONTHLY: 'Monthly', QUARTERLY: 'Quarterly', SEMIANNUAL: 'Semiannual', ANNUAL: 'Annual',
  };
  return { fromAt: start.toISOString(), toAt: end.toISOString(), label: labels[preset] };
}

export async function fetchConsolidatedReportData(definitionId: string, periodId?: string | null): Promise<ConsolidatedReportData> {
  const { data, error } = await (supabase as any).rpc('buklod_report_consolidated_data_v1', {
    p_definition_id: definitionId,
    p_period_id: periodId ?? null,
  });
  if (error) throw error;
  const raw = objectValue(data);
  const definition = readReportDefinitionRow(raw.definition);
  if (!definition) throw new Error('Report definition could not be loaded for consolidation.');
  return {
    definition,
    periods: Array.isArray(raw.periods) ? raw.periods as ConsolidatedPeriod[] : [],
    submissions: Array.isArray(raw.submissions) ? raw.submissions as ConsolidatedSubmission[] : [],
  };
}

export async function fetchScopeManagementData(args: {
  scopeId: string;
  preset: ManagementRangePreset;
  definitionId?: string | null;
}): Promise<ScopeManagementData> {
  const range = managementRangeForPreset(args.preset);
  const { data, error } = await (supabase as any).rpc('buklod_report_scope_management_data_v1', {
    p_scope_id: args.scopeId,
    p_from_at: range.fromAt,
    p_to_at: range.toAt,
    p_definition_id: args.definitionId || null,
  });
  if (error) throw error;
  const raw = objectValue(data);
  return {
    scope: objectValue(raw.scope) as ScopeManagementData['scope'],
    range: objectValue(raw.range) as ScopeManagementData['range'],
    definitions: Array.isArray(raw.definitions) ? raw.definitions as ScopeManagementDefinition[] : [],
    periods: Array.isArray(raw.periods) ? raw.periods as ScopeManagementPeriod[] : [],
    submissions: Array.isArray(raw.submissions) ? raw.submissions as ScopeManagementSubmission[] : [],
    people: Array.isArray(raw.people) ? raw.people as ScopeManagementPerson[] : [],
    actions: Array.isArray(raw.actions) ? raw.actions as ScopeManagementAction[] : [],
  };
}

function normalizedActionType(value: string): ReportActionType {
  return value as ReportActionType;
}

function completedAction(actions: ScopeManagementAction[], userId: string, type: ReportActionType) {
  return actions.some((action) => action.assignee_user_id === userId && action.action_type === type && action.status === 'DONE');
}

function activeAction(actions: ScopeManagementAction[], userId: string | null, type: ReportActionType) {
  return actions.some((action) => action.assignee_user_id === userId && action.action_type === type && !['DONE', 'CANCELLED'].includes(action.status));
}

function concernHighlights(data: ScopeManagementData) {
  const definitionById = new Map(data.definitions.map((definition) => [definition.id, definition]));
  const highlights: ManagementAnalytics['concernHighlights'] = [];
  for (const submission of data.submissions) {
    const definition = definitionById.get(submission.definition_id);
    if (!definition) continue;
    const labels = dynamicFieldLabels(definition);
    const answers = objectValue(submission.content).answers;
    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) continue;
    for (const [fieldId, value] of Object.entries(answers as Record<string, unknown>)) {
      const label = labels.get(fieldId) ?? fieldId;
      if (!/(concern|challenge|issue|problem|need|assistance|support|help)/i.test(label)) continue;
      const text = Array.isArray(value) ? value.map(String).join('; ') : String(value ?? '').trim();
      if (!text || /^(none|n\/a|na|wala|no concern)$/i.test(text)) continue;
      highlights.push({ reporter: submission.submitter_name, report: submission.definition_title, text: text.slice(0, 280) });
      if (highlights.length >= 12) return highlights;
    }
  }
  return highlights;
}

export function buildManagementAnalytics(data: ScopeManagementData): ManagementAnalytics {
  const assigned = data.periods.reduce((sum, period) => sum + Number(period.assigned_count ?? 0), 0);
  const submitted = data.periods.reduce((sum, period) => sum + Number(period.submitted_count ?? 0), 0);
  const overdue = data.periods.reduce((sum, period) => sum + Number(period.overdue_count ?? 0), 0);
  const pending = Math.max(0, assigned - submitted);
  const coverageRate = assigned > 0 ? Math.round((submitted / assigned) * 100) : 0;
  const reviewAttention = data.submissions.filter((submission) => ['SUBMITTED', 'NEEDS_REVIEW', 'NEEDS_REVISION', 'REJECTED'].includes(String(submission.review_status ?? submission.submission_status ?? '').toUpperCase())).length;
  const activeActions = data.actions.filter((action) => !['DONE', 'CANCELLED'].includes(action.status)).length;
  const completedActions = data.actions.filter((action) => action.status === 'DONE').length;

  const byDefinitionMap = new Map<string, { definitionId: string; title: string; assigned: number; submitted: number; overdue: number }>();
  for (const period of data.periods) {
    const current = byDefinitionMap.get(period.definition_id) ?? { definitionId: period.definition_id, title: period.definition_title, assigned: 0, submitted: 0, overdue: 0 };
    current.assigned += Number(period.assigned_count ?? 0);
    current.submitted += Number(period.submitted_count ?? 0);
    current.overdue += Number(period.overdue_count ?? 0);
    byDefinitionMap.set(period.definition_id, current);
  }
  const byDefinition = Array.from(byDefinitionMap.values()).map((row) => ({
    ...row,
    coverageRate: row.assigned > 0 ? Math.round((row.submitted / row.assigned) * 100) : 0,
  })).sort((a, b) => a.coverageRate - b.coverageRate || b.assigned - a.assigned);

  const suggestions: ManagementSuggestion[] = [];
  if (reviewAttention > 0) suggestions.push({
    key: 'review-attention', actionType: 'FEEDBACK', title: `Review ${reviewAttention} submitted report${reviewAttention === 1 ? '' : 's'}`,
    rationale: 'Submitted reports are waiting for supervisor review/feedback. Close the reporting loop before escalating to personnel action.',
    assigneeUserId: null, assigneeName: null, submissionId: null, priority: 'HIGH',
  });
  if (pending > 0) suggestions.push({
    key: 'pending-follow-up', actionType: 'FOLLOW_UP', title: `Follow up ${pending} pending assignment${pending === 1 ? '' : 's'}`,
    rationale: `${coverageRate}% reporting coverage in the selected range. Start with communication and support before disciplinary review.`,
    assigneeUserId: null, assigneeName: null, submissionId: null, priority: overdue > 0 ? 'HIGH' : 'NORMAL',
  });

  for (const person of data.people) {
    if (person.overdue_count < 2) continue;
    let type: ReportActionType = 'FOLLOW_UP';
    let title = `Follow up ${person.name}`;
    let rationale = `${person.overdue_count} overdue reporting assignment${person.overdue_count === 1 ? '' : 's'} in the selected range.`;
    let priority: ManagementSuggestion['priority'] = 'NORMAL';

    if (person.overdue_count >= 3 && !completedAction(data.actions, person.user_id, 'COUNSELLING')) {
      type = 'COUNSELLING'; title = `Counselling review · ${person.name}`; priority = 'HIGH';
      rationale += ' Repeated overdue reporting remains after ordinary follow-up; verify circumstances and pastoral/leadership support needs.';
    } else if (person.overdue_count >= 4 && completedAction(data.actions, person.user_id, 'COUNSELLING') && !completedAction(data.actions, person.user_id, 'REASSIGNMENT_REVIEW')) {
      type = 'REASSIGNMENT_REVIEW'; title = `Reassignment review · ${person.name}`; priority = 'HIGH';
      rationale += ' A counselling action was completed but the reporting pattern remains unresolved. Human supervisor review is required.';
    } else if (person.overdue_count >= 5 && completedAction(data.actions, person.user_id, 'REASSIGNMENT_REVIEW') && !completedAction(data.actions, person.user_id, 'SUSPENSION_REVIEW')) {
      type = 'SUSPENSION_REVIEW'; title = `Suspension review · ${person.name}`; priority = 'URGENT';
      rationale += ' Prior counselling and reassignment review were completed. This is a recommendation for authorized human review only; it does not suspend automatically.';
    } else if (person.overdue_count >= 6 && completedAction(data.actions, person.user_id, 'SUSPENSION_REVIEW')) {
      type = 'DISMISSAL_REVIEW'; title = `Dismissal / separation review · ${person.name}`; priority = 'URGENT';
      rationale += ' A prior suspension review is already recorded and the unresolved pattern continues. Final action remains an authorized human decision, never automatic.';
    }

    if (!activeAction(data.actions, person.user_id, type)) {
      suggestions.push({ key: `${type}-${person.user_id}`, actionType: type, title, rationale, assigneeUserId: person.user_id, assigneeName: person.name, submissionId: null, priority });
    }
  }

  const concerns = concernHighlights(data);
  if (concerns.length > 0 && !activeAction(data.actions, null, 'SUPPORT')) suggestions.push({
    key: 'reported-concerns-support', actionType: 'SUPPORT', title: 'Review reported concerns / assistance needs',
    rationale: `${concerns.length} concern or assistance response${concerns.length === 1 ? '' : 's'} detected from fields explicitly labeled as concerns, needs, issues, help, or support.`,
    assigneeUserId: null, assigneeName: null, submissionId: null, priority: 'NORMAL',
  });

  const summary = assigned === 0
    ? 'No published assignments fall inside the selected range yet.'
    : `${submitted} of ${assigned} assigned reports were submitted (${coverageRate}% coverage). ${pending} remain pending, including ${overdue} overdue. ${reviewAttention} submission${reviewAttention === 1 ? '' : 's'} need review attention. ${activeActions} management action${activeActions === 1 ? '' : 's'} remain open and ${completedActions} are recorded done.`;

  return { assigned, submitted, pending, overdue, coverageRate, reviewAttention, activeActions, completedActions, summary, concernHighlights: concerns, byDefinition, suggestions };
}

export async function upsertReportAction(args: {
  scopeId: string;
  actionType: ReportActionType;
  title: string;
  assigneeUserId?: string | null;
  submissionId?: string | null;
  rationale?: string | null;
  dueAt?: string | null;
  priority?: ScopeManagementAction['priority'];
  status?: ReportActionStatus;
  actionId?: string | null;
  outcome?: string | null;
  nextAction?: string | null;
  sourceKind?: ScopeManagementAction['source_kind'];
}) {
  const { data, error } = await (supabase as any).rpc('buklod_report_upsert_action_v1', {
    p_scope_id: args.scopeId,
    p_action_type: normalizedActionType(args.actionType),
    p_title: args.title,
    p_assignee_user_id: args.assigneeUserId ?? null,
    p_submission_id: args.submissionId ?? null,
    p_rationale: args.rationale ?? null,
    p_due_at: args.dueAt ?? null,
    p_priority: args.priority ?? 'NORMAL',
    p_status: args.status ?? 'PLANNED',
    p_action_id: args.actionId ?? null,
    p_outcome: args.outcome ?? null,
    p_next_action: args.nextAction ?? null,
    p_source_kind: args.sourceKind ?? 'SUPERVISOR',
  });
  if (error) throw error;
  return data as ScopeManagementAction;
}

export async function exportConsolidatedReportXlsx(data: ConsolidatedReportData) {
  const workbook = XLSX.utils.book_new();
  const requirements = objectValue(data.definition.content_requirements);
  const reportTitle = String(requirements.template_label ?? data.definition.title);

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([
    { Item: 'Report', Value: reportTitle },
    { Item: 'Code', Value: data.definition.code },
    { Item: 'Category', Value: String(requirements.category ?? '') },
    { Item: 'Periods included', Value: data.periods.length },
    { Item: 'Submitted reports included', Value: data.submissions.length },
    { Item: 'Generated at', Value: new Date().toISOString() },
  ]), 'Summary');

  const periodRows = data.periods.map((period) => ({
    Period: period.title,
    Key: period.period_key,
    Status: period.status,
    Opens: period.opens_at ?? '',
    Deadline: period.due_at ?? '',
    Closes: period.closes_at ?? '',
    Assigned: Number(period.assigned_count ?? 0),
    Submitted: Number(period.submitted_count ?? 0),
    Pending: Math.max(0, Number(period.assigned_count ?? 0) - Number(period.submitted_count ?? 0)),
  }));
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(periodRows.length ? periodRows : [{ Period: 'No published period yet' }]), 'Periods');

  const submissionRows = data.submissions.map((submission) => ({
    Period: submission.period_title,
    'Period Key': submission.period_key,
    Reporter: submission.submitter_name,
    Username: submission.submitter_username ?? '',
    'Submission Status': submission.submission_status,
    'Review Status': submission.review_status ?? '',
    'Submitted At': submission.submitted_at ?? '',
    ...submissionValues(data.definition, objectValue(submission.content)),
  }));
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(submissionRows.length ? submissionRows : [{ Reporter: 'No submitted report yet' }]), 'Submissions');

  const fileName = `${sanitizeFileName(reportTitle)}_Consolidated_${new Date().toISOString().slice(0, 10)}.xlsx`;
  return outputReportWorkbook(workbook, fileName);
}

export async function exportScopeManagementXlsx(data: ScopeManagementData, analytics = buildManagementAnalytics(data), rangeLabel = 'Selected range') {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([
    { Item: 'Scope', Value: data.scope.name },
    { Item: 'Range', Value: rangeLabel },
    { Item: 'Summary', Value: analytics.summary },
    { Item: 'Assigned', Value: analytics.assigned },
    { Item: 'Submitted', Value: analytics.submitted },
    { Item: 'Coverage %', Value: analytics.coverageRate },
    { Item: 'Pending', Value: analytics.pending },
    { Item: 'Overdue', Value: analytics.overdue },
    { Item: 'Needs review', Value: analytics.reviewAttention },
    { Item: 'Open actions', Value: analytics.activeActions },
    { Item: 'Completed actions', Value: analytics.completedActions },
    { Item: 'Generated at', Value: new Date().toISOString() },
  ]), 'Management Summary');

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(analytics.byDefinition.map((row) => ({
    Report: row.title, Assigned: row.assigned, Submitted: row.submitted, 'Coverage %': row.coverageRate, Overdue: row.overdue,
  }))), 'Analytics');

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.people.map((person) => ({
    Person: person.name, Username: person.username ?? '', Assigned: person.assigned_count, Submitted: person.submitted_count,
    Pending: person.pending_count, Overdue: person.overdue_count, 'Last deadline': person.last_deadline_at ?? '',
  }))), 'People');

  const definitionById = new Map(data.definitions.map((definition) => [definition.id, definition]));
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.submissions.map((submission) => ({
    Report: submission.definition_title, Period: submission.period_title, Reporter: submission.submitter_name,
    'Submission status': submission.submission_status, 'Review status': submission.review_status ?? '', 'Submitted at': submission.submitted_at ?? '',
    ...submissionValues(definitionById.get(submission.definition_id) ?? { id: '', code: '', title: submission.definition_title, recurrence_kind: '', status: '', content_requirements: {} }, objectValue(submission.content)),
  }))), 'Submissions');

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.actions.map((action) => ({
    Person: action.assignee_name ?? '', Type: action.action_type, Action: action.title, Status: action.status, Priority: action.priority,
    Rationale: action.rationale ?? '', Due: action.due_at ?? '', Completed: action.completed_at ?? '', Outcome: action.outcome ?? '', 'Next action': action.next_action ?? '',
  }))), 'Actions');

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(analytics.suggestions.map((suggestion) => ({
    Person: suggestion.assigneeName ?? '', Type: suggestion.actionType, Suggestion: suggestion.title, Priority: suggestion.priority, Rationale: suggestion.rationale,
  }))), 'Suggested Actions');

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(analytics.concernHighlights.map((row) => ({ Reporter: row.reporter, Report: row.report, Concern: row.text }))), 'Reported Concerns');

  const fileName = `${sanitizeFileName(data.scope.name)}_Report_Management_${new Date().toISOString().slice(0, 10)}.xlsx`;
  return outputReportWorkbook(workbook, fileName);
}
