import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync('src/app/faith/mentor-evidence.tsx','utf8');
test('mentor photo uses same validated receipt for upload and retry linkage',()=>{
  assert.match(src,/const confirmedSessionId: unknown = data\?\.session_id/);
  assert.match(src,/if \(!isValidSessionId\(confirmedSessionId\)\) throw/);
  assert.match(src,/savedSessionId = confirmedSessionId;/);
  assert.match(src,/setRetrySessionId\(confirmedSessionId\)/);
  assert.match(src,/await uploadPhoto\(confirmedSessionId, photo\)/);
  assert.match(src,/if \(savedSessionId\) \{/);
  assert.match(src,/await uploadPhoto\(retrySessionId, photo\)/);
  assert.doesNotMatch(src,/await uploadPhoto\(savedSessionId, photo\)/);
});

