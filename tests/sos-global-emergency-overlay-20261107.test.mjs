import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path,'utf8');
const host = read('src/components/BuklodGlobalEmergencyHost.tsx');
const sender = read('src/components/BuklodCommunityHelp.tsx');
const bridge = read('src/components/BuklodEmergencyPushBridge.native.tsx');
const web = read('src/components/BuklodEmergencyPushBridge.web.tsx');
const fallback = read('src/components/BuklodEmergencyPushBridge.tsx');
const signal = read('src/lib/buklodEmergencySignal.ts');
const nativeNotifications = read('src/providers/NotificationProvider.tsx');
const push = read('supabase/functions/push/index.ts');
const locked = read('docs/COMMUNITY_HELP_SOS_R1_LOCK.md');

test('SOS sends only after prior hold and local authentication; creator receives root overlay without waiting for push',()=>{
  assert.match(sender, /delayLongPress=\{1800\}/);
  assert.match(sender, /LocalAuthentication\.authenticateAsync\(/);
  assert.match(sender, /supabase\.rpc\('buklod_help_create_request'/);
  assert.match(sender, /emitBuklodEmergencySignal\(\{ incidentId: requestId, origin: 'sender' \}\)/);
  assert.ok(sender.indexOf("emitBuklodEmergencySignal({ incidentId: requestId, origin: 'sender' })") <
    sender.indexOf("supabase.functions.invoke('buklod-help-alert'"));
  assert.match(sender, /Contact official emergency services too/);
});

test('Recipient push and tap route to the same global alert, old account payloads cannot authorize data',()=>{
  assert.match(bridge, /Notifications\.addNotificationReceivedListener/);
  assert.match(bridge, /String\(payload\?\.kind \?\? ''\) !== 'community_emergency'/);
  assert.match(bridge, /isBuklodEmergencyId\(id\)/);
  assert.match(bridge, /emitBuklodEmergencySignal\(\{ incidentId: id, origin: 'recipient' \}\)/);
  assert.match(nativeNotifications, /emitBuklodEmergencySignal\(\{ incidentId:id, origin:'recipient' \}\)/);
  assert.match(host, /\.eq\('user_id', owner\)/);
  assert.match(host, /\.eq\('kind', 'community_emergency'\)/);
  assert.match(host, /\.contains\('data', \{ help_request_id: incidentId \}\)/);
  assert.match(host, /buklod_help_list_nearby/);
  assert.match(host, /row\.id === incidentId && row\.kind === 'EMERGENCY' && freshActive\(row\)/);
  assert.match(host, /origin === 'recipient' && item\.creator_id === owner/);
  assert.match(host, /if \(!incident\)/);
  assert.doesNotMatch(web, /expo-notifications/);
  assert.doesNotMatch(fallback, /expo-notifications/);
});

test('Root overlay is above all routes and preserves in-progress navigation/drafts',()=>{
  const root = read('src/app/_layout.tsx');
  const start = root.indexOf('<Stack\n');
  const end = root.indexOf('</Stack>');
  const overlay = root.indexOf('<BuklodGlobalEmergencyHost />');
  assert.ok(start >= 0 && end > start && overlay > end);
  assert.match(root, /<NotificationProvider>/);
  assert.match(root, /<BuklodMandatoryUpdateBoundary>/);
  assert.match(nativeNotifications, /Leave the current draft\/screen intact/);
  assert.match(host, /<Modal[\s\S]*?onRequestClose=\{minimize\}/);
  assert.match(host, /Minimize · Continue using BUKLOD/);
  assert.match(host, /position:'absolute',right:16,bottom:92/);
  assert.doesNotMatch(host, /Linking\.openURL\(\s*['"]tel:/);
});

test('Only active proximity-authorized incidents can be displayed and responded to',()=>{
  assert.match(host, /const freshActive =/);
  assert.match(host, /row\.status === 'ACTIVE'/);
  assert.match(host, /!shown\?\.verified \|\| shown\.ownerId !== owner \|\| shown\.origin !== 'recipient'/);
  assert.match(host, /supabase\.rpc\('buklod_help_respond'/);
  assert.match(host, /p_request_id: id, p_response_type: responseType/);
  for (const r of ['CAN_HELP','ON_MY_WAY','CANNOT_HELP','FALSE_ALERT']) {
    assert.ok(host.includes("'"+r+"'"), r);
  }
  assert.match(host, /Flag for review/);
  assert.match(host, /supabase\.rpc\('buklod_help_resolve'/);
  assert.match(host, /p_status: 'RESOLVED'/);
  assert.match(host, /if \(!mine \|\| mine\.kind !== 'EMERGENCY'/);
  assert.match(host, /if \(ownEmergency\) return ownEmergency/);
  assert.doesNotMatch(host, /\.select\('.*latitude.*longitude/);
  assert.match(host, /Exact location is protected/);
  assert.match(locked, /Private raw coordinates/);
});

test('Push is primary; bounded foreground polling and dedupe recover missed pushes',()=>{
  assert.match(host, /FOREGROUND_INBOX_MS = 45_000/);
  assert.match(host, /ACTIVE_REFRESH_MS = 15_000/);
  assert.match(host, /RECENT_LIMIT = 8/);
  assert.match(host, /if \(!owner \|\| !foreground \|\| inboxInFlight\.current/);
  assert.match(host, /const candidateInFlight = useRef<Set<string>>/);
  assert.match(host, /candidateInFlight\.current\.has\(id\)/);
  assert.match(host, /AsyncStorage\.getItem\(persistentKey\(owner\)\)/);
  assert.match(host, /AsyncStorage\.setItem\(/);
  assert.match(host, /AppState\.addEventListener\('change'/);
  assert.match(host, /acquireBuklodAdSafetyLock\('transaction'\)/);
  assert.match(host, /const epoch = \+\+accountEpoch\.current/);
  assert.match(host, /ownerId: owner, incidentId: id/);
  assert.match(host, /const activeShown = shown\?\.ownerId === owner \? shown : null/);
  assert.match(host, /visible=\{Boolean\(activeShown && !activeShown\.minimized && foreground\)\}/);
  assert.match(host, /accountEpoch\.current !== epoch/);
  assert.doesNotMatch(host, /supabase\.channel\(/);
  assert.doesNotMatch(host, /downloadAsync\(/);
});

test('Current canonical SOS notification fan-out, expiry, limited radius and no-double-push preserved',()=>{
  assert.match(push, /notification\.kind === 'community_emergency'/);
  assert.match(push, /emergency_alert_mode_version/);
  assert.match(push, /androidEmergencyReady \? 'buklod-emergency-v1' : 'buklod-activity-v2'/);
  assert.match(push, /ttl: isCommunityEmergency \? 600/);
  const server=read('supabase/functions/buklod-help-alert/index.ts');
  assert.match(server, /within1>=3\?1:within3>=3\?3:5/);
  assert.match(server, /\.contains\('data',\{help_request_id:alert\.id\}\)/);
  assert.match(server, /kind:'community_emergency'/);
  assert.match(locked, /Anti-abuse baseline/);
  assert.match(locked, /Official-services warning remains/);
});
