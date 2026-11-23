import test from 'node:test';
import assert from 'node:assert/strict';
import { GATES, evaluateGate, inspectLocal } from '../scripts/genesis-206-unified-native-ota-gate.mjs';

test('Incomplete native build, game, rights and main parity fail closed', () => {
  const x=evaluateGate({});
  assert.equal(x.status,'BLOCKED_BEFORE_RELEASE');
  assert.equal(x.published,false);
  assert.deepEqual(x.blockers,GATES);
});
test('Truthy strings and incomplete approval cannot bypass the readiness contract', () => {
  const data=Object.fromEntries(GATES.map(k=>[k,true]));
  data.productionParity='true';
  data.rollback=false;
  assert.deepEqual(evaluateGate(data).blockers,['productionParity','rollback']);
});
test('All independently verified gates only permit manual RC review, not OTA release', () => {
  const x=evaluateGate(Object.fromEntries(GATES.map(k=>[k,true])));
  assert.equal(x.status,'READY_FOR_MANUAL_RC_REVIEW_NOT_PUBLISHED');
  assert.equal(x.published,false);
  assert.equal(x.backendMutated,false);
});
test('Missing local build sources, receipts, backend and APK remain blocked',()=>{
  const {facts,result}=inspectLocal({
    GENESIS_206_CONSO_ZIP:'/nonexistent/genesis.zip',
    GENESIS_206_NATIVE_SOURCE_DIR:'/nonexistent/native',
    GENESIS_NATIVE_SIGNED_APK:'/nonexistent/app.apk'
  });
  assert.equal(result.status,'BLOCKED_BEFORE_RELEASE');
  assert.equal(facts.contentSha,false);
  assert.equal(facts.nativeSource,false);
  assert.equal(facts.localSignedApk,false);
  assert.equal(facts.separateBackend,false);
  assert.equal(facts.ownerDeviceEvidence,false);
});
