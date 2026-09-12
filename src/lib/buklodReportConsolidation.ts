import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import * as XLSX from 'xlsx';

import { supabase } from '@/lib/supabase';
import { readReportDefinitionRow, type ReportDefinitionRow } from '@/lib/buklodReportContracts';

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

function dynamicFieldLabels(definition: ReportDefinitionRow) {
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

function submissionValues(definition: ReportDefinitionRow, content: Record<string, unknown>) {
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
  if (Platform.OS === 'web') {
    XLSX.writeFile(workbook, fileName);
    return fileName;
  }

  const base64 = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
  const directory = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  if (!directory) throw new Error('A writable export directory is unavailable.');
  const uri = `${directory}${fileName}`;
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: `Export ${reportTitle}`,
      UTI: 'org.openxmlformats.spreadsheetml.sheet',
    });
  }
  return uri;
}
