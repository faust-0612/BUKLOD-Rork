const assert = require('node:assert/strict');
const fs = require('node:fs');
const file = p => fs.readFileSync(p, 'utf8');
const post = file('src/components/BuklodExclusiveScopeCommunity.tsx');
assert.match(post, /createAttempted = true;/);
assert.match(post, /postConfirmed = true;/);
assert.match(post, /!createAttempted/);
assert.match(post, /postId: null,/);
assert.doesNotMatch(post, /postId: createdPostId,\s*scopeId: snapshot.scopeId/);
assert.match(post, /Check the feed before trying again to avoid a duplicate/);
const attendance = file('src/lib/buklodAttendanceEvents.ts');
// Canonical production contract supersedes the redundant table fallback.
// A valid empty server list must clear the cache; only RPC failure uses it.
assert.match(attendance, /supabase\.rpc\('buklod_list_attendance_events_v1', \{/);
assert.match(attendance, /const result = await listEventsFromRpc\(id\)/);
assert.match(attendance, /if \(result\.error\) \{[\s\S]*?return readCachedEvents\(id\)/);
assert.match(attendance, /const rows = mergeEventRows\(result\.rows\);[\s\S]*?void writeCachedEvents\(id, rows\)/);
assert.doesNotMatch(attendance, /listEventsFromRpcs|listEventsFromTable|const fromTable =/);
const character = file('src/lib/buklodCharacterSelectionV2.ts');
assert.match(character, /async function ensureCharacterSession/);
assert.equal((character.match(/await ensureCharacterSession\(userId\)/g) || []).length, 2);
const cluster = file('src/app/clusters/[id].tsx');
assert.match(cluster, /Promise.race<ClusterDetails \| null>/);
assert.match(cluster, /generation !== loadGeneration.current/);
assert.match(cluster, /Connection timed out. Please retry/);
const gate = file('src/components/BuklodTrustedDeviceGate.native.tsx');
assert.match(gate, /markBuklodStartupChromeReady/);
assert.doesNotMatch(gate, /authenticateAsync|writeTrustedDevice/);
console.log('PASS: targeted source checks; Android runtime QA remains necessary');

const scope = file('src/app/scope/index.tsx');
const route = file('src/lib/buklodScopeRoute.ts');
const directory = file('src/app/clusters/index.tsx');
const faith = file('src/components/BuklodHomeFaithPanel.tsx');
const lesson = file('src/components/BuklodScopeBuklodLessonPanel.tsx');
const shield = file('src/lib/buklodR4RequestShield.ts');

assert.match(scope, /await exitScopedWorkspace\(selectScope, scopes, '\/clusters'\)/);
assert.match(scope, /useFocusEffect\(useCallback\(\(\) =>/);
assert.match(route, /\| '\/clusters'/);
assert.match(directory, /<ClusterDirectory key=\{owner \|\| 'signed-out'\} owner=\{owner\}/);
assert.match(directory, /if \(clusterMemory.owner !== owner\)/);
assert.match(directory, /if \(requestId === searchRequest.current && clusterMemory.owner === owner\)/);
assert.match(directory, /Promise.allSettled\(/);
assert.doesNotMatch(directory, /supabase\.auth\.onAuthStateChange/);
assert.match(directory, /padding: 11,/);
assert.match(directory, /const \[loadError, setLoadError\] = useState\(''\)/);
// R2 Cluster directory uses an accessible inline retry action, not the
// retired R1 ActionButton title="RETRY". Verify the *actual* online error
// recovery path instead of requiring old component markup.
const retryFeedback = directory.match(
  /\{Boolean\(loadError\) && online \? \([\s\S]*?\) : null\}/
)?.[0] || '';
assert.match(retryFeedback, /<Pressable accessibilityRole="button" onPress=\{\(\) => void load\(query, true\)\}>/);
assert.match(retryFeedback, /<Text style=\{styles\.retryLink\}>Retry loading<\/Text>/);
assert.match(directory, /<RefreshControl[\s\S]*?refreshing=\{refreshing\}[\s\S]*?onRefresh=\{\(\) => void load\(query, true\)\}/);
assert.doesNotMatch(directory, /Tap the cluster to open Home/);
assert.match(faith, /flexBasis: '30%'/);
assert.match(faith, /minHeight: compact \? 96 : 72/);
assert.match(lesson, /backgroundColor: '#5845C5'/);
assert.match(lesson, /backgroundColor: '#E39B17'/);
assert.match(shield, /buklod_connect_unread_count: 2_500/);
assert.match(shield, /buklod_my_clusters: 10_000/);
console.log('PASS: rollback UI recovery, account-cache isolation, and PR346 compatibility contracts');

const production = file('.github/workflows/production_android_ota.yml');
assert.match(production, /node scripts\/test-pending-client-reconciliation-20261027\.cjs/);
assert.match(production, /grep -F 'persistSession: true'/);
assert.match(production, /if grep -Eq 'LocalAuthentication\.authenticateAsync\|SecureStore\.setItemAsync\|writeTrustedDevice'/);
assert.doesNotMatch(production, /grep -F 'LocalAuthentication\.authenticateAsync'/);
const accountability = file('.github/workflows/engineering-accountability.yml');
assert.match(accountability, /name: Verify approved pending client and rollback recovery/);
console.log('PASS: production security anchors and PR validation are aligned');
