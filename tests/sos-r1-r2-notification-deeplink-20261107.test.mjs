import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';

const read = path => readFileSync(path, 'utf8');
const notification = read('src/providers/NotificationProvider.tsx');
const wall = read('src/app/(tabs)/buklod.tsx');
const signals = read('src/lib/buklodEmergencySignal.ts');
const host = read('src/components/BuklodGlobalEmergencyHost.tsx');
const workflow = read('.github/workflows/production_android_ota.yml');

function newEmitter(now = { value: 1000 }) {
  const script = stripTypeScriptTypes(signals, { mode: 'strip' })
    .replace(/^export\s+(?=(?:async\s+)?function|const|let|class)/gm, '');
  const factory = script + '\n({ isBuklodEmergencyId, subscribeBuklodEmergencySignal, emitBuklodEmergencySignal })';
  return vm.runInNewContext(factory, {
    Set,
    Array,
    Date: { now: () => now.value },
    Math,
    String,
  }, { filename: 'buklodEmergencySignal.js' });
}
const ids = [
  '99923b52-0967-4a5f-b4b0-43cb4653fbb8',
  '5dc82b21-3168-4b40-b400-9a8864d23819',
  '4cc7f54c-1b4f-4d2a-85d0-11c6cf8be1ab',
  '3e56c812-a097-4e57-a911-f22d6de7f692',
  '202708a2-9766-4cb6-89df-f52c9cc2d641',
  'c25467af-6690-4e72-82b1-93062490f655',
];

test('The existing R1 safety contract remains unchanged and passes with R2 overlay', () => {
  assert.ok(workflow.includes('node scripts/community-help-sos-release-contract.mjs'));
  assert.doesNotThrow(() => execFileSync(process.execPath, [
    'scripts/community-help-sos-release-contract.mjs',
  ], { stdio: 'pipe', timeout: 10_000 }));
  assert.ok(notification.includes('/buklod?help_request_id='));
  assert.ok(notification.includes("kind==='community_emergency'&&data?.help_request_id"));
});

test('Mounted global host receives tapped SOS without navigating away from active draft', () => {
  const start = notification.indexOf("if(kind==='community_emergency'&&data?.help_request_id)");
  const end = notification.indexOf('const target=resolveBuklodNotificationTarget', start);
  assert.ok(start >= 0 && end > start);
  const branch = notification.slice(start, end);
  assert.match(branch, /const delivered = emitBuklodEmergencySignal\(\{ incidentId:id, origin:'recipient' \}\)/);
  assert.match(branch, /if\(!delivered\)\{\s*router\.push\(/);
  assert.match(branch, /router\.push\(`\/buklod\?help_request_id=\$\{encodeURIComponent\(id\)\}` as any\)/);
  assert.match(branch, /isBuklodEmergencyId\(id\)/);
  assert.match(branch, /router\.push\('\/notifications' as any\)/);
  assert.doesNotMatch(branch, /router\.replace\(/);
});

test('Community deep-link validates UUID and forwards incident ID only to the verified R2 host', () => {
  assert.match(wall, /help_request_id\?:string/);
  assert.match(wall, /isBuklodEmergencyId\(requestId\)/);
  assert.match(wall, /handedOffEmergency\.current === requestId/);
  assert.match(wall, /emitBuklodEmergencySignal\(\{ incidentId: requestId, origin: 'recipient' \}\)/);
  assert.match(host, /\.eq\('user_id', owner\)/);
  assert.match(host, /\.eq\('kind', 'community_emergency'\)/);
  assert.match(host, /\.contains\('data', \{ help_request_id: incidentId \}\)/);
  assert.match(host, /'buklod_help_list_nearby'/);
  assert.match(host, /row\.id === incidentId && row\.kind === 'EMERGENCY' && freshActive\(row\)/);
  assert.doesNotMatch(wall.slice(
    wall.indexOf('const handedOffEmergency'),
    wall.indexOf('const focusPostId ='),
  ), /supabase\.from\('buklod_help_requests'\)/);
});

test('Live subscriber prevents fallback route, unhandled cold-start signal replays once', () => {
  const e = newEmitter();
  const event = { incidentId: ids[0], origin: 'recipient' };
  assert.equal(e.emitBuklodEmergencySignal(event), false);
  const received = [];
  const stop = e.subscribeBuklodEmergencySignal(x => received.push(x.incidentId));
  assert.deepEqual(received, [ids[0]]);
  assert.equal(e.emitBuklodEmergencySignal(event), true);
  assert.deepEqual(received, [ids[0], ids[0]]);
  stop();
  // A late notification after listener cleanup is queued, not lost.
  assert.equal(e.emitBuklodEmergencySignal({ incidentId: ids[1], origin: 'recipient' }), false);
  const next = [];
  e.subscribeBuklodEmergencySignal(x => next.push(x.incidentId));
  assert.deepEqual(next, [ids[1]]);
});

test('Malformed and expired cold-launch notifications never reveal incidents; queue is bounded and deduplicated', () => {
  const clock = { value: 1000 };
  const e = newEmitter(clock);
  assert.equal(e.isBuklodEmergencyId(ids[0]), true);
  assert.equal(e.isBuklodEmergencyId('../../admin?help_request_id=x'), false);
  assert.equal(e.emitBuklodEmergencySignal({
    incidentId: '../../admin?help_request_id=x', origin: 'recipient',
  }), false);
  for (const id of ids) {
    e.emitBuklodEmergencySignal({ incidentId: id, origin: 'recipient' });
  }
  // Bounded queue stores the last four unique IDs only.
  const received = [];
  const stop = e.subscribeBuklodEmergencySignal(x => received.push(x.incidentId));
  assert.deepEqual(received, ids.slice(-4));
  stop();
  e.emitBuklodEmergencySignal({ incidentId: ids[0], origin: 'recipient' });
  e.emitBuklodEmergencySignal({ incidentId: ids[0], origin: 'recipient' });
  clock.value += 2 * 60 * 1000 + 1;
  const late = [];
  e.subscribeBuklodEmergencySignal(x => late.push(x.incidentId));
  assert.deepEqual(late, []);
});

test('R2 emergency overlay still has owner isolation, proximity access and no duplicate push dispatch', () => {
  assert.match(host, /const activeShown = shown\?\.ownerId === owner \? shown : null/);
  assert.match(host, /!shown\?\.verified \|\| shown\.ownerId !== owner/);
  assert.match(host, /p_request_id: id, p_response_type: responseType/);
  assert.match(host, /p_status: 'RESOLVED'/);
  assert.match(read('supabase/functions/buklod-help-alert/index.ts'), /Do not call Expo Push directly here, or a single SOS could be sent twice/);
});
