import test from 'node:test';
import assert from 'node:assert/strict';
import {isBsoCaseId,triageBsoCase,bsoReplyDraft} from '../src/lib/bsocCaseTriage.ts';

test('direct case navigation accepts only UUID-like case references',()=>{
  assert.equal(isBsoCaseId('839f59e8-1234-4567-8abc-123456789abc'),true);
  assert.equal(isBsoCaseId('../support/live'),false);
  assert.equal(isBsoCaseId('839F59E8'),false);
  assert.equal(isBsoCaseId(null),false);
});

test('render signatures never become certain backend or OTA diagnoses',()=>{
  const c=triageBsoCase({title:'Auto escalation: RENDER_3E577D35',route:'/wall',platform:'android'});
  assert.match(c.signal,/render exception/i);
  assert.match(c.investigation,/hash does not identify/i);
  assert.match(c.bsocAction,/do not claim an OTA fixed/i);
  assert.match(c.suspectedArea,/unknown/i);
});

test('auth request failures remain unverified between backend and client',()=>{
  const c=triageBsoCase({title:'Auto escalation: AUTH_REQUEST_FAILED'});
  assert.match(c.suspectedArea,/cannot distinguish yet/i);
  assert.match(c.investigation,/single failed request does not prove backend outage/i);
});
test('stale session has non-destructive client guidance',()=>{
  const c=triageBsoCase({title:'Auto escalation: AUTH_SESSION_STALE'});
  assert.match(c.userAction,/do not ask them to clear data/i);
});
test('unknown cases do not invent a root cause',()=>{
  const c=triageBsoCase({title:'App issue',message:'Buttons not working'});
  assert.match(c.suspectedArea,/not established/i);
});
test('member replies are drafts with no false resolution, OTP request, or destructive actions',()=>{
  for (const kind of ['acknowledge','request_details','client_retry','ota_check']) {
    const content=bsoReplyDraft(kind);
    assert.ok(content.length>30);
    assert.doesNotMatch(content,/resolved na|naayos na|ibigay.*password|ibigay.*OTP/i);
  }
  assert.match(bsoReplyDraft('ota_check'),/hindi pa namin kinukumpirmang resolved/i);
});
