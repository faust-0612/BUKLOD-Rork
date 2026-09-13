import * as DocumentPicker from 'expo-document-picker';

import { readReportAssetBase64 } from '@/lib/buklodReportAssetBase64';
import { supabase } from '@/lib/supabase';

export type ReportTemplateFieldType =
  | 'short_text'
  | 'long_text'
  | 'number'
  | 'date'
  | 'yes_no'
  | 'choice';

export type ReportTemplateField = {
  id: string;
  section_id: string;
  label: string;
  type: ReportTemplateFieldType;
  required: boolean;
  help: string | null;
  options: string[];
};

export type ReportTemplateSection = {
  id: string;
  title: string;
  description: string | null;
  fields: ReportTemplateField[];
};

export type ReportTemplateSourceFile = {
  bucket: string;
  path: string;
  name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: string;
  uploaded_at: string;
};

export type ReportTemplateImportDraft = {
  title: string;
  category: string;
  description: string | null;
  instructions: string | null;
  sections: ReportTemplateSection[];
  fields: ReportTemplateField[];
  warnings: string[];
  confidence: number;
};

export type ReportTemplateImportResult = {
  provider: string;
  model: string;
  scope: { id: string; name: string; scope_type: string };
  source_file: ReportTemplateSourceFile;
  draft: ReportTemplateImportDraft;
};

