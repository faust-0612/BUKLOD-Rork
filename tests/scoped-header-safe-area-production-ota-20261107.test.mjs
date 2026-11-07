import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const read = file => readFileSync(file,'utf8');
const scoped = read('src/components/BuklodScopedDashboardHeader.tsx');
const workflow = read('.github/workflows/production_android_ota.yml');

test('Android/phone scoped headers still honor status-bar safe area; desktop avoids double top padding', () => {
  assert.match(scoped, /const insets = useSafeAreaInsets\(\)/);
  assert.match(scoped, /const \{ width: viewportWidth \} = useWindowDimensions\(\)/);
  assert.match(scoped, /const scopedTopInset = Platform\.OS === 'web' && viewportWidth >= 1200\s*\? 0 : insets\.top;/);
  assert.equal((scoped.match(/paddingTop: scopedTopInset/g) || []).length, 2,
    'both blue Cluster/Organization and general scoped headers must use the same notch-safe inset');
  const top = (platform, width, inset) => platform === 'web' && width >= 1200 ? 0 : inset;
  assert.equal(top('android', 400, 30), 30);
  assert.equal(top('android', 1400, 30), 30);
  assert.equal(top('ios', 400, 55), 55);
  assert.equal(top('web', 800, 30), 30);
  assert.equal(top('web', 1200, 30), 0);
  assert.equal(top('web', 1700, 30), 0);
});

test('Production OTA safety gate protects mobile notch and desktop chrome instead of requiring outdated markup', () => {
  const check = workflow.indexOf('- name: Verify production safety anchors');
  const header = workflow.indexOf("grep -F \"const scopedTopInset = Platform.OS === 'web' && viewportWidth >= 1200\"");
  const mobile = workflow.indexOf("grep -F '? 0 : insets.top;'");
  const usage = workflow.indexOf("grep -F 'paddingTop: scopedTopInset'");
  const focused = workflow.indexOf("node --test tests/scoped-header-safe-area-production-ota-20261107.test.mjs");
  const publish = workflow.indexOf('- name: Publish exact frozen Android RC');
  assert.ok(check >= 0 && header > check && mobile > header &&
    usage > mobile && focused > usage && publish > focused);
  assert.ok(!workflow.includes("grep -F 'paddingTop: insets.top'"));
  assert.match(workflow, /node scripts\/test-pending-client-reconciliation-20261027\.cjs/);
  assert.match(workflow, /env:exec production 'node scripts\/verify-production-ads-env\.cjs'/);
  assert.match(workflow, /node scripts\/community-help-sos-release-contract\.mjs/);
  assert.match(workflow, /node scripts\/android-ota-rc\.cjs verify/);
});

test('All literal positive source anchors for production safety and Formation still exist (preflight)', () => {
  const start = workflow.indexOf('      - name: Verify production safety anchors');
  const end = workflow.indexOf('      - name: ', workflow.indexOf('      - name: Verify automatic Formation completion anchors')+1);
  assert.ok(start >= 0 && end > start);
  const section = workflow.slice(start,end);
  const pattern = /^\s*grep -F\s+(["'])(.*?)\1\s+'([^']+)'\s*$/gm;
  let count = 0;
  const missing = [];
  for (const match of section.matchAll(pattern)) {
    count++;
    const [, , fragment, path] = match;
    let source;
    try { source = read(path); } catch { missing.push(path + ': missing file'); continue; }
    if (!source.includes(fragment)) missing.push(path + ': missing literal ' + fragment);
  }
  assert.ok(count >= 55, 'Positive production anchors unexpectedly disappeared');
  assert.deepEqual(missing, [], 'A new source refactor broke a production safety contract');
});

test('Existing pending-client recovery contract still passes unchanged Cluster dashboard and cached memberships', () => {
  const result = execFileSync(process.execPath, [
    'scripts/test-pending-client-reconciliation-20261027.cjs',
  ], { encoding: 'utf8', timeout: 10_000 });
  assert.match(result, /PASS: rollback UI recovery, account-cache isolation/);
  assert.match(result, /PASS: production security anchors and PR validation are aligned/);
});
