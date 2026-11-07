import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const read = name => readFileSync(name, 'utf8');
const directory = read('src/app/clusters/index.tsx');
const locked = read('scripts/test-pending-client-reconciliation-20261027.cjs');
const workflow = read('.github/workflows/production_android_ota.yml');

test('Release guard runs and covers new Cluster retry UI, not retired ActionButton markup', () => {
  const run = spawnSync(process.execPath, [
    'scripts/test-pending-client-reconciliation-20261027.cjs',
  ], { encoding: 'utf8', timeout: 15_000 });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.match(run.stdout, /PASS: rollback UI recovery/);
  assert.ok(!locked.includes('assert.match(directory, /title="RETRY"'), 'obsolete literal-only gate was not retired');
  assert.match(locked, /assert\.match\(retryFeedback, \/<Pressable accessibilityRole=/);
  assert.match(locked, /assert\.match\(directory, \/<RefreshControl/);
});

test('Online Cluster failure remains actionable and does not hide cached account-isolated memberships', () => {
  assert.match(directory, /\{Boolean\(loadError\) && online \? \([\s\S]*?\) : null\}/);
  assert.match(directory, /<Pressable accessibilityRole="button" onPress=\{\(\) => void load\(query, true\)\}>/);
  assert.match(directory, /<Text style=\{styles\.retryLink\}>Retry loading<\/Text>/);
  assert.match(directory, /<RefreshControl[\s\S]*?refreshing=\{refreshing\}[\s\S]*?onRefresh=\{\(\) => void load\(query, true\)\}/);
  assert.match(directory, /const \[loadError, setLoadError\] = useState\(''\)/);
  assert.match(directory, /if \(requestId !== searchRequest\.current \|\| clusterMemory\.owner !== owner\)/);
  assert.match(directory, /Promise\.allSettled\(\[/);
  assert.match(directory, /Offline · saved memberships are available/);
  assert.match(directory, /usingSavedClusters = !online \|\| Boolean\(loadError\) \|\| loading/);
});

test('Scoped header keeps Android notch padding while wide desktop avoids a duplicate safe-area gap', () => {
  const header = read('src/components/BuklodScopedDashboardHeader.tsx');
  assert.match(header, /const insets = useSafeAreaInsets\(\)/);
  assert.match(header, /const \{ width: viewportWidth \} = useWindowDimensions\(\)/);
  assert.match(header, /const scopedTopInset = Platform\.OS === 'web' && viewportWidth >= 1200\s*\? 0 : insets\.top/);
  assert.equal((header.match(/paddingTop: scopedTopInset/g) || []).length, 2,
    'both blue Cluster header and regular scoped header honor the same platform-aware inset');
  assert.doesNotMatch(workflow, /grep -F 'paddingTop: insets\.top'/);
  assert.match(workflow, /grep -F "const scopedTopInset = Platform\.OS === 'web' && viewportWidth >= 1200"/);
  assert.match(workflow, /grep -F '\? 0 : insets\.top;'/);
  assert.match(workflow, /grep -F 'paddingTop: scopedTopInset'/);
});

test('Release workflow retains production safety anchors and frozen RC stages', () => {
  const gate = workflow.indexOf('Verify production safety anchors');
  const script = workflow.indexOf('node scripts/test-pending-client-reconciliation-20261027.cjs');
  const publish = workflow.indexOf('Publish exact frozen Android RC');
  assert.ok(gate >= 0 && script > gate && publish > script);
  assert.match(workflow, /node scripts\/community-help-sos-release-contract\.mjs/);
  assert.match(workflow, /node --test tests\/sos-r1-r2-notification-deeplink-20261107\.test\.mjs/);
  assert.match(workflow, /node --test tests\/production-ota-ads-regression\.test\.mjs/);
  assert.match(workflow, /env:exec production 'node scripts\/verify-production-ads-env\.cjs'/);
});
