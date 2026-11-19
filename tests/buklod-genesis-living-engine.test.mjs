import test from 'node:test';
import assert from 'node:assert/strict';
import {GENESIS_PALETTE,GENESIS_MOTION_MS,getGenesisExperience,isGenesisPreviewEnabled,resolveGenesisMotion}
  from '../src/features/season2/genesis/genesisContract.ts';
import {resolveGenesisAudioPermission} from '../src/features/season2/genesis/genesisAudioPolicy.ts';
import {getGenesisApprovedRig,getGenesisApprovedAudio} from '../src/features/season2/genesis/genesisAssetRegistry.ts';
test('unapproved remote art and audio cannot be loaded',()=>{
  assert.equal(getGenesisApprovedRig('https://untrusted.test/file.riv'),null);
  assert.equal(getGenesisApprovedAudio('cheap-beep.wav'),null);
});
test('Genesis means Creation in outer space',()=>{
  assert.equal(getGenesisExperience('home'),'creation-cosmos-hero');
  assert.equal(getGenesisExperience('reward'),'verified-cinematic-reveal');
  assert.ok(GENESIS_PALETTE.cosmos.startsWith('#'));
  assert.ok(GENESIS_MOTION_MS.navigation<250);
});
test('preview never activates from production build',()=>{
  for(const env of [undefined,'','production','prod']) assert.equal(isGenesisPreviewEnabled('true',env),false);
  for(const env of ['staging','preview','development']){
    assert.equal(isGenesisPreviewEnabled('true',env),true);
    assert.equal(isGenesisPreviewEnabled(undefined,env),false);
    assert.equal(isGenesisPreviewEnabled('false',env),false);
  }
});
test('ambient animation stops on background and reduced motion',()=>{
  const c={surface:'home',quality:'full',focused:true,appActive:true,reducedMotion:false};
  assert.equal(resolveGenesisMotion(c).particles,true);
  for(const p of [{appActive:false},{focused:false},{reducedMotion:true},{powerSave:true},{callActive:true},{videoPlaying:true}]){
    assert.equal(resolveGenesisMotion({...c,...p}).ambient,false);
  }
  assert.equal(resolveGenesisMotion({...c,surface:'wall'}).ambient,false);
});
test('social and ad scenes remain silent',()=>{
  const c={surface:'kingdom',enabledByUser:true,approvedAsset:true,foreground:true,
    sceneFocused:true,otherMediaPlaying:false,callActive:false,adVisible:false};
  assert.equal(resolveGenesisAudioPermission(c).allowed,true);
  for(const surface of ['wall','connect','reels','call','ad'])
    assert.equal(resolveGenesisAudioPermission({...c,surface}).allowed,false);
  for(const change of [{enabledByUser:false},{approvedAsset:false},{foreground:false},
    {sceneFocused:false},{otherMediaPlaying:true},{callActive:true},{adVisible:true}])
    assert.equal(resolveGenesisAudioPermission({...c,...change}).allowed,false);
});
