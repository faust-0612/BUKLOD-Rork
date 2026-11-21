/**
 * BUKLOD Empire Arena — native-practice adapter for the owner's initial
 * Godot 4 Character code Library (2026-11-21).
 * Six supplied kits: Phan, Quin, Van, Christian, Lhen, Ace.
 *
 * World-distance scale: 40 Godot pixels ~= one Arena simulation unit.
 * Damage/HP are normalized to Arena's existing 135-HP match actors; these
 * are match-only tuning values, NOT permanent character progression.
 * Deterministic: no randomness, wall-clock, network, payout or BP access.
 * Seven other heroes retain their existing native Arena behaviors.
 */
export const STARTER_HERO_KITS = Object.freeze({
  phan: {name:'Phan',speed:200,passive:'lands_resolve',
    basic:{damage:22,range:3,cooldown:800},
    primary:{id:'groundbreaker',cd:8000},secondary:{id:'foundation_wall',cd:12000},
    ultimate:{id:'bayanihan_bastion',cd:90000}},
  quin: {name:'Quin',speed:240,passive:'trail_sense',
    basic:{damage:25,range:13,cooldown:700},
    primary:{id:'route_dash',cd:8000},secondary:{id:'beacon_mark',cd:12000},
    ultimate:{id:'horizon_corridor',cd:90000}},
  van: {name:'Van',speed:210,passive:'protective_link',
    basic:{damage:19,range:3,cooldown:900},
    primary:{id:'signal_shield',cd:8000},secondary:{id:'intercept_rush',cd:12000},
    ultimate:{id:'command_network',cd:90000}},
  christian: {name:'Christian',speed:210,passive:'command_presence',
    basic:{damage:28,range:3.5,cooldown:800},
    primary:{id:'banner_rush',cd:8000},secondary:{id:'rally_formation',cd:12000},
    ultimate:{id:'stand_united',cd:90000}},
  lhen: {name:'Lhen',speed:220,passive:'harmony_weaver',
    basic:{damage:20,range:10,cooldown:800},
    primary:{id:'resonance_wave',cd:8000},secondary:{id:'restorative_beat',cd:12000},
    ultimate:{id:'symphony_of_buklod',cd:90000}},
  ace: {name:'Ace',speed:210,passive:'critical_care',
    basic:{damage:19,range:9.5,cooldown:800},
    primary:{id:'field_patch',cd:8000},secondary:{id:'knight_step',cd:12000},
    ultimate:{id:'checkmate_rescue',cd:90000}},
});
const clamp = (v,a,b) => Math.max(a,Math.min(b,Number.isFinite(v)?v:a));
const dist = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
const live = p => !!p && p.alive!==false && p.hp>0;
const people = s => Object.values(s.players);
const allies = (s,p,r) => people(s).filter(q=>q.team===p.team&&live(q)&&dist(q,p)<=r);
const enemies = (s,p,r) => people(s).filter(q=>q.team!==p.team&&live(q)&&dist(q,p)<=r);
const setBuff=(p,name,value,until,now)=>{
  const k='kit'+name, t=k+'Until', e=p.effects;
  if((e[t]||0)<=now || value>=(e[k]||0)){e[k]=value;e[t]=Math.max(e[t]||0,until)}
};
const heal=(p,n)=>{if(live(p))p.hp=Math.min(p.maxHp,p.hp+Math.max(0,n))};
const shield=(p,n,cap)=>{p.shield=Math.min(cap,p.maxHp*.5,(p.shield||0)+Math.max(0,n))};
const cleanse=p=>{
  delete p.effects.kitStunUntil;delete p.effects.kitSlowUntil;delete p.effects.kitDefDownUntil;
  delete p.effects.kitTauntedUntil;delete p.effects.slow;
};
const direction=(p,a)=>{
  const x=Number(a.dx),y=Number(a.dy),length=Math.hypot(x,y);
  if(!Number.isFinite(length)||length<.05)return {x:p.team==='A'?1:-1,y:0};
  return {x:x/length,y:y/length};
};
const record=(log,s,type,p,more={})=>log(s,type,{actor:p.id,hero:p.hero,x:p.x,y:p.y,...more});
const withKit=(s,p,r,fn)=>allies(s,p,r).forEach(fn);
function damageNearby(s,p,r,n,hit,fn){
  let affected=0;
  for(const q of enemies(s,p,r)){
    if(hit(s,p,q,n)){affected++;fn?.(q)}
  }
  return affected;
}
function supportHeal(s,p,target,amount,regen,now){
  const harmony=p.hero==='lhen'?clamp(p.effects.kitHarmony||0,0,5):0;
  heal(target,amount*(1+.08*harmony));
  if(regen>0)setBuff(target,'HealRegen',regen*(1+.08*harmony),now+5000+harmony*500,now);
  if(p.hero==='ace')setBuff(target,'Dr',.12,now+4000,now);
  if(p.hero==='lhen')p.effects.kitHarmony=clamp((p.effects.kitHarmony||0)+1,0,5);
}
function pushSafe(s,p,target,dx,dy,amount,skillStep){
  const oldX=target.x,oldY=target.y;
  skillStep(s,target,dx,dy,amount);
  if(target.x===oldX&&target.y===oldY)return false;
  return true;
}
/** A return value is the accepted skill identity; null rejects without consuming resources. */
export function castStarterSkill(s,p,slot,action,ctx){
  const kit=STARTER_HERO_KITS[p.hero];if(!kit||!kit[slot]||!live(p))return null;
  if((p.effects.kitStunUntil||0)>s.elapsed)return null;
  const now=s.elapsed,dir=direction(p,action),{hit,skillStep,log,shieldCap}=ctx;
  const intended=people(s).find(q=>q.id===action.targetId&&live(q));
  const nearFriend=(r)=>intended&&intended.team===p.team&&dist(p,intended)<=r?intended:
    allies(s,p,r).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];
  const nearEnemy=(r)=>intended&&intended.team!==p.team&&dist(p,intended)<=r?intended:
    enemies(s,p,r).sort((a,b)=>dist(p,a)-dist(p,b))[0];
  let accepted=false;
  const areaBuff=(r,name,v,dur)=>withKit(s,p,r,q=>setBuff(q,name,v,now+dur,now));
  switch(kit[slot].id){
    case 'groundbreaker': {
      const center={x:p.x+dir.x*2,y:p.y+dir.y*2};
      for(const q of enemies(s,p,5.5).filter(q=>dist(q,center)<3.5)){
        if(hit(s,p,q,31)){q.effects.kitSlowUntil=now+2000;q.effects.kitSlow=.4;
          q.effects.kitDefDownUntil=now+4000;accepted=true}
      }
      break;
    }
    case 'foundation_wall': {
      const point={x:clamp(p.x+dir.x*4,3,s.w-3),y:clamp(p.y+dir.y*4,3,s.h-3)};
      if((s.heroWalls||[]).filter(w=>w.alive&&w.team===p.team).length>=2)break;
      if(s.cover.some(([x,y,r])=>dist({x,y},point)<r+2.8))break;
      const id='kitwall'+s.nextId++,radius=2.2;
      const wall={id,team:p.team,kind:'kit_wall',x:point.x,y:point.y,hp:45,maxHp:45,
        alive:true,expires:now+5000};
      (s.heroWalls??=[]).push(wall);
      s.cover.push([point.x,point.y,radius,id]); // authoritative collision + projectile cover
      record(log,s,'kit_wall_built',p,{wallId:id,x:point.x,y:point.y});
      accepted=true;break;
    }
    case 'bayanihan_bastion':
      withKit(s,p,8,q=>{shield(q,q.maxHp*.2,shieldCap(q));setBuff(q,'Dr',.3,now+8000,now);
        setBuff(q,'HealRegen',3,now+8000,now)});
      for(const q of enemies(s,p,8))pushSafe(s,p,q,q.x-p.x,q.y-p.y,2.5,skillStep);
      accepted=true;break;
    case 'route_dash':
      accepted=skillStep(s,p,dir.x,dir.y,5.5);
      if(accepted){setBuff(p,'Speed',.3,now+3000,now);record(log,s,'dash',p)}
      break;
    case 'beacon_mark': {
      const q=nearEnemy(11.25);if(!q)break;
      enemies(s,p,14).filter(a=>dist(a,q)<3).forEach(a=>{
        a.effects.kitMarkedUntil=now+5000;a.effects.kitMark=.15;
        a.effects.kitRevealedUntil=now+5000
      });
      accepted=true;break;
    }
    case 'horizon_corridor':
      areaBuff(12.5,'Speed',.5,8000);areaBuff(12.5,'Evade',.15,8000);
      enemies(s,p,23).forEach(q=>{q.effects.kitRevealedUntil=now+8000});
      accepted=true;break;
    case 'signal_shield': {
      const q=nearFriend(8.75);if(!q)break;
      shield(q,q.maxHp*.2,shieldCap(q));accepted=true;break;
    }
    case 'intercept_rush': {
      accepted=skillStep(s,p,dir.x,dir.y,5);
      if(!accepted)break;
      for(const q of enemies(s,p,4)){
        q.effects.kitTauntedUntil=now+2500;q.effects.kitTauntedBy=p.id;
        q.effects.kitTauntPenalty=.3;
        pushSafe(s,p,q,q.x-p.x,q.y-p.y,1.5,skillStep);
      }
      record(log,s,'dash',p);break;
    }
    case 'command_network':
      withKit(s,p,11.25,q=>{cleanse(q);shield(q,q.maxHp*.3,shieldCap(q));
        setBuff(q,'Dr',.35,now+10000,now)});
      accepted=true;break;
    case 'banner_rush':
      accepted=skillStep(s,p,dir.x,dir.y,5.5);
      if(!accepted)break;
      damageNearby(s,p,3.3,28,hit,q=>{if((q.effects.kitControlBlockUntil||0)<=now)q.effects.kitStunUntil=now+600});
      areaBuff(7.5,'Speed',.25,4000);record(log,s,'dash',p);break;
    case 'rally_formation':
      areaBuff(8.75,'Attack',.2,6000);areaBuff(8.75,'Dr',.15,6000);
      areaBuff(8.75,'Resist',.3,6000);accepted=true;break;
    case 'stand_united':
      areaBuff(12.5,'Attack',.35,8000);areaBuff(12.5,'Dr',.25,8000);
      withKit(s,p,12.5,q=>{q.effects.kitControlBlockUntil=now+8000;
        q.effects.kitObjectiveUntil=now+8000;q.effects.kitObjective=.5});
      accepted=true;break;
    case 'resonance_wave': {
      const inWave=q=>{
        const x=q.x-p.x,y=q.y-p.y,along=x*dir.x+y*dir.y;
        return along>=0&&along<=10.5&&Math.abs(x*dir.y-y*dir.x)<=1.8};
      for(const q of people(s).filter(q=>live(q)&&inWave(q))){
        if(q.team===p.team){supportHeal(s,p,q,21,0,now);accepted=true}
        else if(hit(s,p,q,20)){q.effects.kitSlowUntil=now+2500;q.effects.kitSlow=.2;accepted=true}
      }
      break;
    }
    case 'restorative_beat':
      withKit(s,p,6.5,q=>{cleanse(q);setBuff(q,'HealRegen',4.5*(1+.08*clamp(p.effects.kitHarmony||0,0,5)),now+4000,now);
        supportHeal(s,p,q,4,0,now)});
      accepted=true;break;
    case 'symphony_of_buklod':
      withKit(s,p,13.75,q=>{cleanse(q);supportHeal(s,p,q,48,0,now);
        shield(q,q.maxHp*.2,shieldCap(q));
        setBuff(q,'Attack',.15,now+8000,now);setBuff(q,'Speed',.15,now+8000,now)});
      accepted=true;break;
    case 'field_patch': {
      const q=nearFriend(10);if(!q)break;
      supportHeal(s,p,q,28,1.8,now);accepted=true;break;
    }
    case 'knight_step': {
      const q=nearFriend(11.25);if(!q||q===p||dist(q,p)<.25)break;
      accepted=skillStep(s,p,q.x-p.x,q.y-p.y,Math.min(4,dist(q,p)-.2));
      if(accepted){cleanse(q);supportHeal(s,p,q,19,0,now);
        setBuff(q,'Speed',.3,now+3000,now);record(log,s,'dash',p)}
      break;
    }
    case 'checkmate_rescue':
      p.effects.kitTriage={x:p.x,y:p.y,until:now+10000,revives:1};
      withKit(s,p,8.75,q=>shield(q,q.maxHp*.2,shieldCap(q)));
      accepted=true;break;
  }
  return accepted?{id:kit[slot].id,passive:kit.passive}:null;
}
export function starterAttack(hero){return STARTER_HERO_KITS[hero]?.basic||null}
export function starterSkillCooldown(hero,slot){return STARTER_HERO_KITS[hero]?.[slot]?.cd||null}
export function starterCanAct(s,p){return (p.effects.kitStunUntil||0)<=s.elapsed}
export function starterMoveFactor(s,p){
  const e=p.effects;const speed=e.kitSpeedUntil>s.elapsed?e.kitSpeed||0:0;
  const slow=e.kitSlowUntil>s.elapsed?e.kitSlow||0:0;
  return clamp((STARTER_HERO_KITS[p.hero]?.speed||210)/210*(1+speed)*(1-slow),.45,1.6);
}
export function starterHitModifiers(s,attacker,target,amount){
  let multiplier=1;
  const atk=attacker.effects,def=target.effects||{};
  if(atk.kitAttackUntil>s.elapsed)multiplier*=1+clamp(atk.kitAttack,0,.35);
  if(atk.kitTauntedUntil>s.elapsed&&atk.kitTauntedBy!==target.id)multiplier*=.7;
  if(def.kitMarkedUntil>s.elapsed)multiplier*=1+clamp(def.kitMark,0,.15);
  if(def.kitDefDownUntil>s.elapsed)multiplier*=1.1;
  const reduction=(def.kitDrUntil>s.elapsed?clamp(def.kitDr,0,.75):0);
  const extra=target.hero==='phan'?Math.min(.2,(def.kitResolve||0)*.04):0;
  multiplier*=1-clamp(reduction+extra,0,.75);
  return Math.max(0,amount*multiplier);
}
export function starterEvades(s,target){
  const e=target.effects||{},rate=e.kitEvadeUntil>s.elapsed?clamp(e.kitEvade,0,.3):0;
  if(!rate)return false;
  e.kitEvadeAccumulator=(e.kitEvadeAccumulator||0)+rate;
  if(e.kitEvadeAccumulator<1)return false;
  e.kitEvadeAccumulator-=1;return true;
}
export function starterAfterDamage(s,attacker,target,log){
  if(attacker.hero==='quin'&&(attacker.effects.kitTrailNext||0)<=s.elapsed){
    target.effects??={};target.effects.kitRevealedUntil=s.elapsed+6000;
    attacker.effects.kitTrailNext=s.elapsed+8000;
    record(log,s,'kit_reveal',attacker,{target:target.id});
  }
}
/** Called once per canonical 100ms simulation tick, including offscreen CPU. */
export function tickStarterKits(s,stepMs,log){
  const delta=stepMs/1000,now=s.elapsed;
  if(s.heroWalls?.length){
    for(const w of s.heroWalls)if(w.alive&&w.expires<=now)w.alive=false;
    const active=new Set(s.heroWalls.filter(w=>w.alive&&w.hp>0).map(w=>w.id));
    s.cover=s.cover.filter(c=>!c[3]||active.has(c[3]));
    s.heroWalls=s.heroWalls.filter(w=>w.alive&&w.hp>0);
  }
  for(const p of people(s)){
    const e=p.effects;if(!live(p))continue;
    if(e.kitHealRegenUntil>now)heal(p,e.kitHealRegen*delta);
    if(p.hero==='phan'){
      const obj=[...s.towers,...s.buildings].some(q=>q.team===p.team&&live(q)&&dist(q,p)<=6.25);
      if(obj&&now-(e.kitResolveAt||0)>=1000){e.kitResolve=clamp((e.kitResolve||0)+1,0,5);e.kitResolveAt=now}
      else if(!obj&&now-(e.kitResolveAt||0)>=3000){e.kitResolve=Math.max(0,(e.kitResolve||0)-1);e.kitResolveAt=now}
      heal(p,(e.kitResolve||0)*.1*delta);
    }
    if(p.hero==='van'){
      const friends=allies(s,p,7.5).filter(q=>q!==p);
      if(friends.length){setBuff(p,'Dr',.12,now+150,now);heal(p,.4*delta);
        friends.forEach(q=>{setBuff(q,'Dr',.12,now+150,now);heal(q,.4*delta)})}
    }
    if(p.hero==='christian')withKit(s,p,8.75,q=>heal(q,q.maxHp*.01*delta));
    if(p.hero==='lhen'&&allies(s,p,7.5).some(q=>q!==p)&&now-(e.kitHarmonyAt||0)>=2000){
      e.kitHarmony=Math.min(5,(e.kitHarmony||0)+1);e.kitHarmonyAt=now
    }
    if(p.hero==='ace'&&e.kitTriage&&e.kitTriage.until>now){
      for(const q of people(s).filter(q=>q.team===p.team&&dist(q,e.kitTriage)<8.75)){
        if(live(q)){heal(q,4*delta);continue}
        if(e.kitTriage.revives>0&&s.huntStarted===null){
          e.kitTriage.revives--;q.alive=true;q.hp=q.maxHp*.5;q.respawnAt=0;q.shield=0;
          record(log,s,'kit_revival',p,{target:q.id,x:q.x,y:q.y});
        }
      }
    }
  }
}
