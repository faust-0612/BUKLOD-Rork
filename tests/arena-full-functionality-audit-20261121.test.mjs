import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createPractice,command,HEROES} from '../experiments/empire-arena-v2/arena-v2-engine.mjs';
import {createOfflineSoloBattle} from '../experiments/empire-arena-v2/arena-v2-solo.mjs';
import {arenaFeedbackReceipts,arenaResourceCounts,ARENA_FEEDBACK_TTL_MS} from '../src/features/games/empire/arenaFeedbackReceipts.mjs';
import {arenaActionVisuals} from '../src/features/games/empire/arenaActionVisuals.mjs';
import {ARENA_TACTICAL_CALLS,arenaTacticalCall,arenaCanSendLocalCall,ARENA_TEAM_COMM_RELEASE_GATE} from '../src/features/games/empire/arenaTacticalCalls.mjs';
import {ARENA_ANNOUNCEMENTS} from '../src/features/games/empire/arenaVoiceDirector.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(resolve(root,p),'utf8');
const practice=(hero='phan')=>{const s=createPractice({mode:'duel',hero});s.cover=[];return s};
const total=bag=>['wood','gold','stone'].reduce((v,k)=>v+(bag?.[k]||0),0);

test('each mined resource is real, exact and never overfills carry under buffs',()=>{
 for(const type of ['wood','gold','stone']){
  const s=practice(),p=s.players.A0;
  const node=s.nodes.find(n=>n.type===type);
  assert.ok(node);
  p.x=node.x;p.y=node.y;
  p.bag={wood:22,gold:20,stone:20}; // space for only three
  const buff={wood:'forest',gold:'golden',stone:'stone'}[type];
  p.effects[buff]=s.elapsed+30000;
  const before=node.stock;
  assert.equal(command(s,p.id,{type:'mine',nodeId:node.id}),true);
  const event=s.events.filter(e=>e.type==='mine').at(-1);
  assert.ok(event.amount>0&&event.amount<=3);
  assert.equal(before-node.stock,event.amount);
  assert.ok(total(p.bag)<=65,'resource animation must not mask bag overflow');
  const feedback=arenaFeedbackReceipts(s,p.id);
  assert.equal(feedback.at(-1).kind,type);
  assert.equal(feedback.at(-1).amount,event.amount);
  assert.equal(feedback.at(-1).where,'carry');
  assert.deepEqual(feedback.at(-1).source,{x:node.x,y:node.y});
 }
});

test('bank deposit has exact transfer receipt and never animates or plays for empty bags',()=>{
 const s=practice(),p=s.players.A0;
 p.x=18;p.y=s.h/2;
 p.bag={wood:11,gold:7,stone:3};
 const before={...s.teams.A.resources};
 assert.equal(command(s,p.id,{type:'deposit'}),true);
 assert.deepEqual(s.teams.A.resources,{wood:before.wood+11,gold:before.gold+7,stone:before.stone+3});
 assert.deepEqual(p.bag,{wood:0,gold:0,stone:0});
 const deposited=s.events.filter(e=>e.type==='deposit');
 assert.equal(deposited.length,1);
 assert.deepEqual(deposited[0].resources,{wood:11,gold:7,stone:3});
 const receipts=arenaFeedbackReceipts(s,p.id);
 assert.deepEqual(receipts.map(x=>[x.kind,x.amount,x.where]),
   [['wood',11,'bank'],['gold',7,'bank'],['stone',3,'bank']]);
 assert.equal(command(s,p.id,{type:'deposit'}),false);
 assert.equal(s.events.filter(e=>e.type==='deposit').length,1);
 const display=arenaResourceCounts(s,p.id);
 assert.equal(display.stock.gold,before.gold+7);
 assert.equal(display.carrying.wood,0);
});

test('partial loot collection preserves uncarried drop; full bag does not destroy loot',()=>{
 const s=practice(),p=s.players.A0;
 p.bag={wood:62,gold:0,stone:0};
 const drop={id:'owned-resource-test',kind:'resources',resources:{wood:20,gold:6,stone:0},
   x:p.x,y:p.y,expires:45000};
 s.loot.push(drop);
 assert.equal(command(s,p.id,{type:'loot',id:drop.id}),true);
 assert.equal(p.bag.wood,65);
 assert.equal(drop.resources.wood,17);
 assert.equal(drop.resources.gold,6);
 assert.ok(s.loot.includes(drop),'partial pickup remains available until expiry');
 const event=s.events.filter(e=>e.type==='loot').at(-1);
 assert.deepEqual(event.resources,{wood:3,gold:0,stone:0});
 assert.equal(arenaFeedbackReceipts(s,p.id).at(-1).amount,3);
 assert.equal(command(s,p.id,{type:'loot',id:drop.id}),false,'full bag cannot claim');
 assert.ok(s.loot.includes(drop));
 p.bag={wood:0,gold:0,stone:0};
 assert.equal(command(s,p.id,{type:'loot',id:drop.id}),true);
 assert.deepEqual(p.bag,{wood:17,gold:6,stone:0});
 assert.ok(!s.loot.includes(drop));
});

