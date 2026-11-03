import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(path, 'utf8');

test('Cluster directory, Cluster command center and Organization/Cluster dashboards use first-view ads once', () => {
  const directory = read('src/app/clusters/index.tsx');
  const command = read('src/components/BuklodClusterHomeCommandCenterImpl.tsx');
  const managed = read('src/components/BuklodScopeHomeDashboard.tsx');
  for (const source of [directory, command, managed]) {
    assert.match(source, /BuklodFirstViewAd/);
    assert.doesNotMatch(source, /BuklodNativeSponsoredCard/);
  }
  assert.match(directory, /cluster_directory_first_view/);
  assert.match(command, /cluster_command_first_view/);
  assert.match(managed, /cluster_scope_home_first_view/);
  assert.match(managed, /organization_scope_home_first_view/);
});

test('Android first-view keeps scope inventory and exact placement identity', () => {
  const first = read('src/components/BuklodFirstViewAd.android.tsx');
  assert.match(first, /resolveInventory/);
  assert.match(first, /placementId.startsWith\('org_'\)/);
  assert.match(first, /placementId.startsWith\('cluster_'\)/);
  assert.match(first, /placementIdOverride=\{placementId\}/);
  assert.match(first, /diagnosticName=\{diagnosticPlacementFor\(placement\)\}/);
});
