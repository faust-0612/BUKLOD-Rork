import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const failures = [];
const warnings = [];

const sourceOnly = process.env.REPORT_PREFLIGHT_SOURCE_ONLY === '1';
const env = process.env.EXPO_PUBLIC_APP_ENV || '';
const appTarget = process.env.BUKLOD_APP_TARGET || '';
const releaseTarget = (process.env.REPORT_RELEASE_TARGET || 'android').trim().toLowerCase();
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
const expectedReportEasProjectId = 'cc69b3c0-a5df-4b69-a84c-887c36242fdd';
const requestedReportEasProjectId = (
  process.env.REPORT_EAS_PROJECT_ID ||
  process.env.EXPO_PUBLIC_REPORT_EAS_PROJECT_ID ||
  ''
).trim();
const reportGoogleServicesFile = (process.env.REPORT_GOOGLE_SERVICES_FILE || '').trim();

const root = new URL('../', import.meta.url);
const rootPath = fileURLToPath(root);
const read = (filePath) => fs.readFileSync(new URL(filePath, root), 'utf8');
const exists = (filePath) => fs.existsSync(new URL(filePath, root));

if (!sourceOnly) {
  if (!['web', 'android'].includes(releaseTarget)) failures.push('REPORT_RELEASE_TARGET must be web or android.');
  if (env !== 'production') failures.push('EXPO_PUBLIC_APP_ENV must be production.');
  if (appTarget && appTarget !== 'report') failures.push('BUKLOD_APP_TARGET must be report when set.');
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(supabaseUrl)) failures.push('EXPO_PUBLIC_SUPABASE_URL is not a hosted Supabase project URL.');
  if (!/^sb_publishable_/i.test(publishableKey)) failures.push('Production Report client must use a Supabase publishable key.');
  if (/sb_secret_|service_role/i.test(publishableKey)) failures.push('A secret/service-role key is present in the client key variable.');
  if (requestedReportEasProjectId && requestedReportEasProjectId !== expectedReportEasProjectId) {
    failures.push(`Standalone Report EAS project mismatch. Expected ${expectedReportEasProjectId}.`);
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
}

