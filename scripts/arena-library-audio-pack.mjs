/**
 * Arena 70-cue authored-from-recordings sound pack.
 * No procedural oscillators or placeholder tones.
 * All source recordings are already in the BUKLOD repo:
 * Kenney Interface Sounds 1.0, CC0 1.0 (assets/sounds/kingdom-premium/LICENSES.md)
 * plus BUKLOD-owned estate recordings already in the signed staging app.
 * Each cue has a deterministic, semantically chosen real PCM source pair,
 * bounded layered transients, normalized dynamics and a unique SHA-256.
 * Variants are NOT misrepresented as 70 separately recorded studio files.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import path from 'node:path';

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
    hero+'_basic',...skills.map(s=>hero+'_'+s),hero+'_signature'
  ]),...SYSTEM_CUES,
]);
assert.equal(ARENA_SFX_IDS.length,70);
assert.equal(new Set(ARENA_SFX_IDS).size,70);

const SAMPLES_PER_SECOND=22050;
const SOURCE_DIRS=Object.freeze({
  kenney:'assets/sounds/kingdom-premium',
  buklod:'assets/sounds/estate-premium',
});
export const RECORDED_SOURCES=Object.freeze([
  {id:'wood_hit',kind:'kenney',file:'impact-wood.wav',license:'CC0-1.0'},
  {id:'shield_crystal',kind:'kenney',file:'collect-crystal.wav',license:'CC0-1.0'},
  {id:'victory',kind:'kenney',file:'victory.wav',license:'CC0-1.0'},
  {id:'victory_alt',kind:'kenney',file:'victory-alt.wav',license:'CC0-1.0'},
  {id:'unlock',kind:'kenney',file:'unlock.wav',license:'CC0-1.0'},
  {id:'enter',kind:'kenney',file:'enter.wav',license:'CC0-1.0'},
  {id:'coins',kind:'kenney',file:'coins.wav',license:'CC0-1.0'},
  {id:'failure',kind:'kenney',file:'failure.wav',license:'CC0-1.0'},
  {id:'ui',kind:'kenney',file:'ui-soft.wav',license:'CC0-1.0'},
  {id:'construction',kind:'buklod',file:'build_complete.wav',license:'BUKLOD-ORIGINAL'},
  {id:'construction_start',kind:'buklod',file:'build_start.wav',license:'BUKLOD-ORIGINAL'},
  {id:'collection',kind:'buklod',file:'claim.wav',license:'BUKLOD-ORIGINAL'},
  {id:'navigation',kind:'buklod',file:'navigation.wav',license:'BUKLOD-ORIGINAL'},
  {id:'apply',kind:'buklod',file:'apply.wav',license:'BUKLOD-ORIGINAL'},
  {id:'customize',kind:'buklod',file:'customize.wav',license:'BUKLOD-ORIGINAL'},
  {id:'contribute',kind:'buklod',file:'contribute.wav',license:'BUKLOD-ORIGINAL'},
  {id:'unlock_estate',kind:'buklod',file:'unlock.wav',license:'BUKLOD-ORIGINAL'},
]);
const COLOR = Object.freeze({
  attack:['wood_hit','enter'], shield:['shield_crystal','unlock'],
  support:['unlock','collection'], movement:['navigation','enter'],
  strength:['construction','wood_hit'], creation:['construction_start','apply'],
  victory:['victory_alt','unlock_estate'], control:['failure','shield_crystal'],
  magic:['shield_crystal','customize'],
});
function archetype(name){
  if(/(signature|bastion|symphony|crescendo|engine|lesson|dawn|corridor|network|service|measure|formation|canvas)/.test(name)) return 'victory';
  if(/(shield|guard|wall|bastion|stand_united|rescue)/.test(name)) return 'shield';
  if(/(heal|sanctuary|resonance|beacon|restorative|field_patch|service|rejuvenate)/.test(name)) return 'support';
  if(/(dash|route|rush|skip|step|path|intercept)/.test(name)) return 'movement';
  if(/(turret|foundation|construct|build|harvest|mosaic|pigment)/.test(name)) return 'creation';
  if(/(stun|sigil|snare|turning_page|balance)/.test(name)) return 'control';
  if(/(vine|wave|light|seed|harmony|chorus|echo|lance|call|spear)/.test(name)) return 'magic';
  if(/(tower|stone|destroyed|ground|basic|shot)/.test(name)) return 'attack';
  return 'strength';
}
function riffPcm(fileBytes, sourceId){
  const b=fileBytes;
  assert.ok(b.length>60&&b.length<2_000_000,'bounded recorded WAV '+sourceId);
  assert.equal(b.toString('ascii',0,4),'RIFF','WAV RIFF '+sourceId);
  assert.equal(b.toString('ascii',8,12),'WAVE','WAV WAVE '+sourceId);
  let fmt=null,data=null;
  for(let p=12;p+8<=b.length;){
    const kind=b.toString('ascii',p,p+4);
    const count=b.readUInt32LE(p+4);
    const start=p+8;
    assert.ok(start+count<=b.length,'truncated WAV chunk '+sourceId);
    if(kind==='fmt '){
      assert.ok(count>=16,'fmt too small '+sourceId);
      fmt={code:b.readUInt16LE(start),channels:b.readUInt16LE(start+2),
        rate:b.readUInt32LE(start+4),align:b.readUInt16LE(start+12),
        bits:b.readUInt16LE(start+14)};
    }
    if(kind==='data')data=b.subarray(start,start+count);
    p=start+count+(count%2);
  }
  assert.ok(fmt&&data&&data.length>16,'no recorded PCM '+sourceId);
  assert.equal(fmt.code,1,'compressed or non-PCM WAV '+sourceId);
  assert.ok([8,16,24].includes(fmt.bits),'unsupported WAV depth '+sourceId);
  assert.ok(fmt.channels===1||fmt.channels===2,'unsupported channels '+sourceId);
  assert.ok(fmt.rate>=8000&&fmt.rate<=96000,'unsupported rate '+sourceId);
  assert.equal(fmt.align,fmt.channels*fmt.bits/8,'invalid frame alignment '+sourceId);
  const frameCount=Math.floor(data.length/fmt.align);
  assert.ok(frameCount>=48&&frameCount<=fmt.rate*9,'invalid recording duration '+sourceId);
  function frame(index){
    if(index>=frameCount||index<0)return 0;
    let sum=0;
    for(let channel=0;channel<fmt.channels;channel++){
      const offset=index*fmt.align+channel*fmt.bits/8;
      let value;
      if(fmt.bits===8)value=(data.readUInt8(offset)-128)/128;
      else if(fmt.bits===16)value=data.readInt16LE(offset)/32768;
      else value=data.readIntLE(offset,3)/8388608;
      sum+=value;
    }
    return sum/fmt.channels;
  }
  return {id:sourceId,rate:fmt.rate,length:frameCount,at(t){
    const index=t*fmt.rate;
    const floor=Math.floor(index);
    const weight=index-floor;
    return frame(floor)*(1-weight)+frame(floor+1)*weight;
  }};
}
function wav(samples){
  const out=Buffer.alloc(44+samples.length*2);
  out.write('RIFF',0);out.writeUInt32LE(out.length-8,4);
  out.write('WAVEfmt ',8);out.writeUInt32LE(16,16);
  out.writeUInt16LE(1,20);out.writeUInt16LE(1,22);
  out.writeUInt32LE(SAMPLES_PER_SECOND,24);out.writeUInt32LE(SAMPLES_PER_SECOND*2,28);
  out.writeUInt16LE(2,32);out.writeUInt16LE(16,34);
  out.write('data',36);out.writeUInt32LE(samples.length*2,40);
  samples.forEach((s,i)=>out.writeInt16LE(Math.round(Math.max(-0.96,Math.min(0.96,s))*32767),44+i*2));
  return out;
}
export function arenaSfxEntries(root){
  assert.equal(typeof root,'string','root directory must be explicit');
  const decoded=new Map();
  const provenance=[];
  for(const src of RECORDED_SOURCES){
    const rel=path.join(SOURCE_DIRS[src.kind],src.file);
    const bytes=readFileSync(path.join(root,rel));
    const hash=createHash('sha256').update(bytes).digest('hex');
    decoded.set(src.id,riffPcm(bytes,src.id));
    provenance.push({id:src.id,path:rel,sha256:hash,license:src.license,
      rights:src.kind==='kenney'?'assets/sounds/kingdom-premium/LICENSES.md':'BUKLOD preexisting staging sound'});
  }
  const recordings=[];
  const cues=ARENA_SFX_IDS.map((name,serial)=>{
    const chosen=COLOR[archetype(name)];
    const first=decoded.get(chosen[0]),second=decoded.get(chosen[1]);
    assert.ok(first&&second,'missing semantic real recording');
    const h=createHash('sha256').update('BUKLOD_REAL_RECORDED_SFX_V2:'+name).digest();
    const accent=decoded.get(RECORDED_SOURCES[(h[4]%RECORDED_SOURCES.length)].id);
    const signature=name.endsWith('_signature');
    const basic=name.endsWith('_basic');
    const seconds=signature?0.82:basic?0.22:name==='structure_destroyed'?0.75:0.42+(h[0]%8)*0.026;
    const length=Math.floor(seconds*SAMPLES_PER_SECOND);
    const samples=new Float64Array(length);
    const pitchA=0.92+(h[1]%18)/100;
    const pitchB=0.90+(h[2]%22)/100;
    const attack=basic?0.002:0.009;
    const fade=signature?0.12:0.075;
    let peak=0;
    for(let i=0;i<length;i++){
      const time=i/SAMPLES_PER_SECOND;
      const fadeIn=Math.min(1,time/attack);
      const fadeOut=Math.min(1,(seconds-time)/fade);
      const envelope=Math.min(fadeIn,fadeOut);
      const a=first.at(time*pitchA);
      const b=second.at(Math.max(0,time-0.022)*pitchB)*(time>=0.022?1:0);
      const c=accent.at(Math.max(0,time-0.065)*1.02)*(time>=0.065?1:0);
      const value=(a*0.71+b*0.35+c*0.14)*envelope;
      samples[i]=value;
      peak=Math.max(peak,Math.abs(value));
    }
    assert.ok(peak>0.001,'silent recording-driven cue '+name);
    const gain=Math.min(1.7,0.72/peak);
    for(let i=0;i<samples.length;i++)samples[i]*=gain;
    const bytes=wav(samples);
    recordings.push({id:name,category:archetype(name),sources:[first.id,second.id,accent.id],
      sha256:createHash('sha256').update(bytes).digest('hex'),durationMs:Math.round(seconds*1000)});
    return {name:'audio/sfx/'+name+'.wav',bytes};
  });
  assert.equal(new Set(recordings.map(x=>x.sha256)).size,70,'all authored cues must be distinct');
  return {cues,manifest:{schema:2,prototype:false,kind:'layered-real-recordings',
    count:70,sourceCredits:'assets/sounds/kingdom-premium/LICENSES.md',
    sourceCount:provenance.length,provenance,recordings}};
}
