import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {HEROES,MAPS,MODES,PICKUP_TYPES,createPractice,tickPractice} from '../experiments/empire-arena/practice-engine.mjs';

const html=readFileSync(new URL('../experiments/empire-arena/PLAY_BUKLOD_EMPIRE_ARENA_OFFLINE.html',import.meta.url),'utf8');
const noop=()=>{};
function makeContext(){
 return new Proxy({}, {get(t,k){if(k==='createRadialGradient'||k==='createLinearGradient')return ()=>({addColorStop:noop});
  if(!(k in t))t[k]=noop;return t[k];},set(t,k,v){t[k]=v;return true;}});
}
function boot(mode='cluster',map='genesis_rift',hero='phan'){
 const context=makeContext(),nodes={};
 const elem=id=>nodes[id]||(nodes[id]={
  id,value:id==='hero'?hero:id==='mode'?mode:id==='map'?map:'',style:{},hidden:false,disabled:false,
  add:noop,addEventListener:noop,setAttribute(name,value){this[name]=value;},removeAttribute(name){delete this[name];},
  getContext:()=>context,querySelector:()=>({textContent:''}),setPointerCapture:noop,
  getBoundingClientRect:()=>({left:0,top:0,width:844,height:390})
 });
 const doc={getElementById:elem,addEventListener:noop,hidden:false,
  documentElement:{requestFullscreen:async()=>{}},fullscreenElement:null};
 class ImageStub{constructor(){this.complete=true;this.naturalWidth=128;}set src(value){this._src=value;}}
 class AudioStub{play(){return Promise.resolve();}}
 const script=html.slice(html.indexOf('<script type="module">')+'<script type="module">'.length,html.lastIndexOf('</script>'));
 const run=new Function('window','document','Image','Option','screen','performance','requestAnimationFrame',
  'setInterval','setTimeout','clearTimeout','innerWidth','innerHeight','devicePixelRatio','Audio',script+
  '\nreturn {start,step,draw,drawMinimap,inputAction,getMatch:()=>match,getApproach:()=>approachTargetId,setMove:(x,y)=>{move={x,y}}};');
 const game=run({addEventListener:noop},doc,ImageStub,function(){},{orientation:{lock:async()=>{}}},
  {now:()=>1000},noop,noop,noop,noop,844,390,1,AudioStub);
 game.start();return game;
}
test('movement and held input no longer overtake queued attack or primary skill',()=>{
 const g=boot(),state=g.getMatch(),p=state.players['A-0'],enemy=state.players['B-0'];
 enemy.x=p.x+3;enemy.y=p.y;g.setMove(1,0);
 g.inputAction('attack');g.inputAction('skill');g.step();
 assert.ok(state.events.some(e=>e.type==='hit'&&e.from===p.id),'tap Attack should connect');
 assert.ok(state.events.some(e=>e.type==='skill'&&e.from===p.id),'tap Skill must activate while walking');
 assert.ok(state.teams.A.flux>40,'Architect should gain Flux');
});
test('multiple queued actions cannot become stale behind newer movement sequence',()=>{
 const g=boot(),s=g.getMatch(),p=s.players['A-0'],enemy=s.players['B-0'];
 enemy.x=p.x+2;enemy.y=p.y;g.setMove(1,0);
 for(let i=0;i<5;i++)g.inputAction('attack');
 g.step();const first=p.seq;
 g.step();assert.ok(p.seq>first);
 assert.ok(s.events.some(e=>e.type==='hit'&&e.from==='A-0'));
});
test('attack outside range starts player-initiated approach rather than silent rejection',()=>{
 const g=boot(),p=g.getMatch().players['A-0'],oldX=p.x;
 g.inputAction('attack');assert.ok(g.getApproach());
 for(let i=0;i<15;i++)g.step();
 assert.ok(p.x>oldX);
});
test('all nine practice mode and map combinations simulate with no accounts',()=>{
 for(const mode of Object.keys(MODES))for(const map of Object.keys(MAPS)){
  const g=boot(mode,map);g.draw();g.drawMinimap();g.step();const s=g.getMatch();
  assert.equal(s.ranked,false);assert.equal(Object.keys(s.players).length,MODES[mode].n*2);
  for(const field of ['diamonds','BP','qmp','cash','account','ledger'])assert.equal(field in s,false);
 }
});
test('all six practice hero primary classes have concrete effects',()=>{
 for(const [kind,heroId] of Object.entries({supply:'phan',heal:'van',guard:'christian',burst:'ace',disrupt:'trudice',blink:'quin'})){
  const s=createPractice({mode:'duel',hero:heroId}),p=s.players['A-0'],q=s.players['B-0'];
  q.x=p.x+3;q.y=p.y;p.hp=30;const before={x:p.x,sh:p.shield,flux:s.teams.A.flux,hp:p.hp,enemyHp:q.hp};
  tickPractice(s,[{actorId:p.id,seq:1,type:'skill',slot:'primary',target:q.id,dx:1,dy:0}]);
  if(kind==='supply')assert.ok(s.teams.A.flux>before.flux&&p.shield>before.sh);
  if(kind==='heal')assert.ok(p.hp>before.hp);
  if(kind==='guard')assert.ok(p.shield>before.sh);
  if(kind==='burst'||kind==='disrupt')assert.ok(q.hp<before.enemyHp);
  if(kind==='blink')assert.ok(p.x>before.x);
  assert.ok(s.events.some(e=>e.type==='skill'&&e.from===p.id),kind+' missing skill receipt');
 }
 assert.equal(Object.keys(HEROES).length,13);
});
test('medic ultimate heals allies and consumes team Flux',()=>{
 const s=createPractice({mode:'duel',hero:'van'}),p=s.players['A-0'];p.hp=20;
 tickPractice(s,[{actorId:p.id,seq:1,type:'skill',slot:'ultimate'}]);
 assert.ok(p.hp>20);assert.equal(s.teams.A.flux,10);
 assert.ok(s.events.some(e=>e.type==='ultimate_heal'));
});
test('temporary practice items apply once then respawn without wallets',()=>{
 const s=createPractice(),p=s.players['A-0'],item=s.pickups[0];p.x=item.x;p.y=item.y;p.hp=15;
 tickPractice(s);assert.ok(p.hp>15);assert.ok(item.availableAt>=30000);
 assert.equal(s.events.filter(e=>e.type==='item_collect').length,1);
 tickPractice(s);assert.equal(s.events.filter(e=>e.type==='item_collect').length,1);
 assert.equal(Object.keys(PICKUP_TYPES).length,3);assert.equal(s.ranked,false);
});
test('graphics, audio and landscape media remain offline and explicit',()=>{
 assert.match(html,/function drawMinimap/);assert.match(html,/floats=floats.filter/);
 assert.match(html,/fxTrails=fxTrails.filter/);assert.match(html,/match.pickups/);
 assert.match(html,/screen\.orientation\.lock\('landscape'\)/);
 assert.match(html,/id="combatHint"/);assert.match(html,/id="heroPower"/);
 assert.equal((html.match(/data:image\/png;base64,/g)||[]).length,156);
 assert.equal((html.match(/data:audio\/ogg;base64,/g)||[]).length,11);
 assert.doesNotMatch(html,/https?:\/\/[^"\s]*supabase/i);
});

test('capturing a relay must not invalidate same-tick attack and skill',()=>{
 const g=boot(),s=g.getMatch(),p=s.players['A-0'],enemy=s.players['B-0'];
 p.x=20;p.y=12;enemy.x=22;enemy.y=12;g.setMove(1,0);
 g.inputAction('attack');g.inputAction('skill');g.step();
 assert.ok(s.events.some(e=>e.type==='hit'&&e.from===p.id));
 assert.ok(s.events.some(e=>e.type==='skill'&&e.from===p.id));
});
test('enemy Core attack is reachable when two team relays are connected',()=>{
 const g=boot(),s=g.getMatch(),p=s.players['A-0'],old=s.teams.B.coreHp;
 for(let i=0;i<2;i++){s.relays[i].progress=100;s.relays[i].owner='A';}
 p.x=35;p.y=12;
 for(const b of Object.values(s.players).filter(q=>q.team==='B')){b.x=6;b.y=6;}
 g.inputAction('attack');g.step();
 assert.ok(s.teams.B.coreHp<old);
 assert.ok(s.events.some(e=>e.type==='core_attack'&&e.from===p.id));
});
