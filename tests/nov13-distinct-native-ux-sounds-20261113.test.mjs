import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('nine unique original WAV sounds are explicitly bundled and losslessly validated',()=>{
 const source=read('src/lib/buklodSounds.ts'); const hashes=new Set();
 for(const style of ['classic','gentle','celebration']) for(const category of ['message','community','achievement']) {
   const path='assets/sounds/buklod_'+style+'_'+category+'_20261113.wav';
   const buf=readFileSync(new URL('../'+path,import.meta.url));
   assert.equal(buf.toString('ascii',0,4),'RIFF');
   assert.equal(buf.toString('ascii',8,12),'WAVE');
   assert.equal(buf.readUInt32LE(24),24000);
   assert.ok(buf.length>18000);
   assert.ok(source.includes("require('../../"+path+"')"),path);
   hashes.add(createHash('sha256').update(buf).digest('hex'));
 }
 assert.equal(hashes.size,9);
 assert.match(source,/PROFILE_EARCONS\[settings\.soundProfile\]\[identity\]/);
 assert.match(source,/cue==='alert'\|\|cue==='error'/);
 assert.match(source,/setPlaybackRate\(PROFILE_RATE/);
});
