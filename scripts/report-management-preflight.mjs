import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const failures = [];
const read = (filePath) => fs.readFileSync(new URL(filePath, root), 'utf8');
const exists = (filePath) => fs.existsSync(new URL(filePath, root));

const required = [
  'supabase/migrations/20260912_buklod_report_management_loop_r1.sql',
  'supabase/migrations/20260913_buklod_report_management_loop_hardening_r1.sql',
  'supabase/functions/buklod-report-template-import-v1/index.ts',
  'supabase/functions/buklod-report-template-import-v1/docx-structure.ts',
  'src/lib/buklodReportTemplateImport.ts',
  'src/lib/buklodReportAssetBase64.web.ts',
  'src/lib/buklodReportConsolidation.ts',
  'src/lib/buklodReportActions.ts',
  'src/lib/buklodReportManagementDocument.ts',
  'src/lib/buklodReportDocumentOutput.ts',
  'src/lib/buklodReportDocumentOutput.web.ts',
  'src/app/reports/actions.tsx',
  'src/app/reports/consolidated.tsx',
  'src/app/reports/template-builder.tsx',
];
for (const filePath of required) {
  if (!exists(filePath)) failures.push(`Missing management-loop source: ${filePath}`);
}

if (exists('supabase/migrations/20260913_buklod_report_management_loop_hardening_r1.sql')) {
  const source = read('supabase/migrations/20260913_buklod_report_management_loop_hardening_r1.sql');
  for (const marker of [
    "membership_status = 'ACTIVE'",
    "Action assignee must be an active member of this scope",
    "action_type not in ('REASSIGNMENT_REVIEW','SUSPENSION_REVIEW','DISMISSAL_REVIEW')",
    'requires supervisor-only review',
  ]) {
    if (!source.includes(marker)) failures.push(`Management hardening migration is missing: ${marker}`);
  }
}