const MAX_FILE_BYTES = 12 * 1024 * 1024;
const ANALYZE_TIMEOUT_MS = 60_000;
const SUPABASE_URL = String(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
const SUPABASE_PUBLISHABLE_KEY = String(process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '').trim();
const TEMPLATE_ANALYZER_URL = `${SUPABASE_URL}/functions/v1/buklod-report-template-import-v1`;

function showWebAnalyzerMessage(message: string) {
  if (typeof window !== 'undefined' && typeof window.alert === 'function') {
    window.alert(`BUKLOD Report\n\n${message}`);
  }
}

function stripDataUrlPrefix(value: string) {
  const trimmed = value.trim();
  if (!trimmed.startsWith('data:')) return trimmed;
  const commaIndex = trimmed.indexOf(',');
  return commaIndex >= 0 ? trimmed.slice(commaIndex + 1) : trimmed;
}

function inferMimeType(name: string, reported?: string | null) {
  const explicit = String(reported ?? '').trim().toLowerCase();
  if (explicit && explicit !== 'application/octet-stream') return explicit;
  const lower = name.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (lower.endsWith('.doc')) return 'application/msword';
  if (lower.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (lower.endsWith('.xls')) return 'application/vnd.ms-excel';
  if (lower.endsWith('.csv')) return 'text/csv';
  if (lower.endsWith('.txt') || lower.endsWith('.md')) return 'text/plain';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return explicit;
}

function asObject(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : {};
}

function normalizeDraft(value: unknown): ReportTemplateImportDraft {
  const raw = asObject(value);
  const rawSections = Array.isArray(raw.sections) ? raw.sections : [];
  const rawFields = Array.isArray(raw.fields) ? raw.fields : [];

  let sections = rawSections as ReportTemplateSection[];
  let fields = sections.flatMap((section) => Array.isArray(section?.fields) ? section.fields : []);

  if (fields.length === 0 && rawFields.length > 0) {
    const grouped = new Map<string, ReportTemplateField[]>();
    for (const fieldValue of rawFields) {
      const field = asObject(fieldValue) as ReportTemplateField;
      const sectionId = String(field.section_id || 'report_fields');
      grouped.set(sectionId, [...(grouped.get(sectionId) ?? []), { ...field, section_id: sectionId }]);
    }
    sections = Array.from(grouped.entries()).map(([id, group], index) => ({
      id,
      title: id === 'report_fields' ? 'Report fields' : `Section ${index + 1}`,
      description: null,
      fields: group,
    }));
    fields = sections.flatMap((section) => section.fields);
  }

  return {
    title: String(raw.title ?? '').trim(),
    category: String(raw.category ?? 'CUSTOM').trim() || 'CUSTOM',
    description: raw.description == null ? null : String(raw.description),
    instructions: raw.instructions == null ? null : String(raw.instructions),
    sections,
    fields,
    warnings: Array.isArray(raw.warnings) ? raw.warnings.map(String) : [],
    confidence: Math.max(0, Math.min(1, Number(raw.confidence ?? 0) || 0)),
  };
}

async function parseAnalyzerResponse(response: Response) {
  const raw = await response.text();
  let payload: any = null;
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message = String(payload?.error ?? payload?.message ?? raw ?? `Analyzer request failed (${response.status}).`).trim();
    const stage = String(payload?.stage ?? '').trim();
    throw new Error(stage ? `${message} [${stage}]` : message || `Analyzer request failed (${response.status}).`);
  }

  return payload;
}

async function invokeTemplateAnalyzer(body: FormData | Record<string, unknown>) {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error('BUKLOD Report is missing its Supabase web configuration.');
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    throw new Error(`Could not read the current BUKLOD session: ${sessionError.message}`);
  }

  const accessToken = String(sessionData.session?.access_token ?? '').trim();
  if (!accessToken) {
    throw new Error('Your BUKLOD Report session is missing or expired. Sign in again before uploading a form. [session]');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ANALYZE_TIMEOUT_MS);

  try {
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      apikey: SUPABASE_PUBLISHABLE_KEY,
      'x-client-info': 'buklod-report-template-import-direct-v1',
    };

    if (!isFormData) headers['Content-Type'] = 'application/json';

    const response = await fetch(TEMPLATE_ANALYZER_URL, {
      method: 'POST',
      headers,
      body: isFormData ? body : JSON.stringify(body),
      signal: controller.signal,
    });

    return await parseAnalyzerResponse(response);
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new Error('The form analyzer did not respond within 60 seconds. Try a smaller/clearer form. [client-timeout]');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function pickAndAnalyzeReportTemplate(args: {
  scopeId: string;
  reportKindHint?: string;
}): Promise<ReportTemplateImportResult | null> {
  const picker = await DocumentPicker.getDocumentAsync({
    type: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'text/plain',
      'image/jpeg',
      'image/png',
      'image/webp',
    ],
    copyToCacheDirectory: true,
    multiple: false,
    base64: true,
  });

  if (picker.canceled || !picker.assets?.[0]) return null;
  const asset = picker.assets[0];
  const assetSize = Number(asset.size ?? asset.file?.size ?? 0);
  if (assetSize > MAX_FILE_BYTES) {
    throw new Error('Reporting layout files are limited to 12 MB.');
  }

  const mimeType = inferMimeType(asset.name, asset.mimeType ?? asset.file?.type);
  if (!mimeType) {
    throw new Error('Unsupported reporting form type. Use PDF, Word, Excel/CSV, text, JPG, PNG or WebP.');
  }

  let body: FormData | Record<string, unknown>;

  if (asset.file && typeof FormData !== 'undefined') {
    const form = new FormData();
    form.append('scope_id', args.scopeId);
    form.append('filename', asset.name);
    form.append('mime_type', mimeType);
    form.append('report_kind_hint', args.reportKindHint?.trim() || '');
    form.append('file', asset.file, asset.name);
    body = form;
  } else {
    const embeddedBase64 = typeof asset.base64 === 'string'
      ? stripDataUrlPrefix(asset.base64)
      : '';
    const base64 = embeddedBase64 || await readReportAssetBase64(asset);
    if (!base64) {
      throw new Error('The selected reporting form could not be read. Choose the file again.');
    }

    const approximateBytes = Math.floor((base64.length * 3) / 4);
    if (approximateBytes > MAX_FILE_BYTES) {
      throw new Error('Reporting layout files are limited to 12 MB.');
    }

    body = {
      scope_id: args.scopeId,
      filename: asset.name,
      mime_type: mimeType,
      base64,
      report_kind_hint: args.reportKindHint?.trim() || null,
    };
  }

  let data: any;
  try {
    data = await invokeTemplateAnalyzer(body);
  } catch (error: any) {
    const message = String(error?.message ?? error ?? 'The reporting form could not be analyzed.');
    showWebAnalyzerMessage(message);
    throw error;
  }

  if (!data?.ok || !data?.draft || !data?.source_file) {
    const stage = String(data?.stage ?? '').trim();
    const message = String(data?.error ?? 'The reporting form could not be analyzed.');
    const visible = stage ? `${message} [${stage}]` : message;
    showWebAnalyzerMessage(visible);
    throw new Error(visible);
  }

  const draft = normalizeDraft(data.draft);
  if (draft.fields.length === 0) {
    showWebAnalyzerMessage('The file was analyzed, but no reliable report fields were detected. Try a clearer form or add the fields manually.');
  }

  return {
    provider: String(data.provider ?? ''),
    model: String(data.model ?? ''),
    scope: {
      id: String(data.scope?.id ?? args.scopeId),
      name: String(data.scope?.name ?? 'Selected scope'),
      scope_type: String(data.scope?.scope_type ?? ''),
    },
    source_file: {
      ...(data.source_file as ReportTemplateSourceFile),
      mime_type: String(data.source_file?.mime_type || mimeType),
    },
    draft,
  };
}

export function flattenReportTemplateSections(sections: ReportTemplateSection[]) {
  return sections.flatMap((section) =>
    section.fields.map((field) => ({ ...field, section_id: section.id }))
  );
}

export function makeReportFieldId(label: string, existingIds: Iterable<string>) {
  const used = new Set(Array.from(existingIds));
  const base = label
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48) || `field_${Date.now()}`;

  let next = base;
  let suffix = 2;
  while (used.has(next)) {
    next = `${base}_${suffix}`.slice(0, 64);
    suffix += 1;
  }
  return next;
}
