import test from 'node:test';
import assert from 'node:assert/strict';
import {HEROES,MAPS,MODES,createPractice,tickPractice,aiCommands,connectedRelays} from '../experiments/empire-arena/practice-engine.mjs';
import {readFileSync} from 'node:fs';
test('all thirteen official characters and all practice shapes',()=>{
 assert.equal(Object.keys(HEROES).length,13);assert.ok(HEROES.ellusur);assert.equal(HEROES.elesur,undefined);
 assert.equal(Object.keys(MAPS).length,3);assert.equal(Object.keys(MODES).length,3);
 for(const [mode,cfg] of Object.entries(MODES)){const s=createPractice({mode});assert.equal(Object.keys(s.players).length,cfg.n*2);assert.equal(s.ranked,false);}
});
test('practice cannot modify or expose canonical wallets, even after a battle result',()=>{
 const s=createPractice({mode:'cluster'});for(const n of s.relays){n.progress=100;n.owner='A';}
 for(let i=0;i<241;i++)tickPractice(s);
 assert.equal(s.result.winner,'A');assert.equal(s.result.loser,'B');assert.equal(s.ranked,false);
 for(const key of ['diamonds','BP','bp','qmp','cash','account','ledger'])assert.equal(key in s,false);
});
test('out-of-order input and friendly fire are rejected',()=>{
 const s=createPractice(),p=s.players['A-0'],mate=s.players['A-1'],x=p.x,hp=mate.hp;
 tickPractice(s,[{actorId:p.id,seq:1,type:'move',dx:1,dy:0}]);assert.ok(p.x>x);
 const moved=p.x;tickPractice(s,[{actorId:p.id,seq:1,type:'move',dx:1,dy:0}]);assert.equal(p.x,moved);
 tickPractice(s,[{actorId:p.id,seq:2,type:'attack',target:mate.id}]);assert.equal(mate.hp,hp);
});
test('AI has monotonic per-bot input and does not masquerade as ranked users',()=>{
 const s=createPractice(),cs=aiCommands(s);assert.ok(cs.length>0);
 assert.equal(cs.some(c=>c.actorId==='A-0'),false);
 for(const id of new Set(cs.map(c=>c.actorId))){const q=cs.filter(c=>c.actorId===id);assert.ok(q.every((c,i)=>!i||c.seq>q[i-1].seq));}
 tickPractice(s,cs);assert.equal(s.ranked,false);
});
test('genuine duel tie resolves as VOID, not a fabricated loser',()=>{
 const s=createPractice({mode:'duel'});s.players['B-0'].hp=s.players['A-0'].hp;s.elapsedMs=MODES.duel.duration-50;
 tickPractice(s);assert.equal(s.overtime,true);s.elapsedMs+=60000;tickPractice(s);
 assert.equal(s.status,'void');assert.equal(s.result.winner,null);
});
test('standalone game has embedded assets and no remote account endpoints',()=>{
 const html=readFileSync(new URL('../experiments/empire-arena/PLAY_BUKLOD_EMPIRE_ARENA_OFFLINE.html',import.meta.url),'utf8');
 assert.match(html,/data:image\/png;base64,/);assert.match(html,/data:audio\/ogg;base64,/);
 assert.match(html,/OFFLINE TRAINING/);
 assert.doesNotMatch(html,/https?:\/\/[^"\s]*supabase/i);
});
test('landscape UI is explicit and uses best-effort browser orientation without claiming native support',()=>{
 const html=readFileSync(new URL('../experiments/empire-arena/PLAY_BUKLOD_EMPIRE_ARENA_OFFLINE.html',import.meta.url),'utf8');
 assert.match(html,/@media\(orientation:portrait\)\{#rotateGate\{display:flex\}\}/);
 assert.match(html,/id="tryLandscape"/);assert.match(html,/requestFullscreen\(/);
 assert.match(html,/screen\.orientation\.lock\('landscape'\)/);
 assert.match(html,/role="dialog" aria-label="Landscape required"/);
});
test('cinematic practice camera follows local hero and never breaks targeting coordinates',()=>{
 const html=readFileSync(new URL('../experiments/empire-arena/PLAY_BUKLOD_EMPIRE_ARENA_OFFLINE.html',import.meta.url),'utf8');
 assert.match(html,/Math\.max\(w\/m\.width,h\/m\.height\)\*1\.14/);
 assert.match(html,/camera\.x\+=\(desiredX-camera\.x\)\*\.17/);
 assert.match(html,/mapping=\{scale,x:camera\.x,y:camera\.y\}/);
 assert.match(html,/wx=\(e\.clientX-rect\.left-mapping\.x\)\/mapping\.scale/);
 assert.doesNotMatch(html,/const reservedTop=Math\.max\(65/);
});
test('all practice actors receive sprite animation while embedded offline media remains intact',()=>{
 const html=readFileSync(new URL('../experiments/empire-arena/PLAY_BUKLOD_EMPIRE_ARENA_OFFLINE.html',import.meta.url),'utf8');
 assert.match(html,/const motion=main\?/);
 assert.match(html,/sprite\[motion\+'_'\+facing\]/);
 assert.match(html,/function drawCrystal\(/);assert.match(html,/function drawMinimap\(/);
 assert.match(html,/draw\(ms\);drawMinimap\(\)/);
 assert.equal((html.match(/data:image\/png;base64,/g)||[]).length,156);
 assert.equal((html.match(/data:audio\/ogg;base64,/g)||[]).length,11);
 assert.doesNotMatch(html,/https?:\/\/[^"\s]*supabase/i);
});
