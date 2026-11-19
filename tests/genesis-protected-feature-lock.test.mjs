import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('governance-lock still runs mandatory original protected-feature tests and source guard',()=>{
  const wf=read('.github/workflows/engineering-accountability.yml');
  assert.match(wf,/node scripts\/protected-feature-lock\.mjs/);
  assert.match(wf,/node --test tests\/protected-feature-lock\.test\.mjs/);
  assert.match(wf,/node scripts\/engineering-accountability-gate\.mjs/);
  assert.match(wf,/node --test tests\/season2-native-capability-gate\.test\.mjs tests\/season2-native-release-identity\.test\.mjs/);
  assert.match(wf,/node scripts\/season2-native-capability-gate\.mjs --mode=source/);
  assert.doesNotMatch(wf,/node scripts\/season2-native-capability-gate\.mjs --mode=release/);
});
test('production embargo remains exact-source, date-locked, and requires owner evidence',()=>{
  const embargo=read('scripts/buklod-season2-production-embargo.cjs');
  assert.match(embargo,/src\/features\/season2\/genesis/);
  assert.match(embargo,/NOT_BEFORE_UTC/);
  assert.match(embargo,/season2PublishedScheduleId/);
  assert.match(embargo,/ownerAuthorizationId/);
  assert.match(embargo,/verifyProductionCheckout/);
});
