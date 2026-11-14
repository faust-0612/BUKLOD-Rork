import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const w=readFileSync('.github/workflows/buklod-staging-emergency-rollback-20261114.yml','utf8');
test('restore exact pre-regression visual staging update, not obsolete Navigation V2',()=>{
 assert.match(w,/BUKLOD_STAGING_EMERGENCY_RESTORE_20261114:/);
 assert.match(w,/01a1d606-ce68-79db-8fc3-211db8a41305/);
 assert.match(w,/e1551b09ad180e81a889d39615aea6257688ddea/);
 assert.match(w,/4549f879-a9b6-4577-86a0-585eabafd224/);
 assert.match(w,/01a1d7e7-3895-7867-b913-42f4a273a348/);
 assert.doesNotMatch(w,/39a81f03-8823-4073-80aa-202349170bb1/);
});
test('previous update is republished only to staging-user Android, verified and bounded',()=>{
 assert.match(w,/--destination-branch staging-user --platform android/);
 assert.match(w,/--non-interactive --json/);
 assert.match(w,/stage.id.toLowerCase\(\),u.id.toLowerCase\(\)/);
 assert.match(w,/assert.equal\(production.id,before.productionId/);
 assert.match(w,/assert.equal\(after.id,before.branchId\)/);
 assert.match(w,/Another staging release exists; refuse to overwrite/);
 assert.doesNotMatch(w,/--destination-(?:branch|channel) production|--platform all|eas-cli@[^\\s]+ (?:build|submit|deploy)\s|vercel deploy/);
});

test('EAS update:list group metadata is not mistaken for update:view update ID',()=>{
 assert.match(w,/first.platforms,'android'/);
 assert.match(w,/first.message,\/BUKLOD_NAV_V2_OWNER_STAGING_/);
 assert.match(w,/stage.id.toLowerCase\(\),'01a1d7e7-3895-7867-b913-42f4a273a348'/);
 assert.doesNotMatch(w,/first.id|rows\[0\]\.id|latest.id/);
});
