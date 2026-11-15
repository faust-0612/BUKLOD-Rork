import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { encode } from 'base64-arraybuffer';
import * as XLSX from 'xlsx';
import * as Crypto from 'expo-crypto';

import { supabase } from '@/lib/supabase';

export type ReportEvidencePhoto = {
  path: string;
  filename: string;
  mime_type: 'image/jpeg' | 'image/png' | 'image/webp';
  uploaded_at: string;
  extraction_confidence?: number;
  detected_fields?: string[];
};

export type ReportPhotoAsset = {
  uri: string;
  filename: string;
  mimeType: string;
};

export type ReportImportProposal = {
  photoAsset?: ReportPhotoAsset;
  filename: string;
  sourceType: 'EXCEL' | 'CSV_TEXT' | 'PDF_PHOTO';
  confidence: number;
  detectedFields: string[];
  reviewNotes: string[];
  content: Record<string, any>;
};

function objectValue(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : {};
}

async function invokeImport(args: {
  scopeId: string;
  filename: string;
  mimeType: string;
  base64?: string;
  extractedText?: string;
}): Promise<ReportImportProposal> {
  const { data, error } = await supabase.functions.invoke('buklod-report-import-v1', {
    body: {
      scope_id: args.scopeId,
      filename: args.filename,
      mime_type: args.mimeType,
      base64: args.base64 ?? null,
      extracted_text: args.extractedText ?? null,
    },
  });
  if (error) throw error;
  if (!data?.ok || !data?.result) {
    throw new Error(String(data?.error ?? 'Automatic report import failed.'));
  }
  const result = objectValue(data.result);
  return {
    filename: args.filename,
    sourceType: args.extractedText
      ? (args.filename.toLowerCase().match(/\.xlsx?$/) ? 'EXCEL' : 'CSV_TEXT')
      : 'PDF_PHOTO',
    confidence: Math.max(0, Math.min(1, Number(result.confidence ?? 0))),
    detectedFields: Array.isArray(result.detected_fields)
      ? result.detected_fields.map(String).slice(0, 60)
      : [],
    reviewNotes: Array.isArray(result.review_notes)
      ? result.review_notes.map(String).slice(0, 20)
      : [],
    content: {
      schema: 'BUKLOD_QUICK_WEEKLY_V1',
      overall_week: result.overall_week ?? null,
      activities: objectValue(result.activities),
      people: objectValue(result.people),
      concern: objectValue(result.concern),
      next_period: objectValue(result.next_period),
      additional_note: result.additional_note ?? null,
      import_metadata: {
        filename: args.filename,
        confidence: Math.max(0, Math.min(1, Number(result.confidence ?? 0))),
        detected_fields: Array.isArray(result.detected_fields) ? result.detected_fields.map(String).slice(0, 60) : [],
        applied_only_after_confirmation: true,
      },
    },
  };
}

function workbookToText(buffer: ArrayBuffer) {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sections: string[] = [];
  for (const sheetName of workbook.SheetNames.slice(0, 8)) {
    const rows = XLSX.utils.sheet_to_json<any[]>(workbook.Sheets[sheetName], {
      header: 1,
      raw: false,
      defval: '',
    });
    const lines = rows.slice(0, 250).map((row) =>
      (Array.isArray(row) ? row : []).map((cell) => String(cell ?? '').trim()).join('\t')
    ).filter((line) => line.replace(/\t/g, '').trim());
    sections.push(`SHEET: ${sheetName}\n${lines.join('\n')}`);
  }
  return sections.join('\n\n').slice(0, 40000);
}

