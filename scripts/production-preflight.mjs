import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const failures = [];
const warnings = [];

// Mandatory release invariant: production may move forward only when the complete
// forward-compatible R31 core + R40 special-character package is present.
const characterContractPath = fileURLToPath(new URL('./character-release-contract.mjs', import.meta.url));
const characterContract = spawnSync(process.execPath, [characterContractPath], {
  cwd: fileURLToPath(new URL('../', import.meta.url)),
  stdio: 'inherit',
});
if (characterContract.status !== 0) {
  failures.push('Canonical R31/R40 character release contract failed.');
}

const env = process.env.EXPO_PUBLIC_APP_ENV || '';
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
const easProjectId = process.env.EAS_PROJECT_ID || process.env.EXPO_PUBLIC_EAS_PROJECT_ID || '';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

if (env !== 'production') {
  failures.push('EXPO_PUBLIC_APP_ENV must be production.');
}

if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(supabaseUrl)) {
  failures.push('EXPO_PUBLIC_SUPABASE_URL is not a hosted Supabase project URL.');
}

if (!/^sb_publishable_/i.test(publishableKey)) {
  failures.push('Production Expo client must use a Supabase publishable key.');
}

if (/sb_secret_|service_role/i.test(publishableKey)) {
  failures.push('A secret/service-role key is present in the client key variable.');
}

if (!easProjectId) {
  failures.push('EAS_PROJECT_ID is required for the production build.');
}

const appConfig = read('app.config.js');
if (!appConfig.includes("'org.mzbministry.buklod'")) {
  failures.push('Production package/bundle identifier is missing.');
}

const legal = read('src/lib/legal.ts');
if (legal.includes('REQUIRED BEFORE LAUNCH')) {
  failures.push('Privacy notice still contains REQUIRED BEFORE LAUNCH placeholders.');
}

if (legal.includes('[OFFICIAL PRIVACY/DPO EMAIL')) {
  failures.push('Privacy notice still contains the privacy/DPO email placeholder.');
}

if (legal.includes('[OFFICIAL ORGANIZATION ADDRESS')) {
  failures.push('Privacy notice still contains the organization-address placeholder.');
}

const productionSeedUrl = new URL('../supabase/seed.production.sql', import.meta.url);
if (fs.existsSync(productionSeedUrl)) {
  const seedProd = fs.readFileSync(productionSeedUrl, 'utf8');
  if (/Leadership Pilot|Pilot Week|QA Church|test user/i.test(seedProd)) {
    failures.push('Production seed appears to contain staging/pilot/demo data.');
  }
} else {
  warnings.push(
    'No production seed is bundled; release is migrations-only and will not inject demo/baseline data.'
  );
}

const migrations = fs.readdirSync(new URL('../supabase/migrations/', import.meta.url))
  .filter(x => x.endsWith('.sql'))
  .sort();

if (migrations.length === 0) {
  failures.push('No production migrations were found.');
}

const migrationVersions = migrations.map(name => name.match(/^(\d{14})_/)?.[1] ?? '');
if (migrationVersions.some(version => !version)) {
  failures.push('Every production migration must begin with a 14-digit timestamp.');
}

const duplicateVersions = migrationVersions.filter(
  (version, index) => version && migrationVersions.indexOf(version) !== index
);
if (duplicateVersions.length) {
  failures.push(
    `Duplicate migration versions detected: ${[...new Set(duplicateVersions)].join(', ')}`
  );
}

for (let i=1;i<migrations.length;i++) {
  if (migrations[i] <= migrations[i-1]) {
    failures.push('Migration filenames are not strictly ordered.');
    break;
  }
}

const releaseManifest = JSON.parse(read('release/PRODUCTION_RELEASE_MANIFEST.json'));
if (releaseManifest.version !== '1.3.1') {
  failures.push(`Release manifest version is ${releaseManifest.version}, expected 1.3.1 for this BUKLOD Main release.`);
}

console.log('BUKLOD Production Preflight');
console.log('===========================');

for (const w of warnings) console.log(`WARN: ${w}`);
for (const f of failures) console.error(`FAIL: ${f}`);

if (failures.length) {
  console.error(`\nPRODUCTION PREFLIGHT FAILED with ${failures.length} blocker(s).`);
  process.exit(1);
}

console.log('\nPRODUCTION PREFLIGHT PASSED.');