if (exists('supabase/functions/buklod-report-template-import-v1/index.ts')) {
  const source = read('supabase/functions/buklod-report-template-import-v1/index.ts');
  for (const marker of [
    'ANALYZER_VERSION = "v8"',
    'buildDocxStructureDraft',
    'function inferMimeType',
    'application/octet-stream',
    'multipart/form-data',
    'await req.formData()',
    'fileValue instanceof File',
    'responseJsonSchema',
    'type: "object"',
    'REPORT_TEMPLATE_FILE_ANALYZE_STARTED',
    'REPORT_TEMPLATE_FILE_ANALYZE_FAILED',
    'REPORT_TEMPLATE_DOCX_STRUCTURE_USED',
    'REPORT_TEMPLATE_AI_ATTEMPT',
    'provider: "docx-structure"',
    'target_id: args.requestId',
    'request_id: requestId',
    'analyzer_version: ANALYZER_VERSION',
  ]) {
    if (!source.includes(marker)) failures.push(`Template analyzer v8 hardening is missing: ${marker}`);
  }
  if (/from\s+["']npm:unpdf/i.test(source) || source.includes('getDocumentProxy(')) {
    failures.push('PDF report forms must go directly to multimodal analysis instead of local Edge PDF parsing.');
  }
  if (/responseJsonSchema[\s\S]{0,3000}type:\s*["'](?:OBJECT|STRING|ARRAY|NUMBER|BOOLEAN)["']/.test(source)) {
    failures.push('responseJsonSchema must use standard lowercase JSON Schema type names.');
  }
  if (source.includes('target_id: null')) {
    failures.push('Template analyzer audit rows must use a real request UUID because audit target_id is NOT NULL.');
  }
}

if (exists('supabase/functions/buklod-report-template-import-v1/docx-structure.ts')) {
  const source = read('supabase/functions/buklod-report-template-import-v1/docx-structure.ts');
  for (const marker of [
    'buildDocxStructureDraft',
    'word/document.xml',
    'blankMarkerIndex',
    'explicitColonBlank',
    'tableRows',
    'chooseHeaderRow',
    'Generated directly from the Word document structure without AI',
  ]) {
    if (!source.includes(marker)) failures.push(`DOCX structure parser is missing: ${marker}`);
  }
}

if (exists('src/lib/buklodReportTemplateImport.ts')) {
  const source = read('src/lib/buklodReportTemplateImport.ts');
  for (const marker of [
    'inferMimeType',
    'normalizeDraft',
    'buklod-report-template-import-v1',
    'new FormData()',
    "form.append('file'",
    'asset.file',
    'ANALYZE_TIMEOUT_MS',
    'supabase.auth.getSession()',
    'Authorization: `Bearer ${accessToken}`',
    'apikey: SUPABASE_PUBLISHABLE_KEY',
    'TEMPLATE_ANALYZER_URL',
    'signal: controller.signal',
    'await parseAnalyzerResponse(response)',
    'STRICT_FILLABLE_FORM_HINT',
    'Create an input field ONLY when the original document visibly expects',
    'When uncertain whether text is static or fillable, prefer STATIC text and omit the field',
    "form.append('report_kind_hint', analyzerHint)",
  ]) {
    if (!source.includes(marker)) failures.push(`Template import explicit-auth/strict-fillable contract is missing: ${marker}`);
  }
  if (source.includes("supabase.functions.invoke('buklod-report-template-import-v1'")) {
    failures.push('Template analyzer upload must use the explicit authenticated fetch path, not implicit functions.invoke auth.');
  }
}

if (exists('src/app/reports/template-builder.tsx')) {
  const source = read('src/app/reports/template-builder.tsx');
  for (const marker of [
    'type SavedDraftState',
    'const [savedDraft, setSavedDraft]',
    'const saved = await upsertReportDefinition',
    'DRAFT SAVED SUCCESSFULLY',
    'No assignment, deadline, member notification, submission record, or member-visible report was created.',
    'Preview form',
    'Continue editing',
    'Back to Report Management',
    "pathname: '/reports/library'",
    "pathname: '/reports/template-builder'",
    'setTimeout(() => goToLibrary(), 7000)',
    'FORM PREVIEW',
  ]) {
    if (!source.includes(marker)) failures.push(`Post-save draft workflow is missing: ${marker}`);
  }
  if (source.includes("Alert.alert('Template saved'")) {
    failures.push('Template save must use the explicit post-save draft workflow, not a generic save alert.');
  }
}

if (exists('src/lib/buklodReportAssetBase64.web.ts')) {
  const source = read('src/lib/buklodReportAssetBase64.web.ts');
  for (const marker of ['asset.base64', 'asset.file', 'fetch(asset.uri)']) {
    if (!source.includes(marker)) failures.push(`Browser form-file reader is missing: ${marker}`);
  }
}

if (exists('src/lib/buklodReportActions.ts')) {
  const source = read('src/lib/buklodReportActions.ts');
  for (const marker of ['SUPERVISOR_ONLY_ACTION_TYPES', 'REASSIGNMENT_REVIEW', 'SUSPENSION_REVIEW', 'DISMISSAL_REVIEW']) {
    if (!source.includes(marker)) failures.push(`Member-action safety is missing: ${marker}`);
  }
}

if (exists('src/app/reports/consolidated.tsx')) {
  const source = read('src/app/reports/consolidated.tsx');
  if (!source.includes('never happens automatically')) failures.push('High-impact personnel review must remain explicitly non-automatic.');
  for (const marker of ['exportScopeManagementWord', 'doWordExport', 'file-word-outline', 'Word summary']) {
    if (!source.includes(marker)) failures.push(`Management Word export dashboard wiring is missing: ${marker}`);
  }
}

if (exists('src/lib/buklodReportManagementDocument.ts')) {
  const source = read('src/lib/buklodReportManagementDocument.ts');
  for (const marker of ['exportScopeManagementWord', 'overall status', 'actions', 'next action']) {
    if (!source.toLowerCase().includes(marker.toLowerCase())) failures.push(`Management Word export document is missing: ${marker}`);
  }
}

console.log('BUKLOD Report Management Preflight');
console.log('==========================================');
for (const failure of failures) console.error(`FAIL: ${failure}`);
if (failures.length) {
  console.error(`\nREPORT MANAGEMENT PREFLIGHT FAILED with ${failures.length} blocker(s).`);
  process.exit(1);
}
console.log('\nREPORT MANAGEMENT PREFLIGHT PASSED.');