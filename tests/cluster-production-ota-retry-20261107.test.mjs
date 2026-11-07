import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const read = path => readFileSync(path, 'utf8');
const cluster = read('src/app/clusters/index.tsx');
const oldRecovery = read('scripts/test-pending-client-reconciliation-20261027.cjs');
const workflow = read('.github/workflows/production_android_ota.yml');

test('The actual legacy production safety anchor script passes with the professional Cluster dashboard', () => {
  const output = execFileSync(process.execPath, [
    'scripts/test-pending-client-reconciliation-20261027.cjs',
  ], { encoding: 'utf8', timeout: 10_000 });
  assert.match(output, /PASS: rollback UI recovery, account-cache isolation/);
  assert.match(output, /PASS: production security anchors and PR validation are aligned/);
});

test('Cluster retry is visible only when an online RPC read failed and reloads without losing cached memberships', () => {
  assert.match(cluster, /const \[loadError, setLoadError\] = useState\(''\)/);
  assert.match(cluster, /\{Boolean\(loadError\) && online \? \([\s\S]*?<Pressable accessibilityRole="button" onPress=\{\(\) => void load\(query, true\)\}>[\s\S]*?<Text style=\{styles\.retryLink\}>Retry loading<\/Text>/);
  assert.match(cluster, /<RefreshControl\s+refreshing=\{refreshing\}\s+onRefresh=\{\(\) => void load\(query, true\)\}/);
  assert.match(cluster, /if \(!online\) \{[\s\S]*?setSearching\(false\);[\s\S]*?return;/);
  assert.match(cluster, /const \[loading, setLoading\] =[\s\S]*?clusterMemory\.mine === null/);
  assert.match(cluster, /const usingSavedClusters = !online \|\| Boolean\(loadError\) \|\| loading/);
  assert.match(cluster, /if \(clusterMemory\.owner !== owner\)/);
  assert.match(cluster, /if \(requestId !== searchRequest\.current \|\| clusterMemory\.owner !== owner\)/);
  assert.match(cluster, /const \[mine, found\] = await Promise\.allSettled/);
  assert.match(cluster, /setLoadError\('Some Cluster information could not load\. Previous results are retained\.'/);
  assert.match(cluster, /Offline · saved memberships are available/);
});

test('The old RETRY visual-control token is retired, not the retry behavior or production gate', () => {
  assert.doesNotMatch(oldRecovery, /assert\.match\(directory, \/title="RETRY"/);
  assert.match(oldRecovery, /Pressable accessibilityRole="button" onPress=/);
  assert.match(oldRecovery, /Retry loading/);
  assert.match(oldRecovery, /onRefresh=/);
  assert.match(workflow, /node scripts\/test-pending-client-reconciliation-20261027\.cjs/);
  assert.match(workflow, /node scripts\/community-help-sos-release-contract\.mjs/);
  assert.match(workflow, /env:exec production 'node scripts\/verify-production-ads-env\.cjs'/);
  assert.match(workflow, /node scripts\/android-ota-rc\.cjs freeze/);
});
