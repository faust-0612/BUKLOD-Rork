import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = p => readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('devotional revision notification opens the exact personal submission, not a generic Cluster report', () => {
  const routing = read('src/lib/buklodFormationNotificationTarget.ts');
  const slice = routing.slice(routing.indexOf("itemKind === 'DAILY_DEVOTION'"), routing.indexOf("itemKind === 'DAILY_READING'"));
  assert.match(slice, /formation_needs_improvement/);
  assert.match(slice, /clean\(data\.submission_id\) \|\| itemId/);
  assert.match(slice, /\/devotional\/submissions\?\$\{query\.toString\(\)\}/);
  assert.doesNotMatch(slice, /\/scope\/faith-monitoring\/report/);
  assert.doesNotMatch(slice, /scopeId: scopeId \|\| null/);
});

test('two devotional submissions stay distinguishable in the inbox and original form', () => {
  const inbox = read('src/app/devotional/submissions.tsx');
  const reflection = read('src/app/reflection/[id].tsx');
  assert.match(inbox, /key=\{row\.id\}/);
  assert.match(inbox, /row\.id === requestedId/);
  assert.match(inbox, /params: \{ id: row\.devotional_id, submissionId: row\.id \}/);
  assert.match(reflection, /if \(targetId && submitted\.data\?\.id !== targetId\)/);
  assert.match(reflection, /setReflection\(review\?\.reflection_snapshot/);
  assert.match(reflection, /setApplication\(review\?\.application_snapshot/);
});

test('notification navigation preserves personal privacy and Wall visibility guard', () => {
  const notification = read('src/app/notifications/index.tsx');
  const wall = read('src/app/(tabs)/buklod.tsx');
  assert.match(notification, /\.eq\('user_id',user\.id\)\.in\('id',ids\)/);
  assert.match(notification, /buklodInstantPush\(p as any\)/);
  assert.match(wall, /onCommunityWallViewableItemsChanged/);
});
