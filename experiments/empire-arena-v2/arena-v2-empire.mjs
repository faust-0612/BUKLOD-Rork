/** Arena RTS construction and fortress-recovery domain. Pure practice transitions:
 * no database, no wallets. A trusted server must re-authorize commands in PvP.
 */
export const BUILD_COSTS=Object.freeze({
 barracks:{wood:110,gold:55,stone:40,time:18000,hp:340},
 depot:{wood:90,gold:25,stone:35,time:15000,hp:280},
 workshop:{wood:120,gold:80,stone:80,time:22000,hp:360},
 watchtower:{wood:100,gold:60,stone:120,time:24000,hp:340},
 seal_restore:{wood:130,gold:100,stone:170,time:28000,hp:440}
});
export const REBUILD_CAP=1;
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const isAlive=o=>Boolean(o&&o.alive!==false&&o.hp>0);
const teamFunds=(team,cost)=>['wood','gold','stone'].every(k=>team.resources[k]>=(cost[k]||0));
const withdraw=(team,cost)=>{if(!teamFunds(team,cost))return false;for(const k of ['wood','gold','stone'])team.resources[k]-=cost[k]||0;return true};
export const baseSite=(s,team)=>({x:team==='A'?14:s.w-14,y:s.h/2});
export function operational(s,team,kind){return s.buildings.some(b=>b.team===team&&b.kind===kind&&b.status==='operational'&&isAlive(b))}
export function initializeBuildings(s){s.buildings=[];s.nextBuildId=1;for(const team of ['A','B']){
  const site=baseSite(s,team),direction=team==='A'?1:-1;
  for(const [kind,offset] of [['barracks',6],['depot',13]]){
   const cfg=BUILD_COSTS[kind];s.buildings.push({id:`${team}-${kind}-starter`,team,kind,x:site.x+direction*offset,y:site.y+(kind==='barracks'?-8:8),status:'operational',stage:'complete',progress:1,buildMs:0,duration:0,hp:cfg.hp,maxHp:cfg.hp,alive:true,lastDamage:-1e8,starter:true});
  }
  s.teams[team].rebuildCount=0;s.teams[team].rebuildJob=null;
 }}
