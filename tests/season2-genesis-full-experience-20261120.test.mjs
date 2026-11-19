import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveGenesisAudioPermission} from '../src/features/season2/genesis/genesisAudioPolicy.ts';
import {GENESIS_IDENTITY,isGenesisPreviewEnabled,resolveGenesisMotion} from '../src/features/season2/genesis/genesisContract.ts';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const audioBase={
  surface:'kingdom',enabledByUser:true,approvedAsset:true,foreground:true,
  sceneFocused:true,otherMediaPlaying:false,callActive:false,adVisible:false,
};
test('cinematic audio is opt-in, approved, focused and yields to calls/media/ads',()=>{
  assert.equal(resolveGenesisAudioPermission(audioBase).allowed,true);
  for(const patch of [
    {enabledByUser:false},{approvedAsset:false},{foreground:false},
    {sceneFocused:false},{otherMediaPlaying:true},{callActive:true},
    {adVisible:true},{reducedAudio:true},{surface:'wall'},
    {surface:'connect'},{surface:'reels'},{surface:'ad'},
  ]){
    assert.equal(resolveGenesisAudioPermission({...audioBase,...patch}).allowed,false,JSON.stringify(patch));
  }
});
test('approved theme is Genesis: Let There Be Light, not old botanical launch',()=>{
  assert.equal(GENESIS_IDENTITY.title,'Genesis: Let There Be Light');
  assert.equal(GENESIS_IDENTITY.center,'radiant-first-light');
  assert.equal(GENESIS_IDENTITY.verse,'Genesis 1:3');
});
test('Season 2 is never activated by date or production environment',()=>{
  for(const env of ['production','prod','',undefined]){
    assert.equal(isGenesisPreviewEnabled('true',env),false);
  }
  assert.equal(isGenesisPreviewEnabled('false','staging'),false);
  assert.equal(isGenesisPreviewEnabled('true','staging'),true);
});
test('decorative motion pauses for background, reduced motion, calls and videos',()=>{
  const base={surface:'kingdom',quality:'full',focused:true,appActive:true,reducedMotion:false};
  assert.equal(resolveGenesisMotion(base).ambient,true);
  for(const patch of [{focused:false},{appActive:false},{reducedMotion:true},
    {powerSave:true},{videoPlaying:true},{callActive:true}]){
    assert.equal(resolveGenesisMotion({...base,...patch}).ambient,false,JSON.stringify(patch));
  }
});
test('actual owner artwork, rig fallback, ambient opt-in and canonical theme stay isolated',()=>{
  const portal=read('src/features/season2/genesis/GenesisKingdomPortal.tsx');
  const sky=read('src/features/season2/genesis/GenesisCosmicSky.tsx');
  const routes=read('src/app/games/index.tsx');
  const theme=read('src/providers/BuklodThemeProvider.tsx');
  const realm=read('src/features/season2/genesis/GenesisRiveCharacter.native.tsx');
  assert.match(portal,/useRorkGameAmbience\('kingdom-map'\)/);
  assert.match(portal,/toggleMusic/);
  assert.match(portal,/GenesisOrbitHalo/);
  assert.match(portal,/GenesisRiveCharacter/);
  assert.match(sky,/useGenesisMotionAllowed\(active,'balanced','character'\)/);
  assert.match(realm,/getGenesisApprovedRig/);
  assert.match(realm,/fallback={fallback}/);
  assert.match(routes,/genesisPreview \? <GenesisKingdomPortal \/> : <BuklodKingdomMap \/>/);
  assert.match(theme,/seasonLocked \? getLockedSeasonTheme\(\)/);
  assert.ok(!portal.includes('float.interpolate'));
});