export async function pickAndAnalyzeReportFile(
  scopeId: string,
  selection: 'all' | 'photo' = 'all'
): Promise<ReportImportProposal | null> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: selection === 'photo' ? ['image/*'] : [
      'application/pdf',
      'image/*',
      'text/csv',
      'text/plain',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (picked.canceled || !picked.assets?.[0]) return null;

  const asset = picked.assets[0];
  const filename = asset.name || 'report-import';
  const mimeType = asset.mimeType || '';
  if (selection === 'photo' && !mimeType.startsWith('image/') && !/\.(jpe?g|png|webp)$/i.test(filename)) {
    throw new Error('Choose a JPG, PNG, or WebP photo.');
  }
  const response = await fetch(asset.uri);
  if (!response.ok) throw new Error('The selected file could not be opened.');
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > 12 * 1024 * 1024 && (mimeType.includes('pdf') || mimeType.startsWith('image/'))) {
    throw new Error('PDF/photo import is limited to about 12 MB per scan. Reduce the file size and retry.');
  }

  const lower = filename.toLowerCase();
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    const text = workbookToText(buffer);
    if (!text.trim()) throw new Error('No readable spreadsheet cells were found.');
    return invokeImport({ scopeId, filename, mimeType, extractedText: text });
  }

  if (lower.endsWith('.csv') || lower.endsWith('.txt') || mimeType.startsWith('text/')) {
    const text = new TextDecoder('utf-8').decode(buffer).slice(0, 40000);
    if (!text.trim()) throw new Error('No readable text was found in the selected file.');
    return invokeImport({ scopeId, filename, mimeType, extractedText: text });
  }

  if (mimeType.includes('pdf') || lower.endsWith('.pdf') || mimeType.startsWith('image/')) {
    const proposal = await invokeImport({
      scopeId,
      filename,
      mimeType: mimeType || (lower.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
      base64: encode(buffer),
    });
    if (mimeType.startsWith('image/') || /\.(jpe?g|png|webp)$/i.test(lower)) {
      proposal.photoAsset = { uri: asset.uri, filename, mimeType };
    }
    return proposal;
  }

  throw new Error('Supported imports: Excel, CSV/TXT, PDF, and photos/images.');
}

