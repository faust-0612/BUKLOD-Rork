import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectVisibleMaritesVideo } from '../src/lib/buklodMaritesPlayback.ts';
const script = readFileSync(new URL('../scripts/test-marites-release.cjs', import.meta.url), 'utf8');
const bounds = {x:0,y:100,width:360,height:252,windowWidth:360,windowHeight:800,
  topInset:24,bottomInset:64,offset:0,cardWidth:186,gap:7,videos:[true,true,true]};

test('verified staging playback begins with partial real frame, without requiring full card',()=>{
  assert.equal(selectVisibleMaritesVideo(bounds),0);
  assert.equal(selectVisibleMaritesVideo({...bounds,y:700}),0,
    '36px actual frame above the bottom inset qualifies before full entry');
  assert.match(script,/select\(\{\.\.\.bounds, y: 700\}\), 0/);
});

test('near-hidden and offscreen frames never start playback despite nearby prewarm',()=>{
  for(const value of [-252,716,736,800])
    assert.equal(selectVisibleMaritesVideo({...bounds,y:value}),-1,'unsafe frame y='+value);
  assert.equal(selectVisibleMaritesVideo({...bounds,offset:9999}),-1);
  assert.equal(selectVisibleMaritesVideo({...bounds,width:0}),-1);
  assert.match(script,/select\(\{\.\.\.bounds, y: 716\}\), -1/);
  assert.ok(!script.includes('select({...bounds, y: 700}), -1'));
});