function friendlyBuilder(s,team,site){return [...Object.values(s.players),...s.units.filter(x=>x.kind==='villager')].some(x=>x.team===team&&isAlive(x)&&dist(x,site)<=9)}
function nearbyEnemy(s,team,site){return [...Object.values(s.players),...s.units].some(x=>x.team!==team&&isAlive(x)&&dist(x,site)<10)}
function constructionStage(progress){return progress<.34?'foundation':progress<.76?'frame':'finishing'}
export function beginBuild(s,p,kind,x,y,log){
 const cfg=BUILD_COSTS[kind],team=s.teams[p.team];if(!cfg||kind==='seal_restore')return false;
 const site=baseSite(s,p.team);if(!Number.isFinite(x)||!Number.isFinite(y)||dist(p,{x,y})>10||dist(site,{x,y})>48||x<4||x>s.w-4||y<4||y>s.h-4)return false;
 if(s.buildings.some(b=>b.alive&&dist(b,{x,y})<6)||s.towers.some(t=>t.alive&&dist(t,{x,y})<6))return false;
 if(s.buildings.filter(b=>b.team===p.team&&b.kind===kind&&b.alive).length>= (kind==='watchtower'?4:2))return false;
 if(s.buildings.filter(b=>b.team===p.team&&b.status==='building').length>=2)return false;
 if(!withdraw(team,cfg))return false;
 const aided=team.constructionSupportRemaining>0;if(aided)team.constructionSupportRemaining--;
 const duration=aided?Math.ceil(cfg.time*.92):cfg.time;
 const id=`build-${s.nextBuildId++}`;s.buildings.push({id,team:p.team,kind,x,y,status:'building',stage:'foundation',progress:0,buildMs:0,duration,hp:Math.ceil(cfg.hp*.25),maxHp:cfg.hp,alive:true,lastDamage:-1e8,starter:false});
 log(s,'construction_start',{actor:p.id,team:p.team,id,kind});return true;
}
export function beginSealRebuild(s,p,log){
 const team=s.teams[p.team],seal=s.seals[p.team],site=baseSite(s,p.team),cfg=BUILD_COSTS.seal_restore;
 if(!seal.breached||s.huntStarted===null||s.hardLock||team.rebuildCount>=REBUILD_CAP||team.rebuildJob||dist(p,site)>11)return false;
 if(!friendlyBuilder(s,p.team,site)||nearbyEnemy(s,p.team,site)||s.elapsed-(seal.lastDamage??-1e8)<9000)return false;
 if(!withdraw(team,cfg))return false;
 team.rebuildJob={team:p.team,kind:'seal_restore',x:site.x,y:site.y,id:`seal-rebuild-${p.team}-${team.rebuildCount+1}`,status:'building',stage:'foundation',progress:0,buildMs:0,duration:cfg.time,lastDamage:s.elapsed};
 log(s,'rebuild_start',{team:p.team,actor:p.id,needed:cfg.time});return true;
}
export function processEmpireBuilds(s,log,onWatchtower,onRestored){
 for(const b of s.buildings){if(!b.alive||b.status!=='building')continue;
  if(nearbyEnemy(s,b.team,b)||s.elapsed-b.lastDamage<3200||!friendlyBuilder(s,b.team,b))continue;
  b.buildMs=Math.min(b.duration,b.buildMs+500);b.progress=Math.min(1,b.buildMs/b.duration);b.stage=constructionStage(b.progress);b.hp=Math.min(b.maxHp,b.hp+1.2);
  if(b.progress===1){b.status='operational';b.stage='complete';b.hp=b.maxHp;log(s,'construction_complete',{team:b.team,kind:b.kind,id:b.id});if(b.kind==='watchtower')onWatchtower(b)}
 }
 for(const team of ['A','B']){const t=s.teams[team],b=t.rebuildJob;if(!b||b.status!=='building')continue;
  // Never permit reconstruction after hard overtime, by ghost builders, or under attack.
  if(s.hardLock||s.huntStarted===null){t.rebuildJob=null;continue}
  if(!s.seals[team].breached){t.rebuildJob=null;continue}
  if(!friendlyBuilder(s,team,b)||nearbyEnemy(s,team,b)||s.elapsed-(s.seals[team].lastDamage??-1e8)<9000)continue;
  b.buildMs=Math.min(b.duration,b.buildMs+500);b.progress=Math.min(1,b.buildMs/b.duration);b.stage=constructionStage(b.progress);
  if(b.progress===1){t.rebuildCount++;t.rebuildJob=null;const seal=s.seals[team];seal.breached=false;seal.hp=Math.min(seal.maxHp,BUILD_COSTS.seal_restore.hp);seal.lastDamage=-1e8;
   log(s,'seal_restored',{team,remainingHp:seal.hp,rebuildCount:t.rebuildCount});onRestored(team)}
 }
 for(const t of s.towers){if(!t.alive||!t.upgrading)continue;
  if(nearbyEnemy(s,t.team,t)||s.elapsed-t.lastDamage<3200||!friendlyBuilder(s,t.team,t))continue;
  const u=t.upgrading;u.ms=Math.min(u.duration,u.ms+500);u.progress=u.ms/u.duration;u.stage=constructionStage(u.progress);
  if(u.progress===1){t.level++;t.maxHp+=110;t.hp=Math.min(t.maxHp,t.hp+140);t.structureXp=Math.max(0,t.structureXp-u.requiredXp);t.upgrading=null;log(s,'tower_upgrade',{team:t.team,tower:t.id,level:t.level,x:t.x,y:t.y})}
 }
}