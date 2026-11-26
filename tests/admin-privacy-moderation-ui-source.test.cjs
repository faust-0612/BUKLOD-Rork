const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const read = path => fs.readFileSync(path, 'utf8');
test('privacy and moderation use one reactive theme and protect device insets', () => {
  const helper = read('src/components/useAdminShared.ts');
  assert.match(helper, /useThemedShared\(\)/);
  assert.match(helper, /paddingTop: insets\.top \+ 6/);
  assert.match(helper, /paddingBottom: insets\.bottom \+ 12/);
  for (const path of ['src/app/admin/privacy/index.tsx', 'src/app/admin/content-reports.tsx']) {
    const source = read(path);
    assert.match(source, /const shared = useAdminShared\(\)/);
    assert.match(source, /contentContainerStyle=\{shared\.content\}/);
    assert.match(source, /<AdminGate>/);
    assert.match(source, /if \(!allowed\) return/);
    assert.match(source, /seq !== loadVersion\.current/);
    assert.match(source, /pendingActions\.current\.has/);
    assert.match(source, /refreshing=\{loading\}/);
    assert.match(source, /Report count unverified/);
  }
});
test('failed queries cannot appear as an empty verified queue; deletion remains read-only', () => {
  const privacy = read('src/app/admin/privacy/index.tsx');
  const reports = read('src/app/admin/content-reports.tsx');
  assert.match(privacy, /Promise\.allSettled/);
  assert.match(privacy, /reportError \? 'Content report status unknown.'/);
  assert.match(privacy, /requestError \? 'Privacy request status unknown.'/);
  assert.match(privacy, /!deletionRequests\.length && !deletionError && !loading/);
  assert.match(privacy, /does not delete accounts automatically/);
  assert.doesNotMatch(privacy, /admin-delete-user|\.from\('account_deletion_requests'\)[\s\S]{0,160}\.delete\(/);
  assert.match(reports, /loadError \? 'Report status unknown.'/);
  assert.match(reports, /open && !loadError && !loading/);
});
