import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const s=readFileSync('scripts/android-ota-rc.cjs','utf8');
const w=readFileSync('.github/workflows/buklod-train-a-prod-raw-native-rc-qa-20261118.yml','utf8');
test('production baseline uses RAW pinned Git V28 bytes and canonical pinned hash',()=>{
  assert.match(s,/execFileSync\('git',\['show',pinnedV28\+':package\.json'\],\{encoding:'utf8'\}\)/);
  assert.match(s,/assertApprovedCompactScriptOnly\(/);
  assert.match(s,/assertNativeRuntimeCompatible\(currentConfig/);
  assert.match(s,/assert\.deepEqual\(changedNative, \['package\.json','plugins\/withBuklodPttHardwareFoundation\.js'\]/);
  assert.doesNotMatch(s,/git\('show',pinnedV28\+':package\.json'\)/);
});
test('production release cannot use PR synthetic merge SHA or accept stale source',()=>{
  assert.match(w,/git ls-remote origin refs\/heads\/fix\/train-a-prod-raw-v28-blob-20261118/);
  assert.match(w,/GITHUB_SHA="\$\(git rev-parse HEAD\)" node scripts\/android-ota-rc\.cjs baseline/);
  assert.match(w,/a\.equal\(d\.source,require\('node:child_process'\)\.execFileSync\('git',\['rev-parse','HEAD'\]/);
  assert.doesNotMatch(w,/a\.equal\(d\.source,process\.env\.GITHUB_SHA \|\|/);
});
test('native preflight is read only; production EAS publish remains solely in canonical workflow',()=>{
  assert.match(w,/scripts\/buklod-season2-production-embargo\.cjs --production/);
  assert.match(w,/test -f ota-evidence\/baseline\.json/);
  assert.doesNotMatch(w,/eas(?:-cli)?\s+update|update --channel production|--channel production --platform/);
  const official=readFileSync('.github/workflows/production_android_ota.yml','utf8');
  assert.match(official,/node scripts\/android-ota-rc\.cjs verify/);
  assert.match(official,/node scripts\/android-ota-rc\.cjs published/);
});
