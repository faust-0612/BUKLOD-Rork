import test from 'node:test';
import assert from 'node:assert/strict';
import {bsoCaseIntervention} from '../src/lib/bsocCaseTriage.ts';
import {safeBuklodRoute} from '../src/lib/buklodRouteDiagnostics.ts';

test('rendering error has targeted safe guidance without claiming a fix',()=>{
 const p=bsoCaseIntervention({title:'SYS-500 RENDER_7DA38BC7'});
 assert.equal(p.category,'client');
 assert.match(p.firstCheck,/sanitized route/i);
 assert.match(p.closureGate,/member confirmation/);
 assert.doesNotMatch(p.memberDraft,/ibigay.*password|ibigay.*OTP/i);
});
test('provider limit is correctly separated from backend availability',()=>{
 const p=bsoCaseIntervention({title:'Edge Function non-2xx GPT HTTP 429'});
 assert.equal(p.category,'provider');
 assert.match(p.firstCheck,/provider 429/i);
});
test('sync/unknown advice stays non-destructive and evidence-based',()=>{
 assert.match(bsoCaseIntervention({title:'SYNC_QUEUE_STUCK'}).memberDraft,/huwag munang mag-clear data/i);
 assert.equal(bsoCaseIntervention({title:'Button stopped responding'}).category,'unclassified');
});
test('static BSOC routes are visible but dynamic paths are redacted',()=>{
 assert.equal(safeBuklodRoute('/admin/bsoc-conversations'),'admin/bsoc-conversations');
 assert.equal(safeBuklodRoute('/admin/priority-requests'),'admin/priority-requests');
 assert.equal(safeBuklodRoute('/admin/private-identifier'),'admin/:id');
 assert.equal(safeBuklodRoute('/support/random-id?token=secret'),' :test'.replace(' :test','support/:id'));
});
