import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const read = p => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const android = read('.github/workflows/production_android_ota.yml');
const web = read('.github/workflows/production_web_deploy.yml');
const pinned = '2f26645e50e8e079ebf09f3999aacfc506ae7651';

test('Kingdom R12 native V28 OTA package manifest remains byte-identical', () => {
  const historical = execFileSync('git', ['show', pinned + ':package.json'], {encoding:'utf8'});
  assert.equal(read('package.json'), historical, 'any package.json edit blocks pinned native V28 OTA');
  const app = read('app.config.js');
  assert.match(app, /runtimeVersion: isClassroom \? '1\.3\.0' : '1\.3\.2'/);
  assert.match(app, /org\.mzbministry\.buklod/);
});

test('Kingdom R12 both production release paths execute all Kingdom tests before export', () => {
  for (const [name, workflow, publishAnchor] of [
    ['Android', android, 'Export Android RC once using production environment'],
    ['Expo Hosting', web, 'Export production web with production environment'],
  ]) {
    const tests = workflow.indexOf('node --experimental-strip-types --test tests/kingdom-*.test.mjs');
    const original = workflow.indexOf('node scripts/game-kingdom-release-contract.mjs');
    const source = workflow.indexOf('node scripts/test-kingdom-game-platform-r1.mjs');
    const publish = workflow.indexOf(publishAnchor);
    assert.ok(tests > 0 && source > tests && original > 0 && publish > source, name + ' must gate production export');
    assert.ok(workflow.includes('node scripts/game-kingdom-release-contract.mjs'));
    assert.ok(workflow.includes('node scripts/test-kingdom-game-platform-r1.mjs'));
  }
});

test('Kingdom R12 existing RC-identity and production backend gates cannot be bypassed', () => {
  assert.ok(android.includes('node scripts/android-ota-rc.cjs baseline'));
  assert.ok(android.includes('node scripts/android-ota-rc.cjs freeze'));
  assert.ok(android.includes('node scripts/android-ota-rc.cjs verify'));
  assert.ok(android.includes('node scripts/android-ota-rc.cjs published'));
  assert.ok(android.includes('--channel production --platform android --environment production --input-dir rc --skip-bundler'));
  assert.ok(web.includes("test \"$EXPO_PUBLIC_SUPABASE_URL\" = 'https://yhanxndaqbmuzbdqlblu.supabase.co'"));
  assert.ok(web.includes('npx eas-cli@latest deploy --prod --export-dir dist --environment production --non-interactive'));
  assert.ok(web.includes("github.ref == 'refs/heads/main'"));
  assert.ok(web.includes("git ls-remote origin refs/heads/main"));
});
