import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

test('Cluster command dashboard adds a separate mid-feed native opportunity', () => {
  const source = read('src/components/BuklodClusterHomeCommandCenterImpl.tsx');
  assert.match(source, /cluster_command_first_view/);
  assert.match(source, /cluster_command_mid_view/);
  assert.match(source, /BuklodScreenBottomBanner placement="cluster"/);
  assert.match(source, /BuklodScopeFaithMonitoringDoor/);
  assert.match(source, /BuklodScopeBuklodLessonPanel/);
});

test('Organization and Cluster scope homes keep distinct ad identities', () => {
  const source = read('src/components/BuklodScopeHomeDashboard.tsx');
  assert.match(source, /organization_scope_home_first_view/);
  assert.match(source, /cluster_scope_home_first_view/);
  assert.match(source, /organization_scope_home_mid_view/);
  assert.match(source, /cluster_scope_home_mid_view/);
  assert.match(source, /BuklodScopeAttendanceCard/);
  assert.match(source, /BuklodScreenBottomBanner placement="home"/);
});

test('Cluster changes do not bypass the shared route and interaction ad controls', () => {
  const source = read('src/lib/buklodGlobalAdController.ts');
  assert.match(source, /hasInteractionLock\(\)/);
  assert.match(source, /isBuklodAdRouteSensitive/);
  assert.match(source, /enabled\('ads_passive'\)/);
  assert.match(source, /placementEnabled\(placementId\)/);
});
