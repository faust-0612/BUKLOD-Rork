import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BASE, PREVIOUS_UPDATE, PREVIOUS_GROUP, PREVIOUS_MESSAGE,
  marker, verifyPrior,
} from '../scripts/life-human-first-exec-staging-release-policy.mjs';
const sha='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

test('LIFE staging release pins the verified Executive Density update',()=>{
  assert.equal(BASE,'ab3ed7c375b09b31dcac2369c106eba4bd8a6ca0');
  const prior=verifyPrior({currentPage:[{
    message:PREVIOUS_MESSAGE,group:PREVIOUS_GROUP,runtimeVersion:'1.3.2',
  }]},PREVIOUS_UPDATE,sha);
  assert.equal(prior.alreadyPublished,false);
  assert.equal(prior.updateId,PREVIOUS_UPDATE);
});
test('LIFE staging release cannot overwrite a newer unrelated update',()=>{
  assert.throws(()=>verifyPrior([{message:'OTHER_UPDATE',group:'bad',runtimeVersion:'1.3.2'}],PREVIOUS_UPDATE,sha));
  assert.throws(()=>verifyPrior([{message:PREVIOUS_MESSAGE,group:PREVIOUS_GROUP,runtimeVersion:'1.3.2'}],'wrong-manifest-id',sha));
  assert.throws(()=>verifyPrior([{message:PREVIOUS_MESSAGE,group:'unexpected',runtimeVersion:'1.3.2'}],PREVIOUS_UPDATE,sha));
});
test('LIFE staging release safely recognizes an already-published exact SHA',()=>{
  const prior=verifyPrior([{message:marker(sha),group:'existing-live-group',runtimeVersion:'1.3.2'}],
    'existing-live-update-id',sha);
  assert.equal(prior.alreadyPublished,true);
  assert.equal(prior.group,'existing-live-group');
});
test('LIFE staging release rejects incompatible runtime',()=>{
  assert.throws(()=>verifyPrior([{message:PREVIOUS_MESSAGE,group:PREVIOUS_GROUP,runtimeVersion:'1.3.5'}],
    PREVIOUS_UPDATE,sha));
});
