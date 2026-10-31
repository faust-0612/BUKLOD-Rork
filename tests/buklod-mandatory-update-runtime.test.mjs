import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(p,'utf8');

test('Server retains authority for version cutoff and foreground refresh has throttle', () => {
 const s=read('src/providers/RuntimeConfigProvider.tsx');
 assert.match(s,/supabase.rpc\('get_client_runtime_config'/);
 assert.match(s,/RUNTIME_CONFIG_FRESH_MS = 2 \* 60 \* 1000/);
 assert.match(s,/AppState.addEventListener\('change'/);
 assert.match(s,/lastForegroundRefreshAt\.current < RUNTIME_CONFIG_FRESH_MS/);
 assert.match(s,/Platform.OS === 'web'\s*\? '999.999.999'/);
});

test('Existing EAS OTA remains compatible and never auto-reloads over a call', () => {
 const host=read('src/components/BuklodOtaFreshnessHost.native.tsx');
 assert.match(host,/CHECK_INTERVAL_MS = 60 \* 60 \* 1000/);
 assert.match(host,/Updates.checkForUpdateAsync/);
 assert.match(host,/Updates.fetchUpdateAsync/);
 assert.match(host,/Updates.reloadAsync/);
 assert.match(host,/I-restart/);
 assert.match(host,/Mamaya/);
 assert.doesNotMatch(host, /await Updates.reloadAsync\(\)/);
});

test('Server cutoff remains unchanged by this DEV-only change',()=>{
 const scope=JSON.parse(read('.buklod/scopes/mandatory-android-update-20261101.json'));
 assert.match(scope.productionBaselineEvidence,/minimum_supported_version=1\.0\.0/);
 assert.ok(scope.acceptanceChecks.some(s=>s.includes('DO NOT')));
});
