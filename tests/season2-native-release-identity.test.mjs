import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const embargo=require('../scripts/buklod-season2-production-embargo.cjs');
const genus=[{file:'src/features/season2/genesis',reason:'package-file'}];
test('Genesis native feature cannot enter production before December 6',()=>{
  const result=embargo.evaluateRelease({
    target:'production',now:new Date('2026-11-20T00:00:00Z'),
    sourceSha:'a'.repeat(40),season2Files:genus,approval:null,
  });
  assert.equal(result.allowed,false);
  assert.equal(result.reason,'SEASON2_PRODUCTION_EMBARGO_BEFORE_DEC_6');
});
test('Calendar date alone never unlocks Genesis production',()=>{
  const result=embargo.evaluateRelease({
    target:'production',now:new Date('2026-12-07T00:00:00Z'),
    sourceSha:'a'.repeat(40),season2Files:genus,approval:null,
  });
  assert.equal(result.allowed,false);
  assert.equal(result.reason,'SEASON2_RELEASE_UNAUTHORIZED_EXACT_SHA_PROOFS_REQUIRED');
});
