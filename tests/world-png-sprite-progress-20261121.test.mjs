import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveWorldSpriteFrame,mayShowWorldSpriteFrame,chooseWorldSpriteAsset,
} from '../src/features/world/worldSpriteFrame.ts';

const state=(patch={})=>({
  worldId:'world-a',track:'house',level:0,stage:0,revision:0,
  origin:'authoritative_server',receiptId:'receipt-from-server',...patch,
});

test('zero starts visually empty, and completed tier uses a bundled PNG key',()=>{
  assert.equal(resolveWorldSpriteFrame(state()).frameKey,null);
  const completed=resolveWorldSpriteFrame(state({level:1,revision:1}));
  assert.equal(completed.frameKey,'hou_l01');
  assert.equal(completed.status,'verified');
});
test('each of three construction stages of NEXT tier has distinct art, preserving previous completed tier',()=>{
  for(let stage=1;stage<=3;stage++){
    const frame=resolveWorldSpriteFrame(state({level:1,stage,revision:stage+1}));
    assert.equal(frame.frameKey,`hou_l02_s0${stage}`);
    assert.equal(frame.fallbackFrameKey,'hou_l01');
    assert.equal(frame.completedLevel,1);
    assert.equal(frame.buildingLevel,2);
  }
  assert.equal(resolveWorldSpriteFrame(state({level:2,stage:0})).frameKey,'hou_l02');
});
test('all currently defined world tracks plus business artwork use distinct prefixes',()=>{
  const expected={personal_lot:'lot',house:'hou',farm:'far',cluster:'com',organization:'org',business:'biz'};
  for(const [track,prefix] of Object.entries(expected)){
    assert.equal(resolveWorldSpriteFrame(state({track,level:10})).frameKey,`${prefix}_l10`);
    assert.equal(resolveWorldSpriteFrame(state({track,level:2,stage:2})).frameKey,`${prefix}_l03_s02`);
  }
});
test('malformed, nonverified, and over-level claims cannot display construction art',()=>{
  for(const data of [
    {origin:'authoritative_server',receiptId:null},{origin:'unknown'},
    {level:-1},{level:11},{stage:4},{stage:-1},{level:10,stage:1},
    {level:1.5},{revision:-1},{worldId:''},
  ]){
    const frame=resolveWorldSpriteFrame(state(data));
    assert.equal(frame.status,'unavailable');
    assert.equal(frame.frameKey,null);
  }
});
test('local art previews are marked and cannot displace verified server state',()=>{
  const verified=resolveWorldSpriteFrame(state({level:3,revision:9}));
  const preview=resolveWorldSpriteFrame(state({origin:'local_design_preview',receiptId:null,level:9,revision:10}));
  assert.equal(preview.status,'preview');
  assert.equal(mayShowWorldSpriteFrame(verified,preview),false);
  assert.equal(mayShowWorldSpriteFrame(verified,resolveWorldSpriteFrame(state({level:1,revision:8}))),false);
  assert.equal(mayShowWorldSpriteFrame(verified,resolveWorldSpriteFrame(state({level:4,revision:9}))),false);
  assert.equal(mayShowWorldSpriteFrame(verified,resolveWorldSpriteFrame(state({level:4,revision:10}))),true);
  assert.equal(mayShowWorldSpriteFrame(verified,resolveWorldSpriteFrame(state({worldId:'world-b',level:1}))),true);
});
test('missing stage art shows last completed image, not a fictional new tier',()=>{
  const frame=resolveWorldSpriteFrame(state({level:2,stage:2,revision:3}));
  assert.deepEqual(chooseWorldSpriteAsset(frame,{'hou_l02':42}),{source:42,artKey:'hou_l02',isFallback:true});
  assert.deepEqual(chooseWorldSpriteAsset(frame,{'hou_l03_s02':43}),{source:43,artKey:'hou_l03_s02',isFallback:false});
  assert.deepEqual(chooseWorldSpriteAsset(frame,{}),{source:null,artKey:null,isFallback:false});
  assert.equal(chooseWorldSpriteAsset(resolveWorldSpriteFrame(state({receiptId:null,level:3})),{'hou_l03':3}).source,null);
});
