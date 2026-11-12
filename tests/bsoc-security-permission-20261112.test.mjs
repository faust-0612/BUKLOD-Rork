import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const fn=readFileSync('supabase/functions/bsoc-gpt-debug-v1/index.ts','utf8');
const client=readFileSync('src/app/admin/bsoc-gpt-debug.tsx','utf8');
test('AI diagnostics remains authorized to BSOC support, no public bypass',()=>{
 assert.match(fn,/supabase\.auth\.getUser\(\)/);
 assert.match(fn,/buklod_bsoc_can/);
 assert.match(fn,/bsoc\.support\.read/);
 assert.match(fn,/if\(permissionError\|\|allowed!==true\)return json\(403/);
 assert.match(fn,/if\(!auth\.toLowerCase\(\)\.startsWith\('bearer '\)\)return json\(401/);
 assert.match(fn,/Deno\.env\.get\('OPENAI_API_KEY'\)/);
 assert.doesNotMatch(client,/OPENAI_API_KEY|sk-[A-Za-z0-9]{20}/);
});
test('Provider quota fallback cannot be misrepresented as an AI diagnosis',()=>{
 assert.match(fn,/if\(response\.status===429\|\|response\.status===402\|\|response\.status>=500\)/);
 assert.match(fn,/mode:'guided'/);
 assert.match(fn,/fixed BSOC checklist, not an AI diagnosis/);
 assert.match(fn,/mode:'ai'/);
 assert.match(client,/guided\?'Manual BSOC checklist/);
});
test('Prompt remains manually entered, redacted, and AI response non-retained',()=>{
 assert.match(fn,/const input=redact\(prompt\);/);
 assert.match(fn,/store:false/);
 assert.match(fn,/Bearer\\s\+/);
 assert.match(fn,/email|EMAIL/i);
 assert.match(client,/body:\{prompt:prompt\.trim\(\)\}/);
 assert.doesNotMatch(client,/\.from\('bsoc_case_messages'\).*\.invoke/s);
});
