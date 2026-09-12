import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const failures = [];
const warnings = [];

const env = process.env.EXPO_PUBLIC_APP_ENV || '';
const appTarget = process.env.BUKLOD_APP_TARGET || '';
const releaseTarget = (process.env.REPORT_RELEASE_TARGET || 'android').trim().toLowerCase();
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
const reportEasProjectId = (
  process.env.REPORT_EAS_PROJECT_ID ||
  process.env.EXPO_PUBLIC_REPORT_EAS_PROJECT_ID ||
  ''
).trim();
const reportGoogleServicesFile = (process.env.REPORT_GOOGLE_SERVICES_FILE || '').trim();

const root = new URL('../', import.meta.url);
const rootPath = fileURLToPath(root);
const read = (filePath) => fs.readFileSync(new URL(filePath, root), 'utf8');
const exists = (filePath) => fs.existsSync(new URL(filePath, root));

if (!['web', 'android'].includes(releaseTarget)) {
  failures.push('REPORT_RELEASE_TARGET must be web or android.');
}
if (env !== 'production') failures.push('EXPO_PUBLIC_APP_ENV must be production.');
if (appTarget && appTarget !== 'report') failures.push('BUKLOD_APP_TARGET must be report when set.');
if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(supabaseUrl)) {
  failures.push('EXPO_PUBLIC_SUPABASE_URL is not a hosted Supabase project URL.');
}
if (!/^sb_publishable_/i.test(publishableKey)) {
  failures.push('Production Report client must use a Supabase publishable key.');
}
if (/sb_secret_|service_role/i.test(publishableKey)) {
  failures.push('A secret/service-role key is present in the client key variable.');
}
if (!reportEasProjectId) {
  failures.push('REPORT_EAS_PROJECT_ID (or EXPO_PUBLIC_REPORT_EAS_PROJECT_ID) is required for standalone Report release/deployment.');
}

if (releaseTarget === 'android') {
  if (!reportGoogleServicesFile) {
    failures.push('REPORT_GOOGLE_SERVICES_FILE is required for the standalone Report Android build. Never reuse BUKLOD Main Firebase credentials.');
  } else {
    const absoluteGoogleServicesPath = path.isAbsolute(reportGoogleServicesFile)
      ? reportGoogleServicesFile
      : path.resolve(rootPath, reportGoogleServicesFile);
    if (!fs.existsSync(absoluteGoogleServicesPath)) {
      failures.push(`REPORT_GOOGLE_SERVICES_FILE does not exist: ${reportGoogleServicesFile}`);
    } else {
      try {
        const firebaseConfig = JSON.parse(fs.readFileSync(absoluteGoogleServicesPath, 'utf8'));
        const packageNames = (firebaseConfig?.client ?? [])
          .map((client) => client?.client_info?.android_client_info?.package_name)
          .filter(Boolean);
        if (!packageNames.includes('org.mzbministry.buklod.report')) {
          failures.push('Dedicated Firebase config does not contain the production Report package org.mzbministry.buklod.report.');
        }
        if (packageNames.includes('org.mzbministry.buklod')) {
          failures.push('REPORT_GOOGLE_SERVICES_FILE appears to contain the BUKLOD Main package. Use the dedicated Report Firebase app instead.');
        }
      } catch (error) {
        failures.push(`REPORT_GOOGLE_SERVICES_FILE is not valid JSON: ${String(error?.message ?? error)}`);
      }
    }
  }
}

const appConfig = read('app.config.js');
for (const expected of [
  "slug: 'buklod-report'",
  "'org.mzbministry.buklod.report'",
  "'buklod-report'",
  "output: 'static'",
  "appTarget: 'report'",
  'REPORT_EAS_PROJECT_ID',
  'REPORT_GOOGLE_SERVICES_FILE',
]) {
  if (!appConfig.includes(expected)) failures.push(`Standalone Report app config is missing required marker: ${expected}`);
}
if (/google-services\.json['\"]/.test(appConfig) && !appConfig.includes('REPORT_GOOGLE_SERVICES_FILE')) {
  failures.push('app.config.js contains a hard-coded Google Services path instead of the dedicated Report variable.');
}

const easConfig = read('eas.json');
for (const marker of ['report-development', 'report-preview', 'report-production', '"BUKLOD_APP_TARGET": "report"']) {
  if (!easConfig.includes(marker)) failures.push(`eas.json is missing standalone Report marker: ${marker}`);
}

const requiredReportFiles = [
  'src/app/report-login.tsx',
  'src/app/report-access-pending.tsx',
  'src/app/reports/index.tsx',
  'src/app/reports/library.tsx',
  'src/app/reports/definitions.tsx',
  'src/app/reports/template-builder.tsx',
  'src/app/reports/consolidated.tsx',
  'src/providers/BuklodReportRouteGuard.tsx',
  'src/providers/BuklodReportScopeProvider.tsx',
  'src/providers/BuklodReportNotificationProvider.tsx',
  'src/components/BuklodReportAssignmentForm.tsx',
  'src/components/BuklodWeeklyReportForm.tsx',
  'src/lib/buklodReportDeadlines.ts',
  'src/lib/buklodReportTemplateImport.ts',
  'src/lib/buklodReportConsolidation.ts',
];
for (const filePath of requiredReportFiles) {
  if (!exists(filePath)) failures.push(`Required standalone Report source is missing: ${filePath}`);
}

const requiredMigrations = [
  'supabase/migrations/20260912_buklod_report_real_deadlines_r1.sql',
  'supabase/migrations/20260912_buklod_report_consolidated_export_r1.sql',
  'supabase/migrations/20260912_buklod_report_publish_requires_fields_r1.sql',
  'supabase/migrations/20260912_buklod_report_template_file_bucket_r1.sql',
];
for (const filePath of requiredMigrations) {
  if (!exists(filePath)) failures.push(`Required Report migration source is missing: ${filePath}`);
}

const quickWeekly = read('src/components/BuklodWeeklyReportForm.tsx');
if (!quickWeekly.includes('pickAndAnalyzeReportFile')) {
  failures.push('MZB Quick Weekly file/photo import is missing from the standalone Report form.');
}
if (!quickWeekly.includes('updateQuickWeeklyReminder')) {
  failures.push('MZB Quick Weekly reminder actions are missing from the standalone Report form.');
}

const routeGuard = read('src/providers/BuklodReportRouteGuard.tsx');
if (!routeGuard.includes('report-access-pending') || !routeGuard.includes('hasCanonicalAccess')) {
  failures.push('Standalone Report route/account containment is incomplete.');
}
const notificationProvider = read('src/providers/BuklodReportNotificationProvider.tsx');
if (/selectScope|activeScope|setBuklodActiveScope/.test(notificationProvider)) {
  failures.push('Standalone Report push routing must not select or persist BUKLOD Main active scope.');
}

const legacyLogin = exists('src/app/(auth)/login.tsx') ? read('src/app/(auth)/login.tsx') : '';
if (legacyLogin.includes("router.replace(\n      '/(tabs)/home'")) {
  warnings.push('Legacy Main login source still exists in the repository, but standalone boot/route containment prevents it from being used by Report.');
}

console.log(`BUKLOD Report Production Preflight (${releaseTarget})`);
console.log('==========================================');
for (const warning of warnings) console.log(`WARN: ${warning}`);
for (const failure of failures) console.error(`FAIL: ${failure}`);
if (failures.length) {
  console.error(`\nREPORT PRODUCTION PREFLIGHT FAILED with ${failures.length} blocker(s).`);
  process.exit(1);
}
console.log('\nREPORT PRODUCTION PREFLIGHT PASSED.');
