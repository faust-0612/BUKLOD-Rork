import test from 'node:test';
import assert from 'node:assert/strict';
import {GENESIS_IDENTITY,GENESIS_PALETTE,GENESIS_SURFACE_DESIGN,GENESIS_MOTION_MS,getGenesisExperience,isGenesisPreviewEnabled,resolveGenesisMotion}
  from '../src/features/season2/genesis/genesisContract.ts';
import {resolveGenesisAudioPermission} from '../src/features/season2/genesis/genesisAudioPolicy.ts';
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

test('final owner-approved Let There Be Light galactic theme is canonical', () => {
  assert.equal(GENESIS_IDENTITY.title, 'Genesis: Let There Be Light');
  assert.equal(GENESIS_IDENTITY.verse, 'Genesis 1:3');
  assert.equal(GENESIS_IDENTITY.motif, 'galactic-creation');
  assert.equal(GENESIS_IDENTITY.center, 'radiant-first-light');
  assert.match(GENESIS_PALETTE.goldLight, /^#[A-Fa-f0-9]{6}$/);
  assert.equal(Object.keys(GENESIS_SURFACE_DESIGN).length, 8);
  for (const surface of ['home','wall','connect','profile','bible','character','kingdom','reward']) {
    assert.ok(GENESIS_SURFACE_DESIGN[surface].scene.length > 0);
  }
  for (const surface of ['wall','connect','bible']) {
    assert.equal(GENESIS_SURFACE_DESIGN[surface].motion, 'static');
  }
  assert.equal(GENESIS_SURFACE_DESIGN.reward.emphasis, 'verified-reward-only');
});
