const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const workflow=fs.readFileSync('.github/workflows/buklod-staging-user-latest-main-apk-20261108.yml','utf8');
test('current-main staging build is explicitly gated and uses canonical green-B launcher',()=>{
 assert.match(workflow,/BUKLOD_STAGING_USER_GREEN_B_REBUILD_20261110/);
 assert.match(workflow,/git ls-remote origin refs\/heads\/main/);
 assert.match(workflow,/buklod-main-canonical\.png/);
 assert.match(workflow,/org\.mzbministry\.buklod\.staging/);
 assert.match(workflow,/assert\.equal\(cfg\.runtimeVersion,'1\.3\.2'\)/);
 assert.match(workflow,/--profile staging-user --non-interactive --wait/);
});
test('actual signed APK uploaded in separate artifact from metadata',()=>{
 assert.match(workflow,/Download and verify actual staging APK/);
 assert.match(workflow,/AndroidManifest\.xml/);
 assert.match(workflow,/BUKLOD-Staging-Green-B\.apk/);
 assert.match(workflow,/Upload actual installable staging-user APK/);
 assert.match(workflow,/if-no-files-found: error/);
 assert.match(workflow,/Preserve staging-user build evidence/);
});
