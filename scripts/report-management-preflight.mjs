import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const failures = [];
const read = (filePath) => fs.readFileSync(new URL(filePath, root), 'utf8');
const exists = (filePath) => fs.existsSync(new URL(filePath, root));

const required = [
  'supabase/migrations/20260912_buklod_report_management_loop_r1.sql',
  'supabase/migrations/20260913_buklod_report_management_loop_hardening_r1.sql',
  'supabase/functions/buklod-report-template-import-v1/index.ts',
  'src/lib/buklodReportTemplateImport.ts',
  'src/lib/buklodReportConsolidation.ts',
  'src/lib/buklodReportActions.ts',
  'src/lib/buklodReportManagementDocument.ts',
  'src/lib/buklodReportDocumentOutput.ts',
  'src/lib/buklodReportDocumentOutput.web.ts',
  'src/app/reports/actions.tsx',
  'src/app/reports/consolidated.tsx',
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
  for (const marker of ['function inferMimeType', 'application/octet-stream', 'const mimeType = inferMimeType(filename, body?.mime_type)']) {
    if (!source.includes(marker)) failures.push(`Template analyzer MIME recovery is missing: ${marker}`);
  }
}

if (exists('src/lib/buklodReportTemplateImport.ts')) {
  const source = read('src/lib/buklodReportTemplateImport.ts');
  for (const marker of ['inferMimeType', 'normalizeDraft', 'buklod-report-template-import-v1']) {
    if (!source.includes(marker)) failures.push(`Template import client recovery is missing: ${marker}`);
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
