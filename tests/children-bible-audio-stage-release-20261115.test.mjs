import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
 BASE,PREVIOUS_UPDATE,PREVIOUS_GROUP,PREVIOUS_MESSAGE,BRANCH,CHANNEL,
 RELEASE_FILE,SCOPE,marker,verifyPrior
} from '../scripts/children-bible-audio-staging-release-20261115.mjs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('new Bible audio stage release is pinned to last verified Android staging, not production',()=>{
 assert.equal(BASE,'ea9a72c687c0885ea6a3c14a883503204f83dad4');
 assert.equal(PREVIOUS_UPDATE,'01a1dfb1-578c-7e47-8547-ff3065c6792a');
 assert.equal(PREVIOUS_GROUP,'f2da9206-4fb6-478b-bc6e-adb47e4030cd');
 assert.equal(CHANNEL,'staging-user');
 assert.equal(BRANCH,'integration/children-bible-audio-staging-132-20261115');
 assert.match(marker('a'.repeat(40)),/STAGE_132_[a-f0-9]{40}$/);
});
test('staging preflight fails closed if any other EAS update advanced',()=>{
 const row={message:'"'+PREVIOUS_MESSAGE+'" (an hour ago by BUKLOD)',runtimeVersion:'1.3.2',group:PREVIOUS_GROUP};
 assert.equal(verifyPrior({currentPage:[row]},PREVIOUS_UPDATE).group,PREVIOUS_GROUP);
 for(const changed of [
  {...row,message:'newer OTA'},
  {...row,message:PREVIOUS_MESSAGE+' tampered'},
  {...row,runtimeVersion:'1.3.5'},
  {...row,group:'unrecognized-group'},
 ]) assert.throws(()=>verifyPrior({currentPage:[changed]},PREVIOUS_UPDATE));
 assert.throws(()=>verifyPrior({currentPage:[row]},'stale-id'));
 assert.throws(()=>verifyPrior({currentPage:[]},PREVIOUS_UPDATE));
});
test('release marker and scope assert runtime 1.3.2, native unchanged, and no child PII',()=>{
 const src=read('scripts/children-bible-audio-staging-release-20261115.mjs');
 const scope=JSON.parse(read(SCOPE));
 const release=JSON.parse(read(RELEASE_FILE));
 assert.equal(scope.baseRef,BASE);
 assert.equal(release.exactPreviousSource,BASE);
 assert.equal(release.targetChannel,CHANNEL);
 assert.equal(release.targetRuntime,'1.3.2');
 assert.equal(release.readyForStaging,true);
 assert.match(src,/verifyBuild\(/);
 assert.match(src,/verifyChannels\(/);
 assert.match(src,/assert\.equal\(eas\.build\.production\.channel,'production'\)/);
 assert.match(src,/production\.id,pre\.productionUpdateId/);
 assert.match(src,/deviceAudioVerified:false/);
 assert.doesNotMatch(src,/apply_migration|db push|service_role|child_user_id/);
});
test('staging publisher cannot build APK or deploy to production',()=>{
 const wf=read('.github/workflows/buklod-children-bible-audio-stage-132-20261115.yml');
 assert.match(wf,/EXPO_TOKEN/);
 assert.match(wf,/--channel staging-user --platform android --environment preview/);
 assert.match(wf,/--skip-bundler --input-dir/);
 assert.match(wf,/stage-updates-recheck\.json/);
 assert.match(wf,/postpublish/);
 assert.match(wf,/Android staged source/);
 assert.doesNotMatch(wf,/update --channel production|eas submit|eas build --platform|supabase db push/);
});
