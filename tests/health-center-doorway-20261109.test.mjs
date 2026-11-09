import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const launcherSource = readFileSync('src/lib/buklodHealthCenterLauncher.ts', 'utf8');
const compiled = ts.transpileModule(launcherSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  reportDiagnostics: true,
});
assert.equal(compiled.diagnostics?.length ?? 0, 0);
const actual = { exports: {} };
runInNewContext(compiled.outputText, { exports: actual.exports });
const { launchBuklodHealthCenter, BUKLOD_HEALTH_CENTER_URL } = actual.exports;

test('Health Center doorway opens only the dedicated HTTPS production origin', async () => {
  const opened = [];
  await launchBuklodHealthCenter(async url => { opened.push(url); });
  assert.deepEqual(opened, ['https://buklod-health-center.vercel.app/']);
  const parsed = new URL(BUKLOD_HEALTH_CENTER_URL);
  assert.equal(parsed.protocol, 'https:');
  assert.equal(parsed.search, '');
  assert.equal(parsed.hash, '');
  assert.equal(parsed.username, '');
  assert.equal(parsed.password, '');
});

test('failed launch propagates so UI can show a retry/address fallback', async () => {
  await assert.rejects(
    () => launchBuklodHealthCenter(async () => { throw new Error('browser-unavailable'); }),
    /browser-unavailable/,
  );
});

test('Home and Profile use the same real Health Center doorway without creating another health system', () => {
  const home = readFileSync('src/components/home/BuklodHomeUtilityCards.tsx', 'utf8');
  const profile = readFileSync('src/app/profile/buklod-health.tsx', 'utf8');
  assert.match(home, /launchBuklodHealthCenter/);
  assert.match(home, /id:'health'/);
  assert.match(profile, /launchBuklodHealthCenter/);
  assert.doesNotMatch(profile, /BuklodFoundationPortalShell|BuklodFocusAppGate/);
  assert.doesNotMatch(launcherSource, /access_token|refresh_token|session=|user_id=/);
});

test('public patient doorway bypasses only the global Health Worker role gate', () => {
  const guard = readFileSync('src/components/BuklodFocusAppRouteGuard.tsx', 'utf8');
  assert.match(guard, /pathname === '\/profile\/buklod-health'/);
  assert.ok(guard.indexOf("pathname === '/profile/buklod-health'") < guard.indexOf('focusAppForPathname(pathname)'));
  assert.match(guard, /checkingRef\.current === key/); // stale requests cannot redirect back
  assert.match(guard, /verifyFocusApp\(app\)/); // other privileged workspaces remain gated
});
