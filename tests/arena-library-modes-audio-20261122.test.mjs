import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ARENA_SFX_IDS, HERO_CUES, arenaSfxEntries} from '../scripts/arena-library-audio-pack.mjs';
const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('all 13 Library hero identities and precisely 70 self-contained WAV cues',()=>{
  assert.equal(Object.keys(HERO_CUES).length,13);
  assert.equal(ARENA_SFX_IDS.length,70);
  assert.equal(new Set(ARENA_SFX_IDS).size,70);
  const entries=arenaSfxEntries();
  assert.equal(entries.length,70);
  assert.ok(entries.every(x=>x.bytes.toString('ascii',0,4)==='RIFF'));
  assert.ok(entries.every(x=>x.bytes.toString('ascii',8,12)==='WAVE'));
  assert.ok(entries.every(x=>x.bytes.readUInt32LE(4)===x.bytes.length-8));
  assert.ok(entries.every(x=>x.bytes.length>=44+22050*0.12*2));
  assert.deepEqual(arenaSfxEntries().map(x=>x.bytes),entries.map(x=>x.bytes),'SFX must be byte-deterministic');
});
test('native Godot packs library SFX and four strictly offline match modes',()=>{
 const pack=source('scripts/build-empire-godot-pack.mjs');
 const hud=source('godot/empire-arena/scripts/arena_hud.gd');
 const actors=source('godot/empire-arena/scripts/arena_library_actors.gd');
 const root=source('godot/empire-arena/scripts/arena_root.gd');
 const audio=source('godot/empire-arena/scripts/arena_audio.gd');
 const modes=['classic_conquest','genesis_rift','dominion_frontier','special_event'];
 for(const mode of modes){
   assert.ok(pack.includes(mode), 'Pack missing '+mode);
   assert.ok(hud.includes(mode), 'HUD missing '+mode);
 }
 assert.match(pack,/ranked:false/g);
 assert.match(pack,/ARENA_SFX_IDS/);
 assert.match(pack,/audio\/sfx\//);
 assert.match(actors,/waveSeconds/);
 assert.match(root,/AUDIO_SCRIPT/);
 assert.match(root,/audio_layer\.play_command/);
 assert.match(root,/audio_layer\.play_match_event/);
 assert.match(audio,/MAX_PLAYERS := 10/);
 assert.doesNotMatch(audio,/Supabase|fetch\(|HTTPClient|Diamond|mint_bp|service_role/i);
});
