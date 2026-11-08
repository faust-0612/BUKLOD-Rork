import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('only targeted V30-compatible OTA workstream added to compiled RC gate',()=>{
 const workflow=root('.github/workflows/unified_rc_compiled_qa_20261108.yml');
 assert.match(workflow,/github\.head_ref == 'dev\/ota-ui-polish-photo-reactions-music-20261108'/);
 assert.match(workflow,/github\.event\.pull_request\.head\.sha/);
 assert.match(workflow,/assert\.equal\(c\.android\.versionCode,30\)/);
 assert.match(workflow,/assert\.equal\(c\.runtimeVersion,'1\.3\.2'\)/);
 assert.match(workflow,/npx expo export --platform android/);
 assert.match(workflow,/npx expo export --platform web/);
 assert.match(workflow,/git diff --exit-code/);
 assert.doesNotMatch(workflow,/eas update --branch|eas submit --platform|eas build --platform/);
});
