import fs from 'node:fs';

const failures = [];
const warnings = [];

const url = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
const appEnv = process.env.EXPO_PUBLIC_APP_ENV || '';
const easProjectId = process.env.EAS_PROJECT_ID || process.env.EXPO_PUBLIC_EAS_PROJECT_ID || '';

if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)) {
  failures.push('EXPO_PUBLIC_SUPABASE_URL must be a hosted Supabase project URL.');
}

if (!/^sb_publishable_/i.test(key)) {
  failures.push('Use a Supabase publishable key in EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.');
}

if (/service_role|sb_secret_/i.test(key)) {
  failures.push('A secret/service-role key must never be used in the Expo client.');
}

if (appEnv !== 'staging') {
  failures.push('EXPO_PUBLIC_APP_ENV must be staging for the staging gate.');
}

// Refuse a staging job that points to the known BUKLOD Connect production project.
// This check is deliberately fail-closed even if a staging label is supplied.
const productionRef = 'yhanxndaqbmuzbdqlblu';
if (url.toLowerCase().includes(productionRef + '.supabase.co')) {
  failures.push('Staging must never target the BUKLOD Connect production Supabase project.');
}
if (process.env.CI && !process.env.BUKLOD_STAGING_PROJECT_REF) {
  failures.push('CI staging requires an explicitly configured BUKLOD_STAGING_PROJECT_REF.');
}
if (process.env.BUKLOD_STAGING_PROJECT_REF) {
  const expected = 'https://' + process.env.BUKLOD_STAGING_PROJECT_REF + '.supabase.co';
  if (url.toLowerCase() !== expected.toLowerCase()) {
    failures.push('Staging Supabase URL does not match BUKLOD_STAGING_PROJECT_REF.');
  }
}

if (!easProjectId) {
  warnings.push('EAS_PROJECT_ID is not set; EAS builds/updates may not be fully linked yet.');
}

const migrationDir = new URL('../supabase/migrations/', import.meta.url);
const migrations = fs.readdirSync(migrationDir).filter(x => x.endsWith('.sql')).sort();

if (migrations.length !== 13) {
  failures.push(`Expected 13 canonical schema migrations; found ${migrations.length}.`);
}

const seed = fs.readFileSync(new URL('../supabase/seed.sql', import.meta.url), 'utf8');
if (!seed.includes('DO NOT use this as a production-data import')) {
  failures.push('Staging seed safety header is missing.');
}

console.log('BUKLOD Staging Gate');
console.log('===================');
for (const w of warnings) console.log(`WARN: ${w}`);
for (const f of failures) console.error(`FAIL: ${f}`);

if (failures.length) {
  console.error(`\nStaging gate FAILED with ${failures.length} blocker(s).`);
  process.exit(1);
}

console.log(`\nStaging gate PASSED. ${migrations.length} migrations are ready.`);
