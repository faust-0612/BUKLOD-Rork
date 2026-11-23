import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const w=readFileSync(new URL('../.github/workflows/genesis-native-manual-gated-build-20261123.yml',import.meta.url),'utf8');
test('workflow is manual-only, pinned to dedicated DEV, no release or cloud Expo',()=>{
 assert.match(w,/workflow_dispatch:/);
 assert.doesNotMatch(w,/\n\s*(push|pull_request|schedule|release):/);
 assert.match(w,/github\.ref_name == 'dev\/genesis-manual-github-native-build-20261123'/);
 assert.doesNotMatch(w,/eas build|expo run|vercel deploy|npm publish|gh release create/i);
 assert.match(w,/contents: read/);
});
test('source and asset gate precedes costly Android setup and native APK job',()=>{
 assert.match(w,/needs: source-preflight/);
 assert.match(w,/needs\.source-preflight\.outputs\.ready == 'true'/);
 assert.match(w,/auditLocalNative\(undefined,\{checkTools:false\}\)/);
 assert.ok(w.indexOf('auditLocalNative')<w.indexOf('android-actions/setup-android'));
 assert.match(w,/build_apk:[\s\S]*?default: false/);
});
test('no false artifact: unapproved Godot/toolchain blocks APK, secrets isolated',()=>{
 assert.match(w,/BLOCK: Godot 4\.7\.2 binary\/templates provenance/);
 assert.doesNotMatch(w,/actions\/upload-artifact/);
 assert.match(w,/SIGNING_KEYSTORE_B64: \$\{\{ secrets\.GENESIS_NATIVE_SIGNING_KEYSTORE_B64 \}\}/);
 assert.match(w,/persist-credentials: false/);
 assert.match(w,/No APK, no deployment/);
});
