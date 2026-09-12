import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (filePath) => fs.readFileSync(new URL(filePath, root), 'utf8');
const failures = [];

const door = read('src/components/BuklodReportDoorCard.tsx');
const launcher = read('src/lib/buklodReportLauncher.ts');
const envExample = read('.env.example');

if (!door.includes('openBuklodReportExternal')) {
  failures.push('BUKLOD Main Report door must launch the standalone Report app.');
}
if (/\brouter\.push\s*\(/.test(door) || door.includes('buklodReportLandingPath')) {
  failures.push('BUKLOD Main Report door must not route back into the embedded Main /reports screen.');
}
if (!door.includes('Sign-in may be required')) {
  failures.push('Cross-domain Report door copy must not claim that the Main auth session transfers automatically.');
}

for (const marker of [
  'EXPO_PUBLIC_BUKLOD_REPORT_WEB_URL',
  'https://buklod-report-mzb.expo.app',
  'https://buklod-report-mzb--qa.expo.app',
  "scope_id: scopeId",
  "entry: 'main'",
  'Linking.openURL',
]) {
  if (!launcher.includes(marker)) {
    failures.push(`Standalone Report launcher is missing required marker: ${marker}`);
  }
}

if (/buklod-report-mzb--[a-z0-9]{8,}\.expo\.app/i.test(launcher)) {
  failures.push('Main Report launcher must not pin an immutable deployment-ID URL. Use a stable alias or production URL.');
}
if (/access[_-]?token|refresh[_-]?token|session[_-]?token/i.test(launcher)) {
  failures.push('Main Report launcher must never put authentication/session tokens in the handoff URL.');
}
if (!envExample.includes('EXPO_PUBLIC_BUKLOD_REPORT_WEB_URL=')) {
  failures.push('.env.example must document the standalone Report launcher override.');
}

console.log('BUKLOD Main → Report Door Preflight');
console.log('==========================================');
for (const failure of failures) console.error(`FAIL: ${failure}`);
if (failures.length) {
  console.error(`\nREPORT DOOR PREFLIGHT FAILED with ${failures.length} blocker(s).`);
  process.exit(1);
}
console.log('\nREPORT DOOR PREFLIGHT PASSED.');
