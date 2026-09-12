import { encode as base64Encode } from 'base64-arraybuffer';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

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

async function assetBase64(asset: DocumentPicker.DocumentPickerAsset) {
  if (Platform.OS === 'web' && asset.file) {
    return base64Encode(await asset.file.arrayBuffer());
  }
  return FileSystem.readAsStringAsync(asset.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

function readErrorMessage(error: any, fallback: string) {
  return String(
    error?.context?.body?.error ??
      error?.context?.body?.message ??
      error?.message ??
      fallback
  );
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
  });

  if (picker.canceled || !picker.assets?.[0]) return null;
  const asset = picker.assets[0];
  if (asset.size && asset.size > MAX_FILE_BYTES) {
    throw new Error('Reporting layout files are limited to 12 MB.');
  }

  const base64 = await assetBase64(asset);
  const approximateBytes = Math.floor((base64.length * 3) / 4);
  if (approximateBytes > MAX_FILE_BYTES) {
    throw new Error('Reporting layout files are limited to 12 MB.');
  }

  const { data, error } = await supabase.functions.invoke('buklod-report-template-import-v1', {
    body: {
      scope_id: args.scopeId,
      filename: asset.name,
      mime_type: asset.mimeType ?? '',
      base64,
      report_kind_hint: args.reportKindHint?.trim() || null,
    },
  });

  if (error) throw new Error(readErrorMessage(error, 'The reporting form could not be analyzed.'));
  if (!data?.ok || !data?.draft || !data?.source_file) {
    throw new Error(String(data?.error ?? 'The reporting form could not be analyzed.'));
  }

  return {
    provider: String(data.provider ?? ''),
    model: String(data.model ?? ''),
    scope: {
      id: String(data.scope?.id ?? args.scopeId),
      name: String(data.scope?.name ?? 'Selected scope'),
      scope_type: String(data.scope?.scope_type ?? ''),
    },
    source_file: data.source_file as ReportTemplateSourceFile,
    draft: data.draft as ReportTemplateImportDraft,
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
