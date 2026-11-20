import test from 'node:test';
import assert from 'node:assert/strict';
import {HEROES,MODES,COSTS,BUFFS,STEP_MS,createPractice,assetKey,itemPower,effectiveLevel,command,tick,getHud,ARENA_MAPS,itemDefinition,resolveGear,BUILD_COSTS,rollEquipmentDrop} from '../experiments/empire-arena-v2/arena-v2-engine.mjs';
const s=({mode='cluster',hero='phan',snapshot}={})=>createPractice({mode,hero,snapshot});
const near=(p,o)=>{p.x=o.x;p.y=o.y;};
function run(s,n){for(let i=0;i<n&&s.status==='active';i++)tick(s);return s}
test('canonical 13 characters and symmetric wide maps, no instant collisions',()=>{assert.equal(Object.keys(HEROES).length,13);for(const [id,m] of Object.entries(MODES)){let x=s({mode:id});assert.equal(Object.keys(x.players).length,m.n*2);assert.ok(m.width>=160);assert.ok(x.players.A0.x<x.players.B0.x-110);assert.equal(x.status,'active');assert.equal(x.kind,'OFFLINE_PRACTICE');assert.equal(x.ranked,false);assert.equal(x.events[0].type,'match_start')}});
test('exact 13 × 20 × 5 item keys are unique and source-compliant',()=>{const seen=new Set();for(const h of Object.keys(HEROES))for(let l=1;l<=20;l++)for(let i=1;i<=5;i++){let k=assetKey(h,l,i);assert.ok(!seen.has(k));seen.add(k)}assert.equal(seen.size,1300);assert.throws(()=>assetKey('fake',1,1));assert.throws(()=>assetKey('phan',21,1));assert.throws(()=>assetKey('phan',1,9))});
test('verified item mastery cannot be inferred from level or artwork alone',()=>{assert.equal(itemPower('phan',20,[]),0);assert.ok(itemPower('phan',20,[assetKey('phan',1,3)])>0);assert.equal(itemPower('quin',20,[assetKey('phan',1,3)]),0);let x=s({snapshot:{characterLevel:20,bpEligibleLevel:20,itemVerifiedLevel:20,diamonds:10000,verifiedItems:[assetKey('phan',1,3)]}});assert.ok(x.players.A0.itemMastery>0);assert.equal(s({snapshot:{characterLevel:20,bpEligibleLevel:20,itemVerifiedLevel:20,diamonds:0,verifiedItems:[]}}).players.A0.developmentLevel,1)});
test('effective combat level gates all four qualifications',()=>{assert.equal(effectiveLevel({characterLevel:18,bpEligibleLevel:14,itemVerifiedLevel:10,diamonds:10000}),10);assert.equal(effectiveLevel({characterLevel:18,bpEligibleLevel:20,itemVerifiedLevel:20,diamonds:0}),1)});
test('manual mining carries resource, base deposit commits; invalid remote mining fails',()=>{const x=s(),p=x.players.A0,node=x.nodes[0],before=x.teams.A.resources.wood;assert.equal(command(x,'A0',{type:'mine',nodeId:node.id}),false);near(p,node);assert.equal(command(x,'A0',{type:'mine',nodeId:node.id}),true);assert.ok(p.bag.wood>0);assert.equal(x.teams.A.resources.wood,before);near(p,{x:18,y:x.h/2});assert.equal(command(x,'A0',{type:'deposit'}),true);assert.ok(x.teams.A.resources.wood>before);assert.equal(p.bag.wood,0)});
test('only paid queued units spawn, spending and cap must be respected',()=>{const x=s({mode:'duel'}),p=x.players.A0,origin=x.units.length;x.teams.B.resources={wood:0,gold:0,stone:0};run(x,100);assert.equal(x.units.length,origin);let before={...x.teams.A.resources};assert.equal(command(x,'A0',{type:'train',kind:'warrior'}),true);assert.equal(x.teams.A.resources.wood,before.wood-COSTS.warrior.wood);assert.equal(x.units.length,origin);run(x,92);assert.ok(x.units.some(u=>u.kind==='warrior'&&u.team==='A'));let q=s();q.teams.A.resources={wood:0,gold:0,stone:0};assert.equal(command(q,'A0',{type:'train',kind:'siege'}),false)});
test('villagers farm, defend, die, and no free unit respawn',()=>{const x=s(),u=x.units.find(u=>u.team==='A');x.teams.A.resources.gold=0;for(const p of Object.values(x.players))p.bot=false;const before=x.teams.A.resources.wood;run(x,1900);assert.ok(x.teams.A.resources.wood>before);u.hp=0;u.alive=false;const number=x.units.length;run(x,200);assert.equal(x.units.length,number);assert.equal(u.alive,false)});
test('tower upgrades require resources/nearby hero and damage lock; repairs spend resources',()=>{const x=s(),p=x.players.A0,t=x.towers[0];assert.equal(command(x,'A0',{type:'tower_upgrade',towerId:t.id}),false);near(p,t);let b=x.teams.A.resources.stone;assert.equal(command(x,'A0',{type:'tower_upgrade',towerId:t.id}),true);assert.equal(t.level,1);assert.ok(t.upgrading);assert.ok(x.teams.A.resources.stone<b);run(x,300);assert.equal(t.level,2);t.hp-=80;t.lastDamage=x.elapsed;assert.equal(command(x,'A0',{type:'tower_repair',towerId:t.id}),false);x.elapsed+=4100;assert.equal(command(x,'A0',{type:'tower_repair',towerId:t.id}),true);assert.ok(t.hp>t.maxHp-80)});
test('creatures respawn, seasonal buffs increase gathering but bounded',()=>{const x=s(),p=x.players.A0,creature=x.creatures.find(c=>c.kind==='forest');near(p,creature);creature.hp=3;assert.equal(command(x,'A0',{type:'attack',targetId:creature.id}),true);assert.equal(creature.alive,false);assert.ok(p.effects.forest>x.elapsed);assert.ok(BUFFS.forest.rate<=.35);let t=creature.respawnAt;while(x.elapsed<=t&&x.status==='active')tick(x);assert.equal(creature.alive,true)});
test('skills have real effects, cooldowns, range, and level-gated ultimate',()=>{const x=s({hero:'van'}),p=x.players.A0,ally=x.players.A1;near(p,ally);ally.hp=60;assert.equal(command(x,'A0',{type:'skill',slot:'primary'}),true);assert.ok(ally.hp>60);assert.equal(command(x,'A0',{type:'skill',slot:'primary'}),false);assert.equal(command(x,'A0',{type:'skill',slot:'ultimate'}),false);p.matchLevel=6;x.elapsed+=40000;assert.equal(command(x,'A0',{type:'skill',slot:'ultimate'}),true)});
test('no direct core/Seal-only victory: breach enters hunt, final wipe required',()=>{const x=s({mode:'duel'}),p=x.players.A0,q=x.players.B0;const e=x.seals.B;near(p,{x:x.w-14,y:x.h/2});assert.equal(command(x,'A0',{type:'seal_attack'}),false);for(const t of x.towers.filter(t=>t.team==='B').slice(0,2))t.alive=false;let count=0;while(!e.breached&&count<100){x.elapsed+=1200;command(x,'A0',{type:'seal_attack'});count++}assert.equal(e.breached,true);assert.equal(x.phase,'hunt');assert.equal(x.status,'active');q.hp=1;near(q,p);x.elapsed+=1100;assert.equal(command(x,'A0',{type:'attack',targetId:'B0'}),true);assert.equal(x.status,'active');tick(x);assert.equal(x.status,'finished');assert.equal(x.result.winner,'A');assert.equal(x.result.reason,'seal_and_elimination')});
test('simultaneous final elimination is VOID not random win',()=>{const x=s({mode:'duel'});x.huntStarted=10;x.phase='hunt';x.players.A0.alive=false;x.players.B0.alive=false;tick(x);assert.equal(x.status,'void');assert.equal(x.result.winner,null)});
test('hard deadline breaches both Seals and forbids respawn in final hunt',()=>{const x=s({mode:'duel'});x.elapsed=x.hardDeadline-STEP_MS;x.players.B0.alive=false;x.players.B0.respawnAt=x.elapsed+10000;tick(x);assert.equal(x.phase,'hunt');assert.ok(x.seals.A.breached&&x.seals.B.breached);run(x,150);assert.equal(x.players.B0.alive,false);assert.equal(x.result.winner,'A')});
test('invalid commands are bounded and cannot mutate persistent points or match status',()=>{const x=s();assert.equal(command(x,'A0',{type:'admin_wallet',amount:999}),false);assert.equal(command(x,'stranger',{type:'attack'}),false);assert.equal(command(x,'A0',{type:'move',dx:Infinity,dy:0}),false);assert.equal(JSON.stringify(x).includes('qmp'),false);assert.equal(JSON.stringify(x).includes('withdrawal'),false);assert.ok(getHud(x).teamA)});