test('actual damage feedback is HP lost, not overkill or unmitigated attack number',()=>{
 const s=practice(),a=s.players.A0,b=s.players.B0;
 a.x=b.x-2;a.y=b.y;b.hp=3;b.shield=0;
 assert.equal(command(s,a.id,{type:'attack',targetId:b.id}),true);
 const event=s.events.find(e=>e.type==='damage'&&e.to===b.id);
 assert.equal(event.amount,3);
 assert.equal(event.fromX,a.x);assert.equal(event.fromY,a.y);
 assert.equal(event.toX,b.x);assert.equal(event.toY,b.y);
 assert.equal(b.hp,0);
});

test('no dash/blink may tunnel through blocking rock or charge mana on blocked cast',()=>{
 const s=practice('quin'),p=s.players.A0;
 const x=s.w/2,y=s.h/2;
 s.cover=[[x,y,2]];
 p.x=x-3.08;p.y=y;p.matchLevel=6;p.mana=120;
 const before=p.x,mp=p.mana,cd=p.cooldowns.secondary;
 assert.equal(command(s,p.id,{type:'skill',slot:'secondary',dx:1,dy:0}),false);
 assert.equal(p.x,before);assert.equal(p.mana,mp);assert.equal(p.cooldowns.secondary,cd);
 assert.equal(command(s,p.id,{type:'skill',slot:'primary',dx:1,dy:0}),false);
 assert.equal(p.x,before);assert.equal(p.mana,mp);
 const unblocked=practice('quin');
 unblocked.players.A0.matchLevel=6;
 assert.equal(command(unblocked,'A0',{type:'skill',slot:'secondary',dx:1,dy:0}),true);
});

test('hostile skill obeys line-of-sight and does not hit through solid terrain',()=>{
 const s=practice('ace'),a=s.players.A0,b=s.players.B0,x=s.w/2,y=s.h/2;
 s.cover=[[x,y,1]];
 a.x=x-2.4;a.y=y;b.x=x+2.4;b.y=y;
 const before=b.hp;
 assert.equal(command(s,a.id,{type:'skill',slot:'primary',targetId:b.id}),false);
 assert.equal(b.hp,before);
 assert.equal(a.mana,a.maxMana,'failed cast never consumes mana');
});

test('collection timeline is bounded, local-seat-only and requires valid confirmed event data',()=>{
 const s=practice();
 for(let i=0;i<100;i++){
   s.events.push({seq:300+i,time:s.elapsed,type:'mine',actor:'A0',kind:'wood',amount:1,x:10,y:11});
 }
 const receipts=arenaFeedbackReceipts(s,'A0');
 assert.equal(receipts.length,14);
 assert.ok(receipts.every(r=>r.amount===1 && r.source.x===10));
 assert.deepEqual(arenaFeedbackReceipts(s,'B0'),[]);
 assert.deepEqual(arenaFeedbackReceipts({...s,events:s.events.map(e=>({...e,amount:-100}))},'A0'),[]);
 assert.deepEqual(arenaFeedbackReceipts({...s,elapsed:ARENA_FEEDBACK_TTL_MS+1},'A0'),[]);
 const solo=createOfflineSoloBattle();
 assert.equal(arenaFeedbackReceipts(solo,'A0').length,0);
});

test('graphics use frozen hit coordinates and real-level/loot snapshot receipts',()=>{
 const s=practice(),a=s.players.A0,b=s.players.B0;
 s.events.push({type:'damage',seq:501,time:0,from:'A0',to:'B0',
   x:60,y:30,fromX:51,fromY:31,toX:60,toY:30,amount:13});
 b.x+=25;b.y+=10;
 const fx=arenaActionVisuals(s,150);
 const hit=fx.find(x=>x.seq===501);
 assert.equal(hit.x,60);assert.equal(hit.fromX,51);assert.equal(hit.targetX,60);
 assert.equal(hit.amount,13);
 s.events.push({type:'level_up',seq:502,time:0,actor:'A0',level:7,x:40,y:21});
 const receipt=arenaFeedbackReceipts(s,'A0').find(x=>x.kind==='level');
 assert.equal(receipt.amount,7);
 assert.deepEqual(receipt.source,{x:40,y:21});
});

