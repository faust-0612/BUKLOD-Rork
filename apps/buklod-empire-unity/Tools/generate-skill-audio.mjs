// Original deterministic 39-cue audio bank; Node 18+, no external packages.
import {writeFileSync} from 'node:fs';
const rows=[
  {
    "hero": "phan",
    "id": "groundbreaker",
    "shape": "Impact",
    "style": 0,
    "size": 2.7,
    "slot": 0,
    "duration": 0.32,
    "frequency": 150
  },
  {
    "hero": "phan",
    "id": "foundation_wall",
    "shape": "Wall",
    "style": 1,
    "size": 2.2,
    "slot": 1,
    "duration": 0.44,
    "frequency": 197
  },
  {
    "hero": "phan",
    "id": "bayanihan_bastion",
    "shape": "Shield",
    "style": 2,
    "size": 3.4,
    "slot": 2,
    "duration": 0.61,
    "frequency": 244
  },
  {
    "hero": "quin",
    "id": "route_dash",
    "shape": "Dash",
    "style": 3,
    "size": 2.5,
    "slot": 0,
    "duration": 0.335,
    "frequency": 169
  },
  {
    "hero": "quin",
    "id": "beacon_mark",
    "shape": "Mark",
    "style": 4,
    "size": 1.7,
    "slot": 1,
    "duration": 0.455,
    "frequency": 216
  },
  {
    "hero": "quin",
    "id": "horizon_corridor",
    "shape": "Surge",
    "style": 5,
    "size": 3.5,
    "slot": 2,
    "duration": 0.625,
    "frequency": 263
  },
  {
    "hero": "van",
    "id": "signal_shield",
    "shape": "Shield",
    "style": 2,
    "size": 1.9,
    "slot": 0,
    "duration": 0.35,
    "frequency": 188
  },
  {
    "hero": "van",
    "id": "intercept_rush",
    "shape": "Dash",
    "style": 3,
    "size": 2.6,
    "slot": 1,
    "duration": 0.47,
    "frequency": 235
  },
  {
    "hero": "van",
    "id": "command_network",
    "shape": "Shield",
    "style": 2,
    "size": 3.3,
    "slot": 2,
    "duration": 0.64,
    "frequency": 282
  },
  {
    "hero": "christian",
    "id": "banner_rush",
    "shape": "Dash",
    "style": 3,
    "size": 2.8,
    "slot": 0,
    "duration": 0.32,
    "frequency": 207
  },
  {
    "hero": "christian",
    "id": "rally_formation",
    "shape": "Surge",
    "style": 5,
    "size": 2.7,
    "slot": 1,
    "duration": 0.44,
    "frequency": 254
  },
  {
    "hero": "christian",
    "id": "stand_united",
    "shape": "Shield",
    "style": 2,
    "size": 3.6,
    "slot": 2,
    "duration": 0.61,
    "frequency": 301
  },
  {
    "hero": "lhen",
    "id": "resonance_wave",
    "shape": "Impact",
    "style": 0,
    "size": 2.5,
    "slot": 0,
    "duration": 0.335,
    "frequency": 226
  },
  {
    "hero": "lhen",
    "id": "restorative_beat",
    "shape": "Heal",
    "style": 6,
    "size": 2.2,
    "slot": 1,
    "duration": 0.455,
    "frequency": 273
  },
  {
    "hero": "lhen",
    "id": "symphony_of_buklod",
    "shape": "Heal",
    "style": 6,
    "size": 3.6,
    "slot": 2,
    "duration": 0.625,
    "frequency": 320
  },
  {
    "hero": "ace",
    "id": "field_patch",
    "shape": "Heal",
    "style": 6,
    "size": 1.8,
    "slot": 0,
    "duration": 0.35,
    "frequency": 245
  },
  {
    "hero": "ace",
    "id": "knight_step",
    "shape": "Dash",
    "style": 3,
    "size": 2.3,
    "slot": 1,
    "duration": 0.47,
    "frequency": 292
  },
  {
    "hero": "ace",
    "id": "checkmate_rescue",
    "shape": "Shield",
    "style": 2,
    "size": 2.8,
    "slot": 2,
    "duration": 0.64,
    "frequency": 339
  },
  {
    "hero": "ellusur",
    "id": "guiding_path",
    "shape": "Surge",
    "style": 5,
    "size": 2.4,
    "slot": 0,
    "duration": 0.32,
    "frequency": 264
  },
  {
    "hero": "ellusur",
    "id": "seed_sanctuary",
    "shape": "Heal",
    "style": 6,
    "size": 2.6,
    "slot": 1,
    "duration": 0.44,
    "frequency": 311
  },
  {
    "hero": "ellusur",
    "id": "beacon_of_service",
    "shape": "Heal",
    "style": 6,
    "size": 3.8,
    "slot": 2,
    "duration": 0.61,
    "frequency": 358
  },
  {
    "hero": "jawo",
    "id": "vine_riff",
    "shape": "Snare",
    "style": 8,
    "size": 2.9,
    "slot": 0,
    "duration": 0.335,
    "frequency": 283
  },
  {
    "hero": "jawo",
    "id": "echo_skip",
    "shape": "Dash",
    "style": 3,
    "size": 2.7,
    "slot": 1,
    "duration": 0.455,
    "frequency": 330
  },
  {
    "hero": "jawo",
    "id": "canopy_crescendo",
    "shape": "Snare",
    "style": 8,
    "size": 3.8,
    "slot": 2,
    "duration": 0.625,
    "frequency": 377
  },
  {
    "hero": "mitch",
    "id": "pigment_bolt",
    "shape": "Bolt",
    "style": 7,
    "size": 2.5,
    "slot": 0,
    "duration": 0.35,
    "frequency": 302
  },
  {
    "hero": "mitch",
    "id": "mosaic_wall",
    "shape": "Wall",
    "style": 1,
    "size": 2.4,
    "slot": 1,
    "duration": 0.47,
    "frequency": 349
  },
  {
    "hero": "mitch",
    "id": "living_canvas",
    "shape": "Heal",
    "style": 6,
    "size": 3.7,
    "slot": 2,
    "duration": 0.64,
    "frequency": 396
  },
  {
    "hero": "niel",
    "id": "echo_lance",
    "shape": "Bolt",
    "style": 7,
    "size": 2.9,
    "slot": 0,
    "duration": 0.32,
    "frequency": 321
  },
  {
    "hero": "niel",
    "id": "conviction_dash",
    "shape": "Dash",
    "style": 3,
    "size": 3,
    "slot": 1,
    "duration": 0.44,
    "frequency": 368
  },
  {
    "hero": "niel",
    "id": "call_of_the_dawn",
    "shape": "Impact",
    "style": 0,
    "size": 4,
    "slot": 2,
    "duration": 0.61,
    "frequency": 415
  },
  {
    "hero": "angel",
    "id": "ledger_shield",
    "shape": "Shield",
    "style": 2,
    "size": 2.3,
    "slot": 0,
    "duration": 0.335,
    "frequency": 340
  },
  {
    "hero": "angel",
    "id": "balance_field",
    "shape": "Shield",
    "style": 2,
    "size": 2.5,
    "slot": 1,
    "duration": 0.455,
    "frequency": 387
  },
  {
    "hero": "angel",
    "id": "equal_measure",
    "shape": "Shield",
    "style": 2,
    "size": 4,
    "slot": 2,
    "duration": 0.625,
    "frequency": 434
  },
  {
    "hero": "vhen",
    "id": "seed_turret",
    "shape": "Summon",
    "style": 9,
    "size": 2.2,
    "slot": 0,
    "duration": 0.35,
    "frequency": 359
  },
  {
    "hero": "vhen",
    "id": "irrigation_snare",
    "shape": "Snare",
    "style": 8,
    "size": 2.8,
    "slot": 1,
    "duration": 0.47,
    "frequency": 406
  },
  {
    "hero": "vhen",
    "id": "harvest_engine",
    "shape": "Summon",
    "style": 9,
    "size": 3.4,
    "slot": 2,
    "duration": 0.64,
    "frequency": 453
  },
  {
    "hero": "trudice",
    "id": "question_sigil",
    "shape": "Mark",
    "style": 4,
    "size": 2.1,
    "slot": 0,
    "duration": 0.32,
    "frequency": 378
  },
  {
    "hero": "trudice",
    "id": "turning_page",
    "shape": "Shield",
    "style": 2,
    "size": 2,
    "slot": 1,
    "duration": 0.44,
    "frequency": 425
  },
  {
    "hero": "trudice",
    "id": "grand_lesson",
    "shape": "Surge",
    "style": 5,
    "size": 3.9,
    "slot": 2,
    "duration": 0.61,
    "frequency": 472
  }
];
function makeBank(rows){
 const rate=16000, header=12+rows.length*4;const samples=rows.map(r=>Math.round(rate*r.duration));const bytes=new Uint8Array(header+samples.reduce((a,n)=>a+n*2,0)),d=new DataView(bytes.buffer);d.setUint32(0,0x31534b42,true);d.setUint32(4,rate,true);d.setUint32(8,rows.length,true);
 let offset=header;const stats=[];
 for(let i=0;i<rows.length;i++){const r=rows[i],n=samples[i];d.setUint32(12+i*4,n,true);let phase=0,seed=(i+1)*2654435761>>>0,peak=0,sum=0,prev=0;const outOffset=offset;
 for(let j=0;j<n;j++){const t=j/rate,u=j/(n-1),fade=Math.min(1,t/.012)*Math.min(1,(r.duration-t)/.045),env=fade*Math.exp(-u*(r.style===6?1.3:2.7));seed=(Math.imul(seed,1664525)+1013904223)>>>0;const noise=(seed/4294967296)*2-1;prev=.84*prev+.16*noise;
 const sweep=r.style===3||r.style===7?1.6-1.12*u:r.style===6||r.style===2?.75+.68*u:1-.3*u;phase+=2*Math.PI*r.frequency*sweep/rate;
 const harmonic=Math.sin(phase)+.28*Math.sin(phase*2.01)+.13*Math.sin(phase*3.02);
 const soft=Math.sin(phase*1.5)*.35+Math.sin(phase*2.5)*.15;
 const gate=.72+.28*Math.cos(2*Math.PI*u*(2+r.style%4));let val;
 if([0,1,8,9].includes(r.style))val=env*(.27*harmonic+.40*prev+.13*noise*(1-u));
 else if([3,7].includes(r.style))val=env*(.24*harmonic+.27*prev)*gate;
 else val=env*(.27*harmonic+soft*.34)*gate;
 const v=Math.round(Math.max(-.78,Math.min(.78,val))*32767);d.setInt16(offset,v,true);offset+=2;peak=Math.max(peak,Math.abs(v));sum+=v*v;}
 if(peak<1000||peak>26000||Math.abs(d.getInt16(outOffset,true))>4||Math.abs(d.getInt16(offset-2,true))>350)throw Error("Bad cue envelope "+r.id);
 stats.push({id:r.id,samples:n,peak,rms:Math.round(Math.sqrt(sum/n))});
 }if(offset!==bytes.length)throw Error("Bank length mismatch");return {bytes,stats,rate};
}
const bank=makeBank(rows);writeFileSync(new URL('../Assets/Resources/SkillAudioBank.bytes',import.meta.url),bank.bytes);console.log(JSON.stringify(bank.stats,null,2));