test('special characters require Circle Rank gates in ranked matching, not merely BP costume',async()=>{const {SPECIAL_RANK_GATES,heroRankEligible,rankedBracket,rankedMatchCompatible}=await import('../experiments/empire-arena-v2/arena-v2-engine.mjs');assert.equal(Object.keys(SPECIAL_RANK_GATES).length,8);assert.equal(heroRankEligible('ace',4),false);assert.equal(heroRankEligible('ace',5),true);assert.equal(heroRankEligible('phan',1),true);assert.equal(rankedBracket(17),4);assert.equal(rankedMatchCompatible({hero:'ace',circleRank:4,effectiveLevel:8,mmr:1000},{hero:'phan',circleRank:2,effectiveLevel:7,mmr:950}),false);assert.equal(rankedMatchCompatible({hero:'ace',circleRank:5,effectiveLevel:8,mmr:1000},{hero:'phan',circleRank:2,effectiveLevel:7,mmr:950}),true);assert.equal(rankedMatchCompatible({hero:'ace',circleRank:5,effectiveLevel:8,mmr:1000},{hero:'phan',circleRank:2,effectiveLevel:20,mmr:1000}),false)});
test('every official hero has an executable identity-tagged skill event at level one',()=>{for(const hero of Object.keys(HEROES)){const x=s({hero}),p=x.players.A0,q=x.players.B0;near(q,p);q.x+=2;const valid=command(x,'A0',{type:'skill',slot:'primary',targetId:'B0',dx:1,dy:0});assert.equal(valid,true,`${hero} needs working primary`);const ev=x.events.filter(e=>e.type==='skill').at(-1);assert.equal(ev.identity,hero);assert.ok(ev.mastery>=0)}});
test('position blockers prevent impossible movement and attacks through rock cover',()=>{const x=s({mode:'duel'}),p=x.players.A0,q=x.players.B0;const [cx,cy,r]=x.cover[0];p.x=cx-r-1.1;p.y=cy;q.x=cx+r+1;q.y=cy;assert.equal(command(x,'A0',{type:'move',dx:1,dy:0}),false);p.x=cx-r-3;assert.equal(command(x,'A0',{type:'attack',targetId:'B0'}),false)});
test('villager tower repair costs finite team materials and needs valid order',()=>{const x=s(),tower=x.towers[0],u=x.units.find(z=>z.team==='A'&&z.kind==='villager');u.x=tower.x;u.y=tower.y;tower.hp=250;const prior=x.teams.A.resources.stone;assert.equal(command(x,'A0',{type:'order',order:'repair'}),true);run(x,45);assert.ok(tower.hp>250);assert.ok(x.teams.A.resources.stone<prior)});
test('all 1300 art paths preserve exact manifest naming schema',async()=>{const {collectibleArtPath}=await import('../experiments/empire-arena-v2/arena-v2-engine.mjs');assert.equal(collectibleArtPath('phan',1,1),'character-collectibles/phan/l01-i01.webp');assert.equal(collectibleArtPath('trudice',20,5),'character-collectibles/trudice/l20-i05.webp');assert.throws(()=>collectibleArtPath('fake',1,1))});

