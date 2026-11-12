import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const code=readFileSync('src/app/admin/bsoc-conversations.tsx','utf8');
test('BSOC reply retry uses same nonce and verifies server persistence before clearing draft',()=>{
 assert.match(code,/retryMessage\.current=\{caseId,body,nonce\}/);
 assert.match(code,/previous\?\.caseId===caseId&&previous\.body===body\?previous\.nonce:Crypto\.randomUUID\(\)/);
 assert.match(code,/if\(e\.code!=='23505'\)throw e/);
 assert.match(code,/\.eq\('case_id',caseId\)\.eq\('sender_id',uid\)/);
 assert.match(code,/\.eq\('client_nonce',nonce\)\.maybeSingle\(\)/);
 assert.match(code,/if\(readError\|\|!stored\)throw e/);
 assert.match(code,/retryMessage\.current=null/);
});
test('Support access is rechecked on account transitions and does not leak prior case state',()=>{
 assert.match(code,/\},\[user\?\.id\]\);\s*useEffect\(\(\)=>\{if\(canRead\)void loadCases/);
 assert.match(code,/setCanRead\(null\);setCanManage\(false\);setUid\(null\)/);
});
