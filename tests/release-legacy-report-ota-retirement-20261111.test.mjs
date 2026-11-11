import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL('../'+p, import.meta.url), 'utf8');
test('obsolete report-door entrypoint rejects production publishing without side effects', () => {
  const ps = read('scripts/release-main-report-door-safe.ps1');
  assert.match(ps, /DIRECT PRODUCTION RELEASE BLOCKED/);
  assert.match(ps, /runtime 1\.3\.0/);
  assert.match(ps, /^throw /m);
  assert.doesNotMatch(ps, /&\s*\$Npx\s+['"]eas-cli@latest['"]/);
  assert.doesNotMatch(ps, /^\s*(?:npx|eas|expo)\s+(?:update|deploy)\b/m);
});
test('canonical main publishers remain marker-triggered and manual dispatch stays closed', () => {
  for (const name of ['production_android_ota.yml', 'production_web_deploy.yml']) {
    const yml = read('.github/workflows/' + name);
    assert.match(yml, /github\.event_name == 'push'/);
    assert.match(yml, /BUKLOD_CONSOLIDATED_PROD_20261108/);
    assert.doesNotMatch(yml, /^  workflow_dispatch:/m);
  }
});
