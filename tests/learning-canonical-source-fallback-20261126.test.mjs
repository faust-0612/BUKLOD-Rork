import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveCanonicalRange} from '../supabase/functions/_shared/learning-evidence-checks.mjs';
const range={start:38,end:39},both=[{verse_no:38,verse_text:'a'},{verse_no:39,verse_text:'b'}];
test('prefer complete ASD; fallback full labeled KJV range only for missing verses',async()=>{let calls=[];const read=async t=>{calls.push(t);return t==='ASD'?both.slice(0,1):both};assert.equal((await resolveCanonicalRange(async()=>both,'ASD',range)).translation,'ASD');assert.equal((await resolveCanonicalRange(read,'ASD',range)).translation,'KJV');assert.deepEqual(calls,['ASD','KJV']);await assert.rejects(resolveCanonicalRange(async()=>[],'ASD',range));await assert.rejects(resolveCanonicalRange(async()=>{throw Error('network')},'ASD',range));});