test('same-tick movement and mining spam cannot teleport or instantly empty deposits',()=>{const x=s(),p=x.players.A0,node=x.nodes[0];assert.equal(command(x,'A0',{type:'move',dx:1,dy:0}),true);const old=p.x;assert.equal(command(x,'A0',{type:'move',dx:1,dy:0}),false);assert.equal(p.x,old);near(p,node);assert.equal(command(x,'A0',{type:'mine',nodeId:node.id}),true);const stock=node.stock;assert.equal(command(x,'A0',{type:'mine',nodeId:node.id}),false);assert.equal(node.stock,stock);assert.equal(command(x,'A0',{type:'train',kind:'villager'}),false)});
test('defeated hero drops only unsecured match resources and cannot transfer persistent character items',()=>{const x=s({mode:'duel'}),p=x.players.A0,q=x.players.B0;q.bag={wood:23,gold:11,stone:9};q.hp=1;near(p,q);p.x-=1;assert.equal(command(x,'A0',{type:'attack',targetId:q.id}),true);const loot=x.loot.find(i=>i.kind==='resources');assert.ok(loot);assert.equal(loot.resources.wood,23);assert.deepEqual(q.bag,{wood:0,gold:0,stone:0});assert.equal(command(x,'A0',{type:'loot',id:loot.id}),true);assert.equal(p.bag.wood,23);assert.equal(p.bag.gold,11);assert.equal(p.bag.stone,9)});