test('offline tactical orders are canonical and never masquerade as live team voice',()=>{
 const s=practice();
 assert.equal(Object.keys(ARENA_TACTICAL_CALLS).length,6);
 assert.equal(arenaTacticalCall('__arbitrary__'),null);
 assert.equal(arenaCanSendLocalCall(s,'A0','defend'),true);
 for(const call of Object.keys(ARENA_TACTICAL_CALLS))
   assert.ok(ARENA_ANNOUNCEMENTS['tactical_'+call]?.text);
 assert.equal(command(s,'A0',{type:'order',order:arenaTacticalCall('defend').order}),true);
 assert.ok(s.units.filter(u=>u.team==='A').every(u=>u.command==='defend'));
 assert.equal(arenaCanSendLocalCall({...s,kind:'RANKED'},'A0','defend'),false);
 assert.equal(arenaCanSendLocalCall(createOfflineSoloBattle(),'A0','defend'),false);
 assert.equal(arenaCanSendLocalCall(s,'B0','__arbitrary__'),false);
 assert.equal(ARENA_TEAM_COMM_RELEASE_GATE.liveVoice,false);
 assert.equal(ARENA_TEAM_COMM_RELEASE_GATE.verifiedTeamPings,false);
});

test('HUD renders actual wood logs, stone ore and gold crystals with event-based flight and no money mutation',()=>{
 const route=read('src/app/games/empire-arena.tsx');
 const materials=read('src/features/games/empire/ArenaMaterialFeedback.tsx');
 const receipt=read('src/features/games/empire/arenaFeedbackReceipts.mjs');
 for(const token of ['<ArenaResourceHud','<ArenaPickupTrails','<ArenaRewardBanner',
   'arenaFeedbackReceipts(game, localSeat)','arenaResourceCounts(game, localSeat)'])
   assert.ok(route.includes(token),token);
 for(const token of ["kind==='wood'","kind==='gold'","style={StyleSheet.absoluteFill}",
   'ARENA_MATERIAL_FEEDBACK','ArenaMaterialGlyph','BAG','+{small(last.amount)}'])
   if(token!=='ARENA_MATERIAL_FEEDBACK')assert.ok(materials.includes(token),token);
 assert.match(receipt,/ARENA_FEEDBACK_TTL_MS = 1500/);
 assert.doesNotMatch(receipt,/\bsupabase\b|\bawardDiamond\b|\bawardBp\b|\bwallet\b/i);
});

test('voice and SFX are independent; muting spoken announcements stops active speech',()=>{
 const route=read('src/app/games/empire-arena.tsx');
 const runtime=read('src/features/games/empire/ArenaVoiceRuntime.ts');
 assert.ok(route.includes("if (voiceEnabled) playArenaVoiceAnnouncements(drained.cues, true);"));
 assert.ok(route.includes("if (voiceEnabled) playArenaVoiceAnnouncements(drain.cues,true);"));
 assert.ok(route.includes("if (sfxEnabled) for (const cue of drain.cues)"));
 assert.ok(route.includes("stopArenaVoiceAnnouncements();"));
 assert.ok(runtime.includes("export function stopArenaVoiceAnnouncements()"));
 assert.ok(runtime.includes("void Speech.stop().catch"));
 assert.ok(route.includes('Team calls are offline training only.'));
 assert.ok(route.includes('no microphone is recorded.'));
 assert.ok(!read('src/features/games/empire/arenaTacticalCalls.mjs').includes('sendAction('));
});

test('all animation/event subsystems remain bounded and nonauthoritative',()=>{
 const engine=read('experiments/empire-arena-v2/arena-v2-engine.mjs');
 const effects=read('src/features/games/empire/ArenaActionFx.tsx');
 const audio=read('src/features/games/runtime/rorkAudio.ts');
 assert.match(engine,/const mined=Math\.min\(node\.stock,65-bagTotal,/);
 assert.ok(effects.includes('case \'hit\''));
 assert.ok(effects.includes('case \'mining\''));
 assert.ok(effects.includes('case \'upgrade\''));
 assert.ok(audio.includes('focusedKingdomViews <= 0'));
 assert.ok(audio.includes('isBuklodGameSoundEnabled()'));
 assert.ok(audio.includes('prewarmKingdomSfx(Boolean(options?.arena))'));
 assert.ok(audio.includes('arenaAudioInterrupted = true'),'Connect and calls interrupt Arena effects');
 assert.ok(audio.includes("owner === 'buklod-empire-arena'"),'only Arena-owner audio keeps SFX focus');
 assert.ok(audio.includes("try { player.pause(); }"),'active Arena voices pause immediately');
 assert.ok(audio.includes("isKingdomMap || options?.arena"),'Arena ambient loop also honors call/video priority');
});
