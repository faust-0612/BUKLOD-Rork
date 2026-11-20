import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const scope = readFileSync('src/app/scope/index.tsx', 'utf8');
const thread = readFileSync('src/components/BuklodConnectThread.tsx', 'utf8');

test('Cluster/Organization scope hides duplicate chrome only on native Connect tab', () => {
  assert.match(scope, /const showFullConnectThread = Platform\.OS !== 'web' &&/);
  assert.match(scope, /section === 'connect' &&\s*\(workspaceScope\.scope_type === 'ORGANIZATION' \|\| workspaceScope\.scope_type === 'CLUSTER'\)/);
  assert.match(scope, /\{!showFullConnectThread && \(\s*<BuklodScopedDashboardHeader/);
  assert.match(scope, /\{!showFullConnectThread && \(\s*<View\s+style=\{\[\[\s*styles\.tabs/);
  assert.match(scope, /<OrganizationCommunityConnect[\s\S]*?onBack=\{\(\) => openSection\('home'\)\}/);
});

test('the canonical room keeps identity, scoped history, back and call controls', () => {
  assert.match(scope, /fullHeaderInWorkspace=\{Platform\.OS !== 'web'\}/);
  assert.match(scope, /mode="scope"/);
  assert.match(scope, /containerId=\{scope\.scope_id\}/);
  assert.match(thread, /<ConnectThreadHeader/);
  assert.match(thread, /compactEmbedded=\{embeddedInWorkspace && !fullHeaderInWorkspace\}/);
  assert.match(thread, /onBack=\{leaveThread\}/);
  assert.match(thread, /<BuklodScopeCallLauncher/);
  assert.match(thread, /fetchScopeConnectReaders/);
});
