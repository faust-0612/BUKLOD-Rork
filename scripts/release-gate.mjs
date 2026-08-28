import fs from 'node:fs';

const failures = [];
const warnings = [];

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

const legal = read('src/lib/legal.ts');
const envExample = read('.env.example');
const appConfig = read('app.config.ts');

if (legal.includes('REQUIRED BEFORE LAUNCH')) {
  failures.push('Privacy notice still contains REQUIRED BEFORE LAUNCH placeholders.');
}

if (/service_role|sb_secret_/i.test(envExample)) {
  failures.push('.env.example appears to contain a server-side Supabase secret/service key reference.');
}

if (!appConfig.includes("org.mzbministry.buklod")) {
  failures.push('Expected final app identifier org.mzbministry.buklod was not found.');
}

const sqlFiles = fs.readdirSync(new URL('../supabase/', import.meta.url))
  .filter(name => /^\d+_.*\.sql$/.test(name));

if (sqlFiles.length < 14) {
  failures.push(`Expected at least 14 SQL migration files; found ${sqlFiles.length}.`);
}

const requiredDocs = [
  'PRODUCTION_SECURITY_GATE.md',
  'V9_PRODUCTION_HARDENING.md',
  'V10_QA_PILOT.md',
  'qa/TEST_MATRIX.csv',
  'qa/PILOT_ROLLOUT.md',
];

for (const file of requiredDocs) {
  if (!fs.existsSync(new URL(`../${file}`, import.meta.url))) {
    failures.push(`Missing release artifact: ${file}`);
  }
}

if (!process.env.EAS_PROJECT_ID && !process.env.EXPO_PUBLIC_EAS_PROJECT_ID) {
  warnings.push('EAS project ID is not present in this shell environment.');
}

console.log('BUKLOD Release Gate');
console.log('===================');

for (const warning of warnings) console.log(`WARN: ${warning}`);
for (const failure of failures) console.error(`FAIL: ${failure}`);

if (failures.length) {
  console.error(`\nRelease gate FAILED with ${failures.length} blocker(s).`);
  process.exit(1);
}

console.log('\nRelease gate PASSED.');