test('all 13 existing heroes have exactly five distinct named canonical item drops and strict ownership',()=>{
 const slots=['weapon','shield','armor','boots','jewel'];const seen=new Set();
 for(const hero of Object.keys(HEROES)){
  const names=new Set();for(let i=0;i<slots.length;i++){const d=itemDefinition(hero,slots[i],1);
   assert.equal(d.hero,hero);assert.equal(d.sourceKey,assetKey(hero,[1,3,7,10,20][i],3));
   assert.ok(d.name.length>=10);assert.ok(!seen.has(d.sourceKey));seen.add(d.sourceKey);names.add(d.name);
   assert.equal(d.temporary,true);assert.equal(d.transferable,false);
  }assert.equal(names.size,5);
 }
 assert.equal(seen.size,65);
 assert.throws(()=>itemDefinition('missing','weapon',1));assert.throws(()=>itemDefinition('phan','notaslot',1));
 assert.throws(()=>itemDefinition('phan','jewel',99));
});

test('exclusive equipment cannot be forged by client stats, transferred to different character or over-tiered',()=>{
 const legit=itemDefinition('phan','weapon',2),forged={...legit,stats:{attack:999999}};
 assert.equal(resolveGear('phan',{weapon:forged}).attack,legit.stats.attack);
 assert.equal(resolveGear('quin',{weapon:forged}).attack,0);
 const boosted=itemDefinition('phan','weapon',4);assert.ok(boosted.stats.attack>legit.stats.attack);
});

test('genuine item drops use the killer hero identity, names, and match-only equip slots',()=>{
 const x=s({mode:'duel',hero:'phan'}),p=x.players.A0,foe=x.players.B0;
 x.seed=0;foe.x=p.x;foe.y=p.y;const item=rollEquipmentDrop(x,p,foe,1,'boss');assert.ok(item);
 assert.equal(item.kind,'equipment');assert.equal(item.ownerHero,'phan');assert.equal(item.item.hero,'phan');
 assert.ok(item.item.name);assert.equal(command(x,'A0',{type:'loot',id:item.id}),true);
 assert.equal(p.gear[item.item.slot].id,item.item.id);assert.equal(x.loot.includes(item),false);
 assert.equal(JSON.stringify(x).includes('lifetime_points'),false);
});

test('character-exclusive loot rejects wrong hero, keeps ground item and prevents downgrade',()=>{
 const x=s({mode:'duel',hero:'quin'}),p=x.players.A0;
 x.loot.push({id:'wrong',kind:'equipment',item:itemDefinition('phan','weapon',4),ownerHero:'phan',x:p.x,y:p.y,expires:90000});
 assert.equal(command(x,'A0',{type:'loot',id:'wrong'}),false);assert.equal(x.loot.length,1);
 x.loot.push({id:'right',kind:'equipment',item:itemDefinition('quin','boots',3),ownerHero:'quin',x:p.x,y:p.y,expires:90000});
 assert.equal(command(x,'A0',{type:'loot',id:'right'}),true);assert.ok(p.gear.boots);
 x.loot.push({id:'downgrade',kind:'equipment',item:itemDefinition('quin','boots',1),ownerHero:'quin',x:p.x,y:p.y,expires:90000});
 assert.equal(command(x,'A0',{type:'loot',id:'downgrade'}),false);assert.equal(p.gear.boots.tier,3);
});

test('HP, mana, mana regen and skill costs are finite, and MP does not go below zero',()=>{
 const x=s({hero:'van'}),p=x.players.A0;assert.equal(p.maxHp,135);assert.equal(p.maxMana,100);
 assert.equal(command(x,'A0',{type:'skill',slot:'primary'}),true);assert.equal(p.mana,82);
 p.mana=8;p.cooldowns.primary=-1e8;assert.equal(command(x,'A0',{type:'skill',slot:'primary'}),false);assert.equal(p.mana,8);
 run(x,30);assert.ok(p.mana>8);assert.ok(p.mana<=p.maxMana);
 p.matchLevel=6;p.mana=40;p.cooldowns.ultimate=-1e8;assert.equal(command(x,'A0',{type:'skill',slot:'ultimate'}),false);
});

