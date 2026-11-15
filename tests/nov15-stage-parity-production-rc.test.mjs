import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const expected='28cc91dbd9111b999a0e1fc5598ec7e2a845f560';
test('Production RC preserves EXACT latest verified staging source tree without replacing Main release infrastructure',()=>{
 const actual=execFileSync('git',['rev-parse','HEAD:src'],{encoding:'utf8'}).trim();
 assert.equal(actual,expected,'Do not release a subset or an old staging UI');
 const scope=JSON.parse(readFileSync('.buklod/scopes/nov15-stage-parity-production-rc-20261115.json','utf8'));
 assert.equal(scope.exactStageSourceTree,actual);
 const workflow=readFileSync('.github/workflows/production_android_ota.yml','utf8');
 assert.match(workflow,/Publish exact frozen Android RC/);
 assert.match(workflow,/Verify production AdMob live units/);
 assert.match(workflow,/Marites behavior checks/);
 assert.match(workflow,/Verify Profile all-time\/monthly ranks/);
 assert.doesNotMatch(workflow,/BUKLOD_LIFE_STAGING_132_PUBLISH/);
});
