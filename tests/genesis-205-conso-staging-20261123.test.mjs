import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=p=>readFileSync(p,'utf8');
test('exact call receipt and local sound truth preserved',()=>{
 const ring=read('src/components/RingingCalls.tsx');
 assert.match(ring,/isBuklodRecipientPresentationReceipt/);
 assert.match(ring,/playerStatus\.isLoaded/);
 assert.match(ring,/Hindi pa nakumpirma kung naabot/);
 assert.match(read('src/lib/buklodCallLifecycle.ts'),/eventName === 'call.missed'/);
});
test('duplicate direct call handler gone while fresh IDs and timeout remain',()=>{
 const src=read('src/components/BuklodConnectThread.tsx');
 assert.doesNotMatch(src,/PATCH_171H_PERSONAL_CALL_STATUS/);
 assert.match(src,/buildBuklodPersonalCallId/);
 assert.match(src,/auto_cancel_timeout_ms: 45000/);
});
test('idle call overlay does not block Wall and ads',()=>{
 assert.match(read('src/components/RingingCalls.tsx'),/if \(!activeCall\) \{\s*return null;/);
 assert.match(read('src/providers/StreamVideoProvider.tsx'),/\{children\}[\s\S]*?<RingingCalls \/>/);
});
test('2.0.5 preflight explicitly excludes native and database releases',()=>{
 const scope=JSON.parse(read('.buklod/scopes/genesis-205-conso-staging-20261123.json'));
 assert.equal(scope.publicationStatus,'DEV_PREP_NO_OTA');
 assert.ok(scope.allowedPaths.every(p=>!/^(?:app\.config\.|eas\.json|package(?:-lock)?\.json|godot\/|modules\/|plugins\/|supabase\/)/.test(p)));
 const doc=read('docs/releases/GENESIS_205_CONSO_STAGING_INTAKE_20261123.md');
 assert.match(doc,/2\.0\.5-genesis-godot-launch/);
 assert.match(doc,/season2-genesis-library-205-preview/);
 assert.match(doc,/NO.?OTA|not published|not device-verified/i);
});
