import test from 'node:test';
import assert from 'node:assert/strict';
import {bsoNotificationCasePath} from '../src/lib/bsocCaseTriage.ts';

const id1='839f59e8-1234-4567-8abc-123456789abc';
const id2='8172b5a7-1234-4567-8abc-123456789abc';

test('member BSOC reply notification focuses the exact case',()=>{
  assert.equal(bsoNotificationCasePath('/support/live',id1),'/support/live?case_id='+id1);
  assert.equal(bsoNotificationCasePath('/support/live',id2),'/support/live?case_id='+id2);
});
test('personnel BSOC notification focuses the exact case',()=>{
  assert.equal(bsoNotificationCasePath('/admin/bsoc-conversations',id1),
    '/admin/bsoc-conversations?case_id='+id1);
});
test('untrusted route, path injection and malformed IDs cannot navigate elsewhere',()=>{
  assert.equal(bsoNotificationCasePath('https://attacker.test',id1),null);
  assert.equal(bsoNotificationCasePath('/admin/account-recovery',id1),null);
  assert.equal(bsoNotificationCasePath('/support/live','../../admin'),'/support/live');
  assert.equal(bsoNotificationCasePath('/support/live',undefined),'/support/live');
  assert.equal(bsoNotificationCasePath('/support/live?case_id='+id1,id2),null);
});