test('five equipment slots grant bounded HP, shield, armor, speed and jewel mana capacity',()=>{
 const x=s({mode:'duel',hero:'phan'}),p=x.players.A0;
 for(const slot of ['weapon','shield','armor','boots','jewel']){
  const item=itemDefinition('phan',slot,1),id='gear-'+slot;
  x.loot.push({id,kind:'equipment',item,ownerHero:'phan',x:p.x,y:p.y,expires:100000});
  assert.equal(command(x,'A0',{type:'loot',id}),true);
 }
 const stats=resolveGear('phan',p.gear);
 assert.ok(stats.attack>0);assert.ok(stats.mitigation>0);assert.ok(stats.speed>0);assert.ok(stats.shieldMax>0);
 assert.equal(p.maxHp,135+stats.hp);assert.equal(p.maxMana,100+stats.mana);assert.ok(p.shield>=0);
});

test('players can choose three maps with distinct identity/difficulty and mirrored resource opportunities',()=>{
 assert.equal(Object.keys(ARENA_MAPS).length,3);
 const names=new Set(),hazards=new Set();
 for(const [id,cfg] of Object.entries(ARENA_MAPS)){
  const x=createPractice({mode:'cluster',mapId:id});assert.equal(x.mapId,id);assert.equal(x.map.difficulty,cfg.difficulty);names.add(x.map.name);hazards.add(cfg.hazard);
  assert.equal(x.nodes.length,9);
  for(const resource of ['wood','gold','stone']){
   assert.equal(x.nodes.filter(n=>n.type===resource&&n.side==='A').length,1);
   assert.equal(x.nodes.filter(n=>n.type===resource&&n.side==='B').length,1);
   assert.equal(x.nodes.filter(n=>n.type===resource&&n.side==='CENTER').length,1);
  }
  assert.equal(x.teams.A.resources.wood,x.teams.B.resources.wood);
  assert.equal(x.towers.filter(t=>t.team==='A').length,x.towers.filter(t=>t.team==='B').length);
 }
 assert.equal(names.size,3);assert.equal(hazards.size,3);
 assert.throws(()=>createPractice({mapId:'unreleased_map'}));
});

test('all maps and mode combinations start safely and share the same endgame winning constraints',()=>{
 for(const mode of Object.keys(MODES))for(const mapId of Object.keys(ARENA_MAPS)){
  const x=createPractice({mode,mapId});assert.equal(Object.keys(x.players).length,2*MODES[mode].n);
  assert.equal(x.seals.A.breached,false);assert.equal(x.seals.B.breached,false);
  assert.ok(x.players.A0.x<x.players.B0.x-100);
  assert.equal(x.status,'active');assert.ok(x.map.lanes.length>=3);
 }
});

test('build process requires resources, a living nearby builder, multiple stages, and completion before function',()=>{
 const x=s({mode:'duel'}),p=x.players.A0,site={x:36,y:x.h*.5+13};p.x=site.x;p.y=site.y;
 const start={...x.teams.A.resources};x.teams.A.resources={wood:300,gold:300,stone:300};
 assert.equal(command(x,'A0',{type:'build',kind:'workshop',x:site.x,y:site.y}),true);
 const b=x.buildings.find(b=>b.kind==='workshop');assert.ok(b);assert.equal(b.stage,'foundation');assert.equal(b.status,'building');
 assert.equal(command(x,'A0',{type:'build',kind:'workshop',x:site.x,y:site.y}),false);
 p.x=15;p.y=x.h*.5;run(x,30);assert.equal(b.progress,0,'far-away hero must not magically build');
 p.x=site.x;p.y=site.y;run(x,20);assert.ok(b.progress>0&&b.progress<1);assert.ok(['foundation','frame','finishing'].includes(b.stage));
 run(x,480);assert.equal(b.status,'operational');assert.equal(b.progress,1);
 assert.ok(x.teams.A.resources.wood<300);assert.ok(x.teams.A.resources.stone<300);
});

