import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const read = p => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const android = read('.github/workflows/production_android_ota.yml');
const web = read('.github/workflows/production_web_deploy.yml');
// Exact committed file blobs from the verified installed V28 native baseline.
// Git object hashes also work with shallow PR checkouts (no history download needed).
const pinnedPackageBlob = '44a9a945bd21449d3d3e24ee0d5905dc022280e0';
const pinnedLockBlob = '7a5e29f9a87861143422cd227940e53fb4beb46b';
const blobSha = data => createHash('sha1').update('blob ' + Buffer.byteLength(data) + '\0').update(data).digest('hex');

test('Kingdom R12 native V28 OTA package manifest remains byte-identical', () => {
  assert.equal(blobSha(read('package.json')), pinnedPackageBlob,
    'any package.json edit blocks pinned native V28 OTA');
  assert.equal(blobSha(read('package-lock.json')), pinnedLockBlob,
    'native V28 lockfile identity must also stay unchanged');
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