export async function uploadReportEvidencePhoto(args: {
  scopeId: string;
  assignmentId: string;
  asset: ReportPhotoAsset;
  confidence?: number;
  detectedFields?: string[];
}): Promise<ReportEvidencePhoto> {
  const auth = await supabase.auth.getUser();
  const user = auth.data.user;
  if (auth.error || !user) throw new Error('Sign in to add a report photo.');
  const name = args.asset.filename.toLowerCase();
  const detectedMime = args.asset.mimeType === 'image/png' || /\.png$/.test(name)
    ? 'image/png' as const
    : args.asset.mimeType === 'image/webp' || /\.webp$/.test(name)
      ? 'image/webp' as const : 'image/jpeg' as const;
  if (!/\.(jpe?g|png|webp)$/.test(name) && !args.asset.mimeType.startsWith('image/')) {
    throw new Error('Only JPG, PNG, and WebP evidence photos are supported.');
  }
  const response = await fetch(args.asset.uri);
  if (!response.ok) throw new Error('Could not reopen the selected image.');
  const buffer = await response.arrayBuffer();
  if (!buffer.byteLength || buffer.byteLength > 12 * 1024 * 1024) {
    throw new Error('Photo evidence must be 12 MB or smaller.');
  }
  const extension = detectedMime === 'image/png' ? 'png' : detectedMime === 'image/webp' ? 'webp' : 'jpg';
  const path = `${args.scopeId}/${user.id}/${args.assignmentId}/${Crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from('buklod-report-evidence').upload(path, buffer, {
    contentType: detectedMime,
    upsert: false,
    cacheControl: 'private,max-age=0',
  });
  if (error) throw error;
  return {
    path,
    filename: args.asset.filename.slice(0, 180),
    mime_type: detectedMime,
    uploaded_at: new Date().toISOString(),
    extraction_confidence: args.confidence,
    detected_fields: args.detectedFields?.slice(0, 60),
  };
}

function contentRows(content: Record<string, any>, scopeName: string, periodTitle: string) {
  const rows: Array<[string, string]> = [
    ['BUKLOD Report', periodTitle],
    ['Scope', scopeName],
    ['Overall Week', String(content.overall_week ?? '')],
    ['Private photo evidence (count)', String(Array.isArray(content.evidence_photos) ? content.evidence_photos.length : 0)],
  ];
  const activities = objectValue(content.activities);
  rows.push(['', '']);
  rows.push(['ACTIVITIES', 'COUNT / NOTE']);
  for (const row of Object.values(activities)) {
    const item = objectValue(row);
    if (item.selected === true || item.note) {
      rows.push([String(item.label ?? ''), String(item.note ?? '')]);
    }
  }
  rows.push(['', '']);
  rows.push(['PEOPLE / ATTENDANCE', 'VALUE']);
  const people = objectValue(content.people);
  for (const [key, value] of Object.entries(people)) {
    if (value !== null && value !== undefined && String(value).trim()) {
      rows.push([key.replace(/_/g, ' '), String(value)]);
    }
  }
  const concern = objectValue(content.concern);
  const nextPeriod = objectValue(content.next_period);
  rows.push(['', '']);
  rows.push(['Concern', String(concern.type ?? '')]);
  rows.push(['Concern Note', String(concern.note ?? '')]);
  rows.push(['Next Goal', String(nextPeriod.main_goal ?? '')]);
  rows.push(['Assistance Needed', String(nextPeriod.assistance_needed ?? '')]);
  rows.push(['Additional Note', String(content.additional_note ?? '')]);
  return rows;
}

function safeFilename(value: string) {
  return value.replace(/[^a-z0-9._-]+/gi, '-').replace(/-+/g, '-').slice(0, 80) || 'buklod-report';
}

function downloadBlob(blob: Blob, filename: string) {
  if (Platform.OS !== 'web') throw new Error('This export is currently available on the web app.');
  const doc = (globalThis as any).document;
  const urlApi = (globalThis as any).URL;
  if (!doc || !urlApi) throw new Error('Browser download is unavailable.');
  const url = urlApi.createObjectURL(blob);
  const link = doc.createElement('a');
  link.href = url;
  link.download = filename;
  doc.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => urlApi.revokeObjectURL(url), 500);
}

export function exportReportExcel(content: Record<string, any>, scopeName: string, periodTitle: string) {
  const sheet = XLSX.utils.aoa_to_sheet(contentRows(content, scopeName, periodTitle));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Report');
  const bytes = XLSX.write(book, { type: 'array', bookType: 'xlsx' });
  downloadBlob(
    new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `${safeFilename(scopeName)}-${safeFilename(periodTitle)}.xlsx`
  );
}

export function exportReportCsv(content: Record<string, any>, scopeName: string, periodTitle: string) {
  const sheet = XLSX.utils.aoa_to_sheet(contentRows(content, scopeName, periodTitle));
  const csv = XLSX.utils.sheet_to_csv(sheet);
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${safeFilename(scopeName)}-${safeFilename(periodTitle)}.csv`);
}

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[char] ?? char));
}

export function printReportPdf(content: Record<string, any>, scopeName: string, periodTitle: string) {
  if (Platform.OS !== 'web') throw new Error('PDF / Print export is currently available on the web app.');
  const win = (globalThis as any).window?.open('', '_blank', 'noopener,noreferrer');
  if (!win) throw new Error('Allow pop-ups to open the printable report.');
  const rows = contentRows(content, scopeName, periodTitle)
    .map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`)
    .join('');
  win.document.write(`<!doctype html><html><head><title>BUKLOD Report</title><style>
    body{font-family:Arial,sans-serif;padding:32px;color:#173B2F}h1{margin:0 0 4px}.meta{color:#66756D;margin-bottom:24px}
    table{width:100%;border-collapse:collapse}th,td{text-align:left;border-bottom:1px solid #ddd;padding:9px;vertical-align:top}th{width:34%;background:#f5f8f6}
    @media print{button{display:none}body{padding:0}}
  </style></head><body><h1>BUKLOD Report</h1><div class="meta">${escapeHtml(scopeName)} · ${escapeHtml(periodTitle)}</div><table>${rows}</table><p><button onclick="window.print()">Print / Save as PDF</button></p><script>setTimeout(()=>window.print(),300)</script></body></html>`);
  win.document.close();
}
