/** Genesis Empire Arena lane minions. Deterministic, match-local and economy-free.
 * The caller owns the clock, actors and event stream. Never call this from a client
 * ranked settlement path: run identical logic on the authoritative match server.
 */
export const MINION_CLASSES = Object.freeze({
  vanguard: Object.freeze({hp:128,damage:12,range:2.8,cooldown:1500,speed:3.0,armor:0.16}),
  ranger: Object.freeze({hp:76,damage:11,range:10,cooldown:1750,speed:3.4,armor:0}),
  mender: Object.freeze({hp:86,damage:5,range:7,cooldown:1900,speed:3.2,heal:14,healCooldown:2400,armor:0}),
  siege_breaker: Object.freeze({hp:210,damage:8,structureDamage:29,range:3.4,cooldown:2700,speed:2.2,armor:0.08}),
});
export const MINION_WAVE_INTERVAL_MS=24000;
export const MINION_LIMIT_PER_TEAM=42;
const sides=['A','B'];
const enemy=t=>t==='A'?'B':'A';
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const alive=x=>x && x.alive!==false && x.hp>0;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const waveKinds=(wave)=>wave%3===0?['vanguard','ranger','mender','siege_breaker']:['vanguard','ranger','mender'];
const laneY=(s,lane)=>s.h*(s.map?.lanes?.[lane] ?? [0.23,0.5,0.77][lane]);
const baseX=(s,team)=>team==='A'?20:s.w-20;
function logEvent(s,emit,type,extra){if(emit)emit(s,type,extra)}

export function enableMinionWaves(s,{firstWaveMs=8000,intervalMs=MINION_WAVE_INTERVAL_MS,maxPerTeam=MINION_LIMIT_PER_TEAM}={}){
  if(!s || !Number.isFinite(s.elapsed) || !Number.isFinite(s.w) || !Number.isFinite(s.h))throw Error('Invalid match');
  if(!Number.isFinite(intervalMs)||intervalMs<5000||intervalMs>120000)throw Error('Invalid wave interval');
  if(!Number.isInteger(maxPerTeam)||maxPerTeam<12||maxPerTeam>96)throw Error('Invalid minion cap');
  if(!Number.isFinite(firstWaveMs)||firstWaveMs<0)throw Error('Invalid first wave');
  s.minions=[];
  s.minionWaves={enabled:true,wave:0,nextAt:s.elapsed+firstWaveMs,intervalMs,maxPerTeam};
  return s;
}
function spawnWave(s,emit){
  const manager=s.minionWaves;
  manager.wave+=1;
  for(const team of sides){
    let slots=manager.maxPerTeam-s.minions.filter(m=>alive(m)&&m.team===team).length;
    for(let lane=0;lane<3 && slots>0;lane++)for(const [i,kind] of waveKinds(manager.wave).entries()){
      if(slots<=0)break;
      const cfg=MINION_CLASSES[kind],unit={id:'minion-'+s.nextId++,team,lane,kind,
        x:baseX(s,team)+(team==='A'?-i*.9:i*.9),y:laneY(s,lane)+(i-1.5)*.65,
        hp:cfg.hp,maxHp:cfg.hp,shield:0,alive:true,attackAt:-1e9,healAt:-1e9,
        createdAt:s.elapsed,deathAt:null,lastDamage:-1e9};
      s.minions.push(unit);slots--;
    }
  }
  logEvent(s,emit,'minion_wave',{wave:manager.wave,at:s.elapsed,units:s.minions.filter(alive).length});
}
function finishTarget(s,source,target,emit){
  if(target.hp>0)return;
  target.hp=0;target.alive=false;target.deathAt=s.elapsed;
  if(s.players?.[target.id]){target.deaths=(target.deaths||0)+1;target.respawnAt=s.elapsed+7500;}
  if(s.towers?.includes(target))logEvent(s,emit,'tower_destroyed',{team:target.team,tower:target.id,x:target.x,y:target.y});
  logEvent(s,emit,'minion_ko',{actor:source.id,to:target.id,team:target.team,x:target.x,y:target.y});
}
function strike(s,source,target,damage,emit,structure=false){
  const armor=target.kind&&MINION_CLASSES[target.kind]?(MINION_CLASSES[target.kind].armor||0):0;
  let remaining=Math.max(1,Math.round(damage*(1-armor)));
  if(target.shield>0){const shield=Math.min(target.shield,remaining);target.shield-=shield;remaining-=shield;}
  if(remaining>0)target.hp=Math.max(0,target.hp-remaining);
  target.lastDamage=s.elapsed;source.attackAt=s.elapsed;
  logEvent(s,emit,structure?'minion_siege_hit':'minion_hit',{
    from:source.id,to:target.id,amount:remaining,team:source.team,x:target.x,y:target.y,kind:source.kind,
  });
  finishTarget(s,source,target,emit);
}
function move(s,m,target,stepMs){
  const cfg=MINION_CLASSES[m.kind];let dx=target.x-m.x,dy=target.y-m.y;
  const mag=Math.hypot(dx,dy);if(mag<.001)return;
  const step=Math.min(mag,cfg.speed*stepMs/1000);dx=dx/mag*step;dy=dy/mag*step;
  let nx=clamp(m.x+dx,2,s.w-2),ny=clamp(m.y+dy,2,s.h-2);
  const blocked=(x,y)=>(s.cover||[]).some(([cx,cy,r])=>Math.hypot(x-cx,y-cy)<r+1);
  if(blocked(nx,ny)){
    const direction=(m.lane%2===0)?1:-1;
    const detours=[direction*step,-direction*step];
    const free=detours.find(shift=>!blocked(nx,clamp(ny+shift,2,s.h-2)));
    if(free===undefined)return;
    ny=clamp(ny+free,2,s.h-2);
  }
  m.x=nx;m.y=ny;
}
function findEnemy(s,m){
  const actors=[...(s.minions||[]),...(s.units||[]),...Object.values(s.players||{})]
    .filter(a=>a!==m && a.team===enemy(m.team) && alive(a) &&
      Math.abs(a.y-laneY(s,m.lane))<=11 && dist(a,m)<=Math.max(13,MINION_CLASSES[m.kind].range+5));
  actors.sort((a,b)=>{
    const priority=x=>x.id?.startsWith('minion-')?0:x.hero?2:1;
    return priority(a)-priority(b)||dist(a,m)-dist(b,m)||String(a.id).localeCompare(String(b.id));
  });
  return actors[0];
}
function findTower(s,m){
  const towers=(s.towers||[]).filter(t=>t.team===enemy(m.team) && t.lane===m.lane && alive(t));
  towers.sort((a,b)=>dist(a,m)-dist(b,m));return towers[0]||null;
}
function healAlly(s,m,emit){
  const cfg=MINION_CLASSES[m.kind];if(!cfg.heal || s.elapsed-m.healAt<cfg.healCooldown)return false;
  const injured=(s.minions||[]).filter(x=>x.team===m.team&&alive(x)&&x.id!==m.id&&
      x.hp<x.maxHp*.86 && dist(m,x)<8);
  injured.sort((a,b)=>(a.hp/a.maxHp)-(b.hp/b.maxHp)||String(a.id).localeCompare(String(b.id)));
  const mate=injured[0];if(!mate)return false;
  const amount=Math.min(cfg.heal,mate.maxHp-mate.hp);mate.hp+=amount;mate.shield=Math.min(18,(mate.shield||0)+4);
  m.healAt=s.elapsed;
  logEvent(s,emit,'minion_heal',{from:m.id,to:mate.id,amount,team:m.team,x:mate.x,y:mate.y});
  return true;
}
function siegeSeal(s,m,emit){
  const opposing=enemy(m.team),seal=s.seals?.[opposing];if(!seal||seal.breached)return false;
  // A living tower in the lane protects the seal against direct minion siege.
  if((s.towers||[]).some(t=>t.team===opposing&&t.lane===m.lane&&alive(t)))return false;
  const position={x:opposing==='A'?14:s.w-14,y:s.h/2};
  if(dist(m,position)>Math.max(6,MINION_CLASSES[m.kind].range)){move(s,m,position,500);return true;}
  const cfg=MINION_CLASSES[m.kind];if(s.elapsed-m.attackAt<cfg.cooldown)return true;
  m.attackAt=s.elapsed;seal.hp=Math.max(0,seal.hp-cfg.structureDamage);
  seal.lastDamage=s.elapsed;
  logEvent(s,emit,'minion_siege_hit',{from:m.id,to:opposing+'-seal',amount:cfg.structureDamage,team:m.team,x:position.x,y:position.y});
  if(seal.hp===0){seal.breached=true;if(s.huntStarted===null){s.huntStarted=s.elapsed;s.phase='hunt';logEvent(s,emit,'final_hunt',{reason:'minion_siege_breach'});}logEvent(s,emit,'seal_breached',{team:opposing});}
  return true;
}
/** Runs once per 500ms simulation slice. Caller owns authoritative clock.
 * Optional for offline practice, intentionally disabled in offline solo duel.
 */
