import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {arenaZoom,arenaZoomSpan,arenaTouchCenter,arenaTouchDistance,arenaDragPan,arenaMinimapPan} from '../src/features/games/empire/arenaViewportControls.mjs';
import {arenaCamera} from '../src/features/games/empire/arenaPracticePresentation.mjs';
const read=p=>readFileSync(resolve(import.meta.dirname,'..',p),'utf8');
test('Arena pinch, zoom buttons and camera reset have deterministic bounded math',()=>{
 assert.equal(arenaZoom(999),2.4);
 assert.equal(arenaZoom(-2),0.6);
 assert.equal(arenaZoom(NaN),1);
 assert.ok(arenaZoomSpan(90,2)<arenaZoomSpan(90,1));
 assert.ok(arenaZoomSpan(90,0.6)>arenaZoomSpan(90,1));
 const touches=[{pageX:100,pageY:100},{pageX:200,pageY:100}];
 assert.equal(arenaTouchDistance(touches),100);
 assert.deepEqual(arenaTouchCenter(touches),{x:150,y:100});
});
test('Camera respects edge coordinates instead of treating zero as missing',()=>{
 const camera=arenaCamera(220,120,{x:0,y:0},812,280,arenaZoomSpan(90,1));
 assert.equal(camera.x,0);
 assert.equal(camera.y,0);
});
test('Arena drag and minimap work for portrait/landscape with safe camera bounds',()=>{
 for(const [w,h] of [[812,280],[360,640],[1024,480]]){
  const camera=arenaCamera(220,120,{x:110,y:60},w,h,arenaZoomSpan(90,1.1));
  const pan=arenaDragPan({x:0,y:0},30,-20,camera,w,h);
  assert.ok(pan.x<0&&pan.y>0);
  assert.deepEqual(arenaMinimapPan(60,34,120,68,220,120,{x:110,y:60}),{x:0,y:0});
  for(const zoom of [0.6,1,2.4]){
   const c=arenaCamera(220,120,{x:9999,y:-9999},w,h,arenaZoomSpan(90,zoom));
   assert.ok(c.x>=0&&c.y>=0&&c.x+c.width<=220.00001&&c.y+c.height<=120.00001);
  }
 }
});
test('Genesis-only Arena is immersive with safe navigation and economic guard',()=>{
 const shell=read('src/components/BuklodNavSafeShell.tsx');
 const screen=read('src/app/games/empire-arena.tsx');
 assert.match(shell,/immersiveArena = normalizedPath === '\/games\/empire-arena'/);
 assert.match(shell,/!immersiveIgpat && !immersiveArena \? <BuklodFocusAppAdStrip/);
 assert.match(shell,/!immersiveArena && rawNavOccupied > 0/);
 for(const s of ['ScrollView','onResponderMove={onCameraGesture}','Zoom in battlefield',
  'Zoom out battlefield','Follow character and reset camera','Move camera to selected minimap location',
  'paddingRight: Math.max(0, insets.right)','StatusBar.setHidden(false',
  'OrientationLock.DEFAULT','requiresAcceptance','maintenance_mode','update_required',
  '!isGenesisPreviewBuild()','diamonds: 0, verifiedItems: []']) assert.ok(screen.includes(s),s);
 assert.doesNotMatch(screen,/awardDiamond|awardBp|settleWorldTrade|\.rpc\(/);
});
