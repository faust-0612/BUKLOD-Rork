import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
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

test('full Marites release suite runs when TypeScript is installed; dependency-free gates retain source checks',()=>{
 if(!existsSync(new URL('../node_modules/typescript/package.json',import.meta.url))){
   assert.match(script,/AWS videos must retain their provider-issued S3 URL/);
   assert.match(script,/offlineModel\.publishMaritesStory/);
   assert.match(script,/model\.isActiveMaritesStory/);
   assert.match(script,/filterMaritesStoriesForViewer/);
   return;
 }
 const output=execFileSync(process.execPath,['scripts/test-marites-release.cjs'],{
   cwd:new URL('../',import.meta.url), encoding:'utf8', timeout:20000,
 });
 assert.match(output,/PASS: Marites text-first video publishing, AWS URL preservation, offline copy, isolation and release contracts/);
});
