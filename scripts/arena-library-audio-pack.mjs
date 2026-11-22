/**
 * Embedded Arena offline audio intake: 70 deterministic, bounded PCM cues.
 * IDs come from the owner's 2026-11-22 Character Code Godot ZIP.
 * Synthesized placeholders, not falsely described as studio voice recordings.
 * No external files/services/dependencies, backend calls or persistent ledger writes.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

export const HERO_CUES = Object.freeze({
  phan:['groundbreaker','foundation_wall','bayanihan_bastion'],
  quin:['route_dash','beacon_mark','horizon_corridor'],
  van:['signal_shield','intercept_rush','command_network'],
  christian:['banner_rush','stand_united','rally_formation'],
  lhen:['resonance_wave','restorative_beat','symphony_of_buklod'],
  ace:['field_patch','knight_step','checkmate_rescue'],
  elesur:['guiding_path','seed_sanctuary','beacon_of_service'],
  jawo:['vine_riff','echo_skip','canopy_crescendo'],
  mitch:['pigment_bolt','mosaic_wall','living_canvas'],
  niel:['echo_lance','conviction_dash','call_of_the_dawn'],
  angel:['ledger_shield','balance_field','equal_measure'],
  vhen:['seed_turret','irrigation_snare','harvest_engine'],
  trudice:['question_sigil','turning_page','grand_lesson'],
});
const SYSTEM_CUES=Object.freeze(['revive','structure_destroyed','tower_shot','villager_levelup','wave_spawn']);
export const ARENA_SFX_IDS=Object.freeze([
  ...Object.entries(HERO_CUES).flatMap(([hero,skills])=>[
    hero+'_basic',...skills.map(s=>hero+'_'+s),hero+'_signature',
  ]),...SYSTEM_CUES,
]);
assert.equal(ARENA_SFX_IDS.length,70);
assert.equal(new Set(ARENA_SFX_IDS).size,70);
const RATE=22050;
function wave(name){
  assert.match(name,/^[a-z0-9_]+$/);
  const hash=createHash('sha256').update('BUKLOD_ARENA_PLACEHOLDER_V1:'+name).digest();
  const signature=name.endsWith('_signature');
  const basic=name.endsWith('_basic');
  const duration=signature?0.68:basic?0.13:name==='structure_destroyed'?0.73:0.3;
  const length=Math.ceil(duration*RATE);
  const buffer=Buffer.alloc(44+length*2);
  buffer.write('RIFF',0);buffer.writeUInt32LE(buffer.length-8,4);buffer.write('WAVEfmt ',8);
  buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);
  buffer.writeUInt16LE(1,22);buffer.writeUInt32LE(RATE,24);
  buffer.writeUInt32LE(RATE*2,28);buffer.writeUInt16LE(2,32);
  buffer.writeUInt16LE(16,34);buffer.write('data',36);buffer.writeUInt32LE(length*2,40);
  const base=160+(hash[0]%32)*12;
  const tone2=base*(1.25+(hash[1]%5)/12);
  const percussive=name.includes('destroyed')||basic||name.includes('shot');
  let state=hash.readUInt32LE(2)||1;
  for(let i=0;i<length;i++){
    const t=i/RATE,ratio=i/length;
    state^=state<<13;state^=state>>>17;state^=state<<5;
    const noise=((state>>>0)/0xffffffff)*2-1;
    const env=Math.min(1,t/0.008)*Math.pow(1-ratio,percussive?3.2:1.6);
    const sweep=percussive?Math.exp(-t*18)*120:Math.sin(t*13)*18;
    const chime=Math.sin(2*Math.PI*(base+sweep)*t)*0.58+
      Math.sin(2*Math.PI*tone2*t)*0.23+
      (percussive?noise*0.14*Math.exp(-t*25):noise*0.025);
    const sample=Math.max(-0.82,Math.min(0.82,env*chime*0.57));
    buffer.writeInt16LE(Math.round(sample*32767),44+i*2);
  }
  return buffer;
}
export function arenaSfxEntries(){
  return ARENA_SFX_IDS.map(name=>({name:'audio/sfx/'+name+'.wav',bytes:wave(name)}));
}