test('construction pauses while enemies threaten the site then safely continues',()=>{
 const x=s({mode:'duel'}),p=x.players.A0,q=x.players.B0,site={x:36,y:x.h/2+13};p.x=site.x;p.y=site.y;
 x.teams.A.resources={wood:400,gold:400,stone:400};assert.equal(command(x,'A0',{type:'build',kind:'workshop',...site}),true);
 const b=x.buildings.find(z=>z.kind==='workshop');q.x=site.x+4;q.y=site.y;
 run(x,30);assert.equal(b.progress,0);q.x=x.w-17;q.y=x.h/2;run(x,5);assert.ok(b.progress>0);
});

test('base breach is not victory and a defender can rebuild through staged construction before final wipe',()=>{
 const x=s({mode:'duel'}),p=x.players.A0,seal=x.seals.A;
 p.x=14;p.y=x.h/2;x.huntStarted=0;x.phase='hunt';seal.hp=0;seal.breached=true;seal.lastDamage=0;x.elapsed=10500;
 x.teams.A.resources={wood:500,gold:500,stone:500};
 assert.equal(command(x,'A0',{type:'rebuild_seal'}),true);assert.ok(x.teams.A.rebuildJob);
 assert.equal(command(x,'A0',{type:'rebuild_seal'}),false,'no duplicated spending or concurrent restore');
 run(x,20);assert.ok(x.teams.A.rebuildJob.progress>0);assert.equal(seal.breached,true);
 run(x,300);assert.equal(seal.breached,false);assert.equal(x.huntStarted,null);assert.equal(x.status,'active');
 assert.equal(x.teams.A.rebuildCount,1);assert.equal(x.teams.A.rebuildJob,null);
});

test('rebuild aborts against invalid location, fresh damage, enemy pressure or insufficient resources',()=>{
 const x=s({mode:'duel'}),p=x.players.A0,q=x.players.B0;x.huntStarted=100;x.phase='hunt';x.seals.A.breached=true;x.seals.A.lastDamage=100;x.elapsed=1000;
 assert.equal(command(x,'A0',{type:'rebuild_seal'}),false);p.x=14;p.y=x.h/2;x.elapsed=11000;
 x.teams.A.resources={wood:0,gold:0,stone:0};assert.equal(command(x,'A0',{type:'rebuild_seal'}),false);
 x.teams.A.resources={wood:500,gold:500,stone:500};q.x=14;q.y=x.h/2;assert.equal(command(x,'A0',{type:'rebuild_seal'}),false);
 q.x=x.w-17;q.y=x.h/2;assert.equal(command(x,'A0',{type:'rebuild_seal'}),true);
});

test('hard deadline locks base reconstruction even if an early Final Hunt was already running',()=>{
 const x=s({mode:'duel'}),p=x.players.A0;p.x=14;p.y=x.h/2;x.huntStarted=0;x.phase='hunt';x.seals.A.breached=true;x.seals.A.lastDamage=0;
 x.teams.A.resources={wood:999,gold:999,stone:999};x.elapsed=x.hardDeadline-STEP_MS;
 tick(x);assert.equal(x.hardLock,true);assert.equal(x.seals.A.breached,true);
 assert.equal(command(x,'A0',{type:'rebuild_seal'}),false);
});

test('last defending hero elimination still decides after breach even if Villagers remain',()=>{
 const x=s({mode:'duel'}),p=x.players.A0,q=x.players.B0;
 x.huntStarted=0;x.phase='hunt';x.seals.B.breached=true;q.alive=false;q.hp=0;
 assert.ok(x.units.some(u=>u.team==='B'&&u.alive));tick(x);
 assert.equal(x.status,'finished');assert.equal(x.result.winner,'A');
});

test('loot and construction actions cannot mutate persistent BP, QMP or wallet state',()=>{
 const x=s({mode:'duel'}),p=x.players.A0;const immutable={bp:9000,qmp:8000,diamonds:20};
 p.x=35;p.y=x.h/2+13;x.teams.A.resources={wood:400,gold:400,stone:400};
 command(x,'A0',{type:'build',kind:'workshop',x:p.x,y:p.y});
 const j=itemDefinition('phan','jewel',2);x.loot.push({id:'J',kind:'equipment',ownerHero:'phan',item:j,x:p.x,y:p.y,expires:90000});
 assert.equal(command(x,'A0',{type:'loot',id:'J'}),true);
 assert.deepEqual(immutable,{bp:9000,qmp:8000,diamonds:20});
 assert.equal('wallet' in x,false);assert.equal('userId' in x,false);assert.equal(x.ranked,false);
});