export function tickMinionWaves(s,emit,stepMs=500){
  const mgr=s?.minionWaves;
  if(!mgr?.enabled||s.status!=='active')return s;
  if(stepMs<=0||stepMs>1000||!Number.isFinite(stepMs))throw Error('Invalid minion tick');
  if(s.elapsed>=mgr.nextAt){spawnWave(s,emit);mgr.nextAt=s.elapsed+mgr.intervalMs;}
  for(const m of s.minions){
    if(!alive(m))continue;
    const cfg=MINION_CLASSES[m.kind];
    if(healAlly(s,m,emit))continue;
    const target=findEnemy(s,m);
    if(target){
      if(dist(m,target)<=cfg.range){if(s.elapsed-m.attackAt>=cfg.cooldown)strike(s,m,target,cfg.damage,emit);}
      else move(s,m,target,stepMs);
      continue;
    }
    const tower=findTower(s,m);
    if(tower){
      if(dist(m,tower)<=cfg.range+1){if(s.elapsed-m.attackAt>=cfg.cooldown)strike(s,m,tower,cfg.structureDamage??cfg.damage,emit,true);}
      else move(s,m,tower,stepMs);
      continue;
    }
    if(m.kind==='siege_breaker' && siegeSeal(s,m,emit))continue;
    const opposing=enemy(m.team);const advance={x:opposing==='A'?14:s.w-14,y:laneY(s,m.lane)};
    if(dist(m,advance)>2)move(s,m,advance,stepMs);
  }
  // Tombstones last long enough for one death animation, including hero/tower kills.
  for(const m of s.minions)if(!alive(m)&&m.deathAt==null)m.deathAt=m.lastDamage??s.elapsed;
  s.minions=s.minions.filter(m=>alive(m)||s.elapsed-m.deathAt<900);
  return s;
}
