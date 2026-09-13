import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const failures = [];
const root = new URL('../', import.meta.url);
const rootPath = fileURLToPath(root);
const read = (filePath) => fs.readFileSync(new URL(filePath, root), 'utf8');
const exists = (filePath) => fs.existsSync(new URL(filePath, root));

const appEnv = String(process.env.EXPO_PUBLIC_APP_ENV ?? '').trim();
const appTarget = String(process.env.BUKLOD_APP_TARGET ?? '').trim();
const releaseTarget = String(process.env.REPORT_RELEASE_TARGET ?? '').trim().toLowerCase();
const supabaseUrl = String(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
const publishableKey = String(process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '').trim();
const reportEasProjectId = String(process.env.REPORT_EAS_PROJECT_ID ?? process.env.EXPO_PUBLIC_REPORT_EAS_PROJECT_ID ?? '').trim();
const expectedReportEasProjectId = 'cc69b3c0-a5df-4b69-a84c-887c36242fdd';

if (appEnv !== 'production') failures.push('EXPO_PUBLIC_APP_ENV must be production for the production-shaped QA web export.');
if (appTarget !== 'report') failures.push('BUKLOD_APP_TARGET must be report.');
if (releaseTarget !== 'web') failures.push('REPORT_RELEASE_TARGET must be web.');
if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(supabaseUrl)) failures.push('EXPO_PUBLIC_SUPABASE_URL is missing or is not a hosted Supabase URL.');
if (!publishableKey) failures.push('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required.');
if (/sb_secret_|service_role/i.test(publishableKey)) failures.push('A server secret/service-role key must never be embedded in the Report web client.');
if (reportEasProjectId && reportEasProjectId !== expectedReportEasProjectId) failures.push(`Standalone Report EAS project mismatch. Expected ${expectedReportEasProjectId}.`);

for (const filePath of [
  'app.config.js',
  'tsconfig.report.json',
  'src/report-app/_layout.tsx',
  'src/report-app/reports/index.web.tsx',
  'src/report-app/reports/template-builder.tsx',
  'src/app/reports/template-builder.tsx',
  'src/lib/buklodReportTemplateImport.ts',
  'supabase/functions/buklod-report-template-import-v1/index.ts',
  'supabase/functions/buklod-report-template-import-v1/docx-structure.ts',
]) {
  if (!exists(filePath)) failures.push(`Missing standalone Report web source: ${filePath}`);
}

if (exists('app.config.js')) {
  const source = read('app.config.js');
  for (const marker of [
    "owner: 'faust_0612'",
    "slug: 'buklod-report'",
    "output: 'static'",
    "root: './src/report-app'",
    expectedReportEasProjectId,
  ]) {
    if (!source.includes(marker)) failures.push(`Report app config is missing: ${marker}`);
  }
}

if (exists('src/app/reports/template-builder.tsx')) {
  const source = read('src/app/reports/template-builder.tsx');
  for (const marker of [
    "status: 'DRAFT'",
    'DRAFT SAVED SUCCESSFULLY',
    'Preview form',
    'Continue editing',
    'Back to Report Management',
    'No assignment, deadline, member notification, submission record, or member-visible report was created.',
    'setTimeout(() => goToLibrary(), 7000)',
  ]) {
    if (!source.includes(marker)) failures.push(`Post-save draft workflow is missing: ${marker}`);
  }
}

if (exists('src/lib/buklodReportTemplateImport.ts')) {
  const source = read('src/lib/buklodReportTemplateImport.ts');
  for (const marker of [
    'new FormData()',
    "form.append('file'",
    'supabase.auth.getSession()',
    'Authorization: `Bearer ${accessToken}`',
    'STRICT_FILLABLE_FORM_HINT',
  ]) {
    if (!source.includes(marker)) failures.push(`Report template web upload contract is missing: ${marker}`);
  }
}

if (exists('supabase/functions/buklod-report-template-import-v1/index.ts')) {
  const source = read('supabase/functions/buklod-report-template-import-v1/index.ts');
  for (const marker of [
    'ANALYZER_VERSION = "v8"',
    'buildDocxStructureDraft',
    'REPORT_TEMPLATE_DOCX_STRUCTURE_USED',
    'STRICT FILLABLE-FIELD RULE',
    'When uncertain, prefer STATIC text and omit the field.',
    'provider: "docx-structure"',
    'REPORT_TEMPLATE_AI_ATTEMPT',
  ]) {
    if (!source.includes(marker)) failures.push(`Report template analyzer contract is missing: ${marker}`);
  }
}

if (exists('supabase/functions/buklod-report-template-import-v1/docx-structure.ts')) {
  const source = read('supabase/functions/buklod-report-template-import-v1/docx-structure.ts');
  for (const marker of ['buildDocxStructureDraft', 'word/document.xml', 'blankMarkerIndex', 'tableRows']) {
    if (!source.includes(marker)) failures.push(`DOCX structure parser is missing: ${marker}`);
  }
}

console.log('BUKLOD Report Web QA Preflight');
console.log('==========================================');
console.log(`Project root: ${rootPath}`);
for (const failure of failures) console.error(`FAIL: ${failure}`);
if (failures.length) {
  console.error(`\nREPORT WEB QA PREFLIGHT FAILED with ${failures.length} blocker(s).`);
  process.exit(1);
}
console.log('\nREPORT WEB QA PREFLIGHT PASSED.');