const appConfig = read('app.config.js');
for (const expected of [
  "owner: 'faust_0612'",
  "slug: 'buklod-report'",
  "'org.mzbministry.buklod.report'",
  "'buklod-report'",
  "output: 'static'",
  "root: './src/report-app'",
  "appTarget: 'report'",
  expectedReportEasProjectId,
  'REPORT_GOOGLE_SERVICES_FILE',
]) {
  if (!appConfig.includes(expected)) failures.push(`Standalone Report app config is missing required marker: ${expected}`);
}
if (/google-services\.json['\"]/.test(appConfig) && !appConfig.includes('REPORT_GOOGLE_SERVICES_FILE')) {
  failures.push('app.config.js contains a hard-coded Google Services path instead of the dedicated Report variable.');
}

const entry = read('index.js');
if (!entry.includes("import 'expo-router/entry'")) failures.push('Standalone Report entry must boot expo-router/entry.');
if (/setPushConfig|setFirebaseListeners|streamVideo/i.test(entry)) {
  failures.push('Standalone Report entry must not boot BUKLOD Main Stream/Firebase listeners.');
}

const rootLayout = read('src/app/_layout.tsx');
if (!rootLayout.includes('BuklodReportNotificationProvider') || !rootLayout.includes('BuklodReportRouteGuard')) {
  failures.push('Standalone Report root layout must keep the Report-only notification provider and route guard.');
}
if (/StreamVideo|setPushConfig|setFirebaseListeners|@react-native-firebase\/messaging/i.test(rootLayout)) {
  failures.push('Standalone Report root layout must not boot BUKLOD Main Stream/Firebase listeners.');
}

const scopeCompat = read('src/providers/BuklodScopeProvider.tsx');
if (!scopeCompat.includes('BuklodReportScopeProvider') || !scopeCompat.includes('useBuklodReportScope')) {
  failures.push('BuklodScopeProvider compatibility path must resolve to the standalone read-only Report scope provider.');
}

const easConfig = read('eas.json');
for (const marker of ['report-development', 'report-preview', 'report-production', '"BUKLOD_APP_TARGET": "report"']) {
  if (!easConfig.includes(marker)) failures.push(`eas.json is missing standalone Report marker: ${marker}`);
}

const requiredRouterFiles = [
  'src/report-app/_layout.tsx',
  'src/report-app/index.tsx',
  'src/report-app/report-login.tsx',
  'src/report-app/report-access-pending.tsx',
  'src/report-app/privacy/consent.tsx',
  'src/report-app/system/maintenance.tsx',
  'src/report-app/system/update-required.tsx',
  'src/report-app/system/pilot-access.tsx',
  'src/report-app/reports/index.tsx',
  'src/report-app/reports/index.web.tsx',
  'src/report-app/reports/library.tsx',
  'src/report-app/reports/definitions.tsx',
  'src/report-app/reports/template-builder.tsx',
  'src/report-app/reports/consolidated.tsx',
  'tsconfig.report.json',
];
for (const filePath of requiredRouterFiles) {
  if (!exists(filePath)) failures.push(`Standalone Report router/typecheck isolation file is missing: ${filePath}`);
}

const requiredReportFiles = [
  'src/app/_layout.tsx',
  'src/app/report-login.tsx',
  'src/app/report-access-pending.tsx',
  'src/app/reports/index.tsx',
  'src/app/reports/library.tsx',
  'src/app/reports/definitions.tsx',
  'src/app/reports/template-builder.tsx',
  'src/app/reports/consolidated.tsx',
  'src/providers/BuklodScopeProvider.tsx',
  'src/providers/BuklodReportRouteGuard.tsx',
  'src/providers/BuklodReportScopeProvider.tsx',
  'src/providers/BuklodReportNotificationProvider.tsx',
  'src/providers/BuklodReportNotificationProvider.web.tsx',
  'src/components/BuklodReportAssignmentForm.tsx',
  'src/components/BuklodWeeklyReportForm.tsx',
  'src/components/BuklodReportWebAdBanner.tsx',
  'src/components/BuklodReportWebAdBanner.web.tsx',
  'src/lib/buklodReportDeadlines.ts',
  'src/lib/buklodReportTemplateImport.ts',
  'src/lib/buklodReportConsolidation.ts',
  'src/lib/buklodReportAssetBase64.ts',
  'src/lib/buklodReportAssetBase64.web.ts',
  'src/lib/buklodReportWorkbookOutput.ts',
  'src/lib/buklodReportWorkbookOutput.web.ts',
  'supabase/functions/buklod-report-api-v1/index.ts',
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

const reportTsconfig = read('tsconfig.report.json');
if (!reportTsconfig.includes('src/report-app/**/*.tsx')) failures.push('tsconfig.report.json is not scoped to the standalone Report router graph.');

const quickWeekly = read('src/components/BuklodWeeklyReportForm.tsx');
if (!quickWeekly.includes('pickAndAnalyzeReportFile')) failures.push('MZB Quick Weekly file/photo import is missing from the standalone Report form.');
if (!quickWeekly.includes('updateQuickWeeklyReminder')) failures.push('MZB Quick Weekly reminder actions are missing from the standalone Report form.');

const routeGuard = read('src/providers/BuklodReportRouteGuard.tsx');
if (!routeGuard.includes('report-access-pending') || !routeGuard.includes('hasCanonicalAccess')) failures.push('Standalone Report route/account containment is incomplete.');

const notificationProvider = read('src/providers/BuklodReportNotificationProvider.tsx');
if (/selectScope|activeScope|setBuklodActiveScope/.test(notificationProvider)) failures.push('Standalone Report push routing must not select or persist BUKLOD Main active scope.');
const notificationWebProvider = read('src/providers/BuklodReportNotificationProvider.web.tsx');
if (notificationWebProvider.includes('expo-notifications')) failures.push('Standalone Report web root must not import expo-notifications during static rendering.');

const templateWebHelper = read('src/lib/buklodReportAssetBase64.web.ts');
if (/expo-file-system|expo-sharing/.test(templateWebHelper)) failures.push('Web template-file reader must not import native FileSystem/Sharing modules.');
const workbookWebHelper = read('src/lib/buklodReportWorkbookOutput.web.ts');
if (/expo-file-system|expo-sharing/.test(workbookWebHelper)) failures.push('Web workbook output must not import native FileSystem/Sharing modules.');

const nativeAdBanner = read('src/components/BuklodReportWebAdBanner.tsx');
if (!/return\s+null/.test(nativeAdBanner)) failures.push('Native Report ad banner must remain a no-op.');
if (/react-native-google-mobile-ads|AdMob|BannerAd/.test(nativeAdBanner)) failures.push('Standalone Report native ad banner must not introduce AdMob/native ad dependencies.');

const webAdBanner = read('src/components/BuklodReportWebAdBanner.web.tsx');
for (const marker of ['EXPO_PUBLIC_REPORT_ADSENSE_ENABLED', 'EXPO_PUBLIC_REPORT_ADSENSE_CLIENT', 'EXPO_PUBLIC_REPORT_ADSENSE_SLOT', 'pagead2.googlesyndication.com']) {
  if (!webAdBanner.includes(marker)) failures.push(`Web Report ad banner is missing required marker: ${marker}`);
}
if (!webAdBanner.includes("typeof window === 'undefined'") || !webAdBanner.includes("typeof document === 'undefined'")) {
  failures.push('Web Report ad banner must remain safe during Expo static rendering.');
}

const webReportRoute = read('src/report-app/reports/index.web.tsx');
if (!webReportRoute.includes('showDashboardBanner') || !webReportRoute.includes('!scopeId && !assignmentId')) {
  failures.push('Web Report ads must remain limited to the top-level dashboard and stay out of scoped/assignment flows.');
}

const envExample = read('.env.example');
const envProductionExample = read('.env.production.example');
for (const marker of ['EXPO_PUBLIC_REPORT_ADSENSE_ENABLED', 'EXPO_PUBLIC_REPORT_ADSENSE_CLIENT', 'EXPO_PUBLIC_REPORT_ADSENSE_SLOT']) {
  if (!envExample.includes(marker)) failures.push(`.env.example is missing Report web ad marker: ${marker}`);
  if (!envProductionExample.includes(marker)) failures.push(`.env.production.example is missing Report web ad marker: ${marker}`);
}

const legacyLogin = exists('src/app/(auth)/login.tsx') ? read('src/app/(auth)/login.tsx') : '';
if (legacyLogin.includes("router.replace(\n      '/(tabs)/home'")) {
  warnings.push('Legacy Main login source remains in the shared repository, but the standalone router root excludes it from the Report package.');
}

console.log(sourceOnly
  ? 'BUKLOD Report Source Preflight'
  : `BUKLOD Report Production Preflight (${releaseTarget})`);
console.log('==========================================');
for (const warning of warnings) console.log(`WARN: ${warning}`);
for (const failure of failures) console.error(`FAIL: ${failure}`);
if (failures.length) {
  console.error(`\nREPORT ${sourceOnly ? 'SOURCE' : 'PRODUCTION'} PREFLIGHT FAILED with ${failures.length} blocker(s).`);
  process.exit(1);
}
console.log(`\nREPORT ${sourceOnly ? 'SOURCE' : 'PRODUCTION'} PREFLIGHT PASSED.`);
