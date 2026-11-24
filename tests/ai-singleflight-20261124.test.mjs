import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const s=readFileSync(new URL('../supabase/functions/_shared/aiSingleFlight.ts',import.meta.url),'utf8');
const home=readFileSync(new URL('../supabase/functions/buklod-home-ai/index.ts',import.meta.url),'utf8');
test('inflight dedupe is scoped to user and prompt',()=>{assert.match(s,/JSON\.stringify\(\[scope, key\]\)/);assert.match(home,/singleFlightAi\(authData\.user\.id, prompt/);});
test('pending entries are always cleared and never persist',()=>{assert.match(s,/finally \{ if \(pending\.get\(scopedKey\) === promise\) pending\.delete\(scopedKey\)/);assert.doesNotMatch(s,/localStorage|sessionStorage|redis|database/);});
