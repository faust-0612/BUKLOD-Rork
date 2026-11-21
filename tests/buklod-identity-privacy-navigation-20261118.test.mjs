import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('legal-name routes keep existing navigation and require private ID verification',()=>{
 const routes=read('src/app/_layout.tsx');
 const personal=read('src/app/account/personal-information.tsx');
 const review=read('src/app/admin/identity-verification.tsx');
 const identity=read('src/app/account/identity-verification.tsx');
 assert.match(routes,/name="account\/identity-verification"/);
 assert.match(routes,/name="admin\/identity-verification"/);
 assert.match(personal,/nameChanged/);
 assert.match(personal,/router\.push\('\/account\/identity-verification'/);
 assert.match(identity,/privacyConsent/);
 assert.match(identity,/READ BUKLOD PRIVACY POLICY/);
 assert.match(review,/hasRole\('system_admin'\)/);
 assert.match(review,/preview\.loaded/);
});

test('video and PTT call identity has no client-auth nickname fallback',()=>{
 const stream=read('src/lib/buklodStreamVideoClient.ts');
 const streamWeb=read('src/lib/buklodStreamVideoClient.web.ts');
 const ptt=read('src/ptt/buklodPttCore.ts');
 const pttWeb=read('src/ptt/buklodPttCore.web.ts');
 const pttBackend=read('supabase/functions/buklod-ptt-access/index.ts');
 for(const text of [stream,streamWeb,ptt,pttWeb,pttBackend]){
  assert.doesNotMatch(text,/user_metadata\?\.(?:name|full_name)/);
 }
 assert.match(pttBackend,/\.from\("profiles"\)/);
 assert.match(ptt,/data\.display_name/);
 assert.match(pttWeb,/data\.display_name/);
 const helper=read('src/lib/buklodCanonicalName.ts');
 assert.match(helper,/withBuklodTimeout/);
 assert.match(helper,/1200/);
});
