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

async function readErrorMessage(error: any, fallback: string) {
  const context = error?.context;
  if (context && typeof context.clone === 'function') {
    try {
      const payload = await context.clone().json();
      const message = String(payload?.error ?? payload?.message ?? '').trim();
      const stage = String(payload?.stage ?? '').trim();
      if (message) return stage ? `${message} [${stage}]` : message;
    } catch {
      try {
        const text = String(await context.clone().text()).trim();
        if (text) return text.slice(0, 1200);
      } catch {
        // Fall through to the regular Supabase error message.
      }
    }
  }

  return String(
    error?.context?.body?.error ??
      error?.context?.body?.message ??
      error?.message ??
      fallback
  );
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

  // Older/analyzer responses may contain only the flattened fields array.
  // Preserve those fields instead of showing a blank builder after upload.
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
    // Web: ask Expo to expose the picked file as base64 directly. Native
    // ignores this option and continues using the cached-file reader.
    base64: true,
  });

  if (picker.canceled || !picker.assets?.[0]) return null;
  const asset = picker.assets[0];
  if (asset.size && asset.size > MAX_FILE_BYTES) {
    throw new Error('Reporting layout files are limited to 12 MB.');
  }

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

  const mimeType = inferMimeType(asset.name, asset.mimeType);
  if (!mimeType) {
    throw new Error('Unsupported reporting form type. Use PDF, Word, Excel/CSV, text, JPG, PNG or WebP.');
  }

  const { data, error } = await supabase.functions.invoke('buklod-report-template-import-v1', {
    body: {
      scope_id: args.scopeId,
      filename: asset.name,
      mime_type: mimeType,
      base64,
      report_kind_hint: args.reportKindHint?.trim() || null,
    },
  });

  if (error) {
    throw new Error(await readErrorMessage(error, 'The reporting form could not be analyzed.'));
  }
  if (!data?.ok || !data?.draft || !data?.source_file) {
    throw new Error(String(data?.error ?? 'The reporting form could not be analyzed.'));
  }

  const draft = normalizeDraft(data.draft);
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
