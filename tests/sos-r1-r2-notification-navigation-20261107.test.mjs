import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(path, 'utf8');
const provider = read('src/providers/NotificationProvider.tsx');
const community = read('src/app/(tabs)/buklod.tsx');
const root = read('src/app/_layout.tsx');

test('Existing SOS notification overlays without a route change when the host is active', () => {
  const start = provider.indexOf("if(kind==='community_emergency'&&data?.help_request_id)");
  const end = provider.indexOf('const target=resolveBuklodNotificationTarget', start);
  assert.ok(start >= 0 && end > start);
  const segment = provider.slice(start, end);
  assert.match(segment, /const delivered = emitBuklodEmergencySignal/);
  assert.match(segment, /if\(!delivered\)\{\s*router\.push\(/);
  assert.match(segment, /return;/);
  assert.doesNotMatch(segment, /router\.replace\(/);
  assert.match(root, /<BuklodGlobalEmergencyHost \/>/);
});

test('Fallback Community navigation is validated and does not alter public post focus or drafts', () => {
  assert.match(provider, /\/buklod\?help_request_id=\$\{encodeURIComponent\(id\)\}/);
  assert.match(community, /help_request_id\?:string/);
  assert.match(community, /isBuklodEmergencyId\(requestId\)/);
  assert.match(community, /handedOffEmergency\.current === requestId/);
  assert.match(community, /emitBuklodEmergencySignal\(\{ incidentId: requestId, origin: 'recipient' \}\)/);
  assert.match(community, /focusPostId\?:string/);
  assert.match(community, /homeTodayDraft\?: string/);
});
