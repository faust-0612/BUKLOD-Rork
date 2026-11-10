import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const marker = 'BUKLOD_CONSOLIDATED_PROD_20261108';

test('approved Nov10 release marker preserves exact verified compiled source and excludes unverified work', () => {
  const release = read('release/BUKLOD_CONSOLIDATED_PROD_20261110_RC609.md');
  assert.match(release, /dc6f2e237f6fc9f6e8a3782dfcc6ad25ca405844/);
  assert.match(release, /66d5c81ceed817868f6c0e6e8dbd7e993a0765f7/);
  assert.match(release, /runtime `1\.3\.2`/);
  assert.match(release, /excludes unverified PR #611/i);
  assert.match(release, /must not be interpreted as deployment proof/i);
});

test('original protected-main Android and web publication pipelines remain independent and gated', () => {
  const android = read('.github/workflows/production_android_ota.yml');
  const web = read('.github/workflows/production_web_deploy.yml');
  for (const workflow of [android, web]) {
    assert.ok(workflow.includes('github.ref == \'refs/heads/main\''));
    assert.ok(workflow.includes("startsWith(github.event.head_commit.message, '" + marker + "')"));
  }
  assert.ok(android.includes('node scripts/android-ota-rc.cjs baseline'));
  assert.ok(android.includes('node scripts/android-ota-rc.cjs freeze'));
  assert.ok(android.includes('node scripts/android-ota-rc.cjs published'));
  assert.ok(android.includes('eas-cli@latest update --channel production --platform android'));
  assert.ok(android.includes('git ls-remote origin refs/heads/main'));
  assert.ok(web.includes('sha256sum -c web-rc-sha256.txt'));
  assert.ok(web.includes('eas-cli@latest deploy --prod --export-dir dist'));
  assert.ok(web.includes('git ls-remote origin refs/heads/main'));
});
