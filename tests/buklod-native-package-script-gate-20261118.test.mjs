import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
const require=createRequire(import.meta.url);
const {
  V28_PINNED_PACKAGE_BLOB,gitBlobSha,canonicalPinnedNativePackageText,
  assertApprovedCompactScriptOnly
}=require('../scripts/buklod-native-package-script-gate.cjs');
const current=readFileSync('package.json','utf8');
const pinned=canonicalPinnedNativePackageText(current);
function modified(fn){const j=JSON.parse(current);fn(j);return JSON.stringify(j,null,2)+'\n'}
test('actual current package has byte-identical native V28 content after ONLY approved compact script normalization',()=>{
  assert.equal(gitBlobSha(pinned),V28_PINNED_PACKAGE_BLOB);
  assert.equal(assertApprovedCompactScriptOnly(current,pinned),true);
  const rc=readFileSync('scripts/android-ota-rc.cjs','utf8');
  assert.match(rc,/assertApprovedCompactScriptOnly\(/);
  assert.match(rc,/assert\.deepEqual\(changedNative, \['package\.json','plugins\/withBuklodPttHardwareFoundation\.js'\]/);
  assert.match(rc,/assertNativeRuntimeCompatible\(currentConfig/);
});
test('ANY native dependency, package/runtime metadata or lock drift is rejected',()=>{
  for(const mutation of [
    j=>{j.dependencies['react-native-reanimated']='4.6.0';},
    j=>{j.dependencies['@shopify/react-native-skia']='0.1.0';},
    j=>{j.name='other-app';},
    j=>{j.version='2.0.0';},
    j=>{j.scripts.postinstall='echo surprise';},
    j=>{j.scripts.start='node fake-start';},
    j=>{j.engines={node:'>=1'};},
  ])assert.throws(()=>canonicalPinnedNativePackageText(modified(mutation)),
    /Unapproved package\.json drift/);
});
test('compact layout and existing core release gates cannot be edited or removed',()=>{
  for(const mutation of [
    j=>{j.scripts['compact:contract']='true';},
    j=>{j.scripts['compact:contract']='rm -rf .';},
    j=>{delete j.scripts['compact:contract'];},
    j=>{j.scripts['release:gate']='npm run game:contract';},
  ])assert.throws(()=>canonicalPinnedNativePackageText(modified(mutation)));
});
test('original V28 package does not silently become an approved new native build',()=>{
  assert.throws(()=>canonicalPinnedNativePackageText(pinned),/compact source QA script/);
  assert.throws(()=>assertApprovedCompactScriptOnly(current,pinned+'\n'),/exact compact QA scripts/);
});

test('production RC compares RAW pinned Git blob, never trimmed Git helper output',()=>{
  const raw=execFileSync('git',[
    'show','2f26645e50e8e079ebf09f3999aacfc506ae7651:package.json'
  ],{encoding:'utf8'});
  assert.equal(raw.endsWith('\n'),true,'Signed native package has a newline');
  assert.equal(gitBlobSha(raw),V28_PINNED_PACKAGE_BLOB);
  assert.equal(assertApprovedCompactScriptOnly(current,raw),true);
  assert.notEqual(raw.trim(),raw,'Trimming the signed blob must not be treated as byte-identical');
  assert.throws(()=>assertApprovedCompactScriptOnly(current,raw.trim()),
    /only by exact compact QA scripts/);
  const rc=readFileSync('scripts/android-ota-rc.cjs','utf8');
  assert.match(rc,/execFileSync\('git',\['show',pinnedV28\+':package\.json'\],\{encoding:'utf8'\}\)/);
  assert.doesNotMatch(rc,/git\('show',pinnedV28\+':package\.json'\)/);
});
