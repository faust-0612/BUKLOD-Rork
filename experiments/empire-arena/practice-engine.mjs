/* BUKLOD Empire Arena — offline PRACTICE simulation. No account, network, ledgers,
 * rewards, ranked results or claims of server authority. World rules mirror the
 * V1 headless Arena contract, while all online effects remain disabled. */
export const TICK_MS=50;
export const HEROES={
 phan:{role:'architect',kind:'supply',hp:112,range:4.3},quin:{role:'scout',kind:'blink',hp:90,range:6},
 van:{role:'support',kind:'heal',hp:104,range:5},christian:{role:'commander',kind:'guard',hp:112,range:4.8},
 lhen:{role:'tempo',kind:'supply',hp:100,range:5.1},jawo:{role:'skirmisher',kind:'blink',hp:96,range:5.3},
 trudice:{role:'illusionist',kind:'disrupt',hp:95,range:5.5},ace:{role:'vanguard',kind:'burst',hp:120,range:3.6},
 mitch:{role:'terrain',kind:'guard',hp:108,range:4.4},niel:{role:'signal',kind:'disrupt',hp:98,range:5.7},
 angel:{role:'medic',kind:'heal',hp:106,range:4.8},vhen:{role:'growth',kind:'heal',hp:102,range:4.5},
 ellusur:{role:'rift',kind:'burst',hp:92,range:6.1}
};
export const MAPS={
 genesis_rift:{name:'Genesis Rift',width:40,height:24,cover:[[14,7,2],[26,17,2]],relays:[[20,4],[20,12],[20,20],[30,12]]},
 aurora_foundry:{name:'Aurora Foundry',width:44,height:26,cover:[[15,13,2],[29,13,2]],relays:[[22,4],[22,13],[22,22],[32,13]]},
 verdant_fracture:{name:'Verdant Fracture',width:38,height:24,cover:[[12,8,1.7],[26,16,1.7]],relays:[[19,5],[19,12],[19,19],[28,12]]}
};
export const MODES={duel:{n:1,duration:180000,core:0},cluster:{n:3,duration:330000,core:1000},grand:{n:5,duration:540000,core:1600}};
const clamp=(v,a,b)=>Number.isFinite(v)?Math.max(a,Math.min(b,v)):a;
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const enemyTeam=t=>t==='A'?'B':'A';
export function validMapPosition(map,x,y){return x>.7&&y>.7&&x<map.width-.7&&y<map.height-.7&&map.cover.every(([a,b,r])=>Math.hypot(a-x,b-y)>r+.7)};
export function lineBlocked(map,a,b){return map.cover.some(([x,y,r])=>{const dx=b.x-a.x,dy=b.y-a.y,d=dx*dx+dy*dy;const t=d?clamp(((x-a.x)*dx+(y-a.y)*dy)/d,0,1):0;return Math.hypot(a.x+t*dx-x,a.y+t*dy-y)<r+.2})}
export function connectedRelays(s,team){
 const map=MAPS[s.mapId],anchor={x:team==='A'?8:map.width-8,y:map.height/2};
 const nodes=[...s.relays.filter(x=>x.owner===team).map(x=>({...x,relay:true})),...s.buildings.filter(x=>x.team===team&&x.kind==='bridge').map(x=>({...x,relay:false}))];
 const reached=new Set(),frontier=[anchor];
 while(frontier.length){const from=frontier.shift();nodes.forEach((node,i)=>{if(!reached.has(i)&&dist(from,node)<=14){reached.add(i);frontier.push(node)}})}
 return nodes.filter((n,i)=>n.relay&&reached.has(i)).length;
}
export function createPractice({mode='cluster',mapId='genesis_rift',hero='phan',level=7}={}){
 if(!MODES[mode]||!MAPS[mapId]||!HEROES[hero])throw Error('Invalid match configuration');
 const m=MAPS[mapId],c=MODES[mode],roster={};let k=0;
 const allies=['angel','christian','vhen','lhen'];const rivals=['ace','quin','trudice','niel','mitch'];
 for(const team of ['A','B'])for(let i=0;i<c.n;i++){
  const id=team+'-'+i,ch=team==='A'?(i===0?hero:allies[(i-1)%allies.length]):rivals[i%rivals.length],h=HEROES[ch];
  const x=team==='A'?5:m.width-5,y=m.height/2+(i-(c.n-1)/2)*2.3;
  const lv=team==='A'&&i===0?clamp(Math.floor(level),1,20):5;
  const maxHp=Math.round(h.hp*(1+0.006*(lv-1)));
  roster[id]={id,team,characterId:ch,level:lv,x,y,spawn:{x,y},hp:maxHp,maxHp,shield:0,kills:0,deaths:0,damage:0,contributions:0,alive:true,respawnAt:0,seq:0,attackAt:-1e6,cooldowns:{primary:-1e6,secondary:-1e6,ultimate:-1e6,link:-1e6,build:-1e6,formation:-1e6},linkUntil:0,lastCommandAt:0};k++;
 }
 return {id:'offline-practice',status:'active',ranked:false,mode,mapId,tick:0,elapsedMs:0,overtime:false,result:null,players:roster,
  relays:mode==='duel'?[]:m.relays.slice(0,mode==='grand'?4:3).map(([x,y],i)=>({id:'relay'+i,x,y,progress:0,owner:null})),
  teams:{A:{coreHp:c.core,flux:40,kills:0,holdMs:0,formation:null},B:{coreHp:c.core,flux:40,kills:0,holdMs:0,formation:null}},
  buildings:[],events:[],eventSeq:0};
}
function ev(s,type,info={}){s.events.push({serial:++s.eventSeq,tick:s.tick,type,...info});if(s.events.length>40)s.events.shift()}
function finish(s,team,reason){if(s.status!=='active')return;s.status=team?'finished':'void';s.result={winner:team,loser:team?enemyTeam(team):null,reason};ev(s,'result',{team})}
function dealt(s,from,to,base){if(!to.alive||from.team===to.team)return;
 const boost=s.teams[from.team].formation;let amount=base*(boost?.stance==='surge'&&boost.until>s.elapsedMs?1.08:1);
 const shield=Math.min(to.shield,amount);to.shield-=shield;amount-=shield;
 const guard=s.teams[to.team].formation;amount*=guard?.stance==='guard'&&guard.until>s.elapsedMs?.85:1;
 to.hp=Math.max(0,to.hp-amount);from.damage+=amount;
 if(to.hp<=0){to.alive=false;to.deaths++;from.kills++;to.respawnAt=s.elapsedMs+ (s.mode==='grand'?7500:6000);s.teams[from.team].kills++;ev(s,'knockout',{from:from.id,to:to.id,team:from.team});if(s.mode==='duel'&&s.teams[from.team].kills>=2)finish(s,from.team,'duel_best_of_three')}
}
function command(s,p,c){const map=MAPS[s.mapId],my=s.teams[p.team],enemy=enemyTeam(p.team),hero=HEROES[p.characterId];
 if(c.type==='move'){
  const mag=Math.hypot(c.dx,c.dy);if(!Number.isFinite(mag)||mag<.05||mag>1.5)return;
  const v=4.6*(1+.003*(p.level-1))*.05,x=p.x+c.dx/Math.max(mag,1)*v,y=p.y+c.dy/Math.max(mag,1)*v;
  if(validMapPosition(map,x,y)||s.buildings.some(b=>b.kind==='bridge'&&b.team===p.team&&dist({x,y},b)<3.5)) {p.x=x;p.y=y;}
 }else if(c.type==='capture')p.capturing=true;
 else if(c.type==='attack'){
  if(s.elapsedMs-p.attackAt<600)return;
  if(c.target==='core'&&s.mode!=='duel'){
   const core={x:enemy==='A'?3:map.width-3,y:map.height/2};if(dist(p,core)>4.5||connectedRelays(s,p.team)<2)return;
   const shield=s.buildings.some(b=>b.kind==='barrier'&&b.team===enemy&&dist(b,core)<6);
   let d=16*(1+.006*(p.level-1))*(shield?.55:1);s.teams[enemy].coreHp=Math.max(0,s.teams[enemy].coreHp-d);
   p.damage+=d;p.contributions++;p.attackAt=s.elapsedMs;ev(s,'core_attack',{team:p.team});
   if(!s.teams[enemy].coreHp)finish(s,p.team,'enemy_origin_destroyed');
  }else{const q=s.players[c.target];if(!q||q.team===p.team||!q.alive||dist(p,q)>hero.range||lineBlocked(map,p,q))return;
   p.attackAt=s.elapsedMs;p.contributions++;dealt(s,p,q,18*(1+.006*(p.level-1)));ev(s,'hit',{team:p.team});}
 }else if(c.type==='skill'){
  if(!['primary','secondary','ultimate'].includes(c.slot)||c.slot==='secondary'&&p.level<3||c.slot==='ultimate'&&p.level<6)return;
  const cd={primary:5000,secondary:7500,ultimate:45000}[c.slot];if(s.elapsedMs-p.cooldowns[c.slot]<cd)return;
  const q=s.players[c.target];
  if(c.slot==='secondary'||(c.slot==='primary'&&hero.kind==='blink')){
   let mag=Math.hypot(c.dx,c.dy);if(!Number.isFinite(mag)||mag<.1)return;
   const boost=c.slot==='secondary'?3:4,x=p.x+c.dx/mag*boost,y=p.y+c.dy/mag*boost;
   if(!validMapPosition(map,x,y))return;p.x=x;p.y=y;
  }else if(c.slot==='ultimate'){
   if(my.flux<30||!q||q.team===p.team||!q.alive||dist(p,q)>6||lineBlocked(map,p,q))return;
   my.flux-=30;dealt(s,p,q,55*(1+.006*(p.level-1)));
  }else if(hero.kind==='heal'||hero.kind==='guard'){
   const ally=q?.team===p.team&&q.alive?q:p;if(dist(p,ally)>6)return;
   if(hero.kind==='heal')ally.hp=Math.min(ally.maxHp,ally.hp+32);else ally.shield=Math.min(60,ally.shield+32);
  }else if(hero.kind==='supply')my.flux=Math.min(120,my.flux+12);
  else if(hero.kind==='burst'){
   if(!q||q.team===p.team||!q.alive||dist(p,q)>5.5||lineBlocked(map,p,q))return;dealt(s,p,q,32*(1+.006*(p.level-1)));
  }else if(hero.kind==='disrupt'){
   const r=s.relays.find(x=>x.id===c.relayId);if(!r||dist(p,r)>5.5||r.owner===p.team)return;
   r.progress=clamp(r.progress+(p.team==='A'?30:-30),-100,100);r.owner=Math.abs(r.progress)===100?(r.progress>0?'A':'B'):null;
  }else return;
  p.cooldowns[c.slot]=s.elapsedMs;p.contributions++;ev(s,'skill',{team:p.team,slot:c.slot});
 }else if(c.type==='link'){
  const q=s.players[c.partnerId];if(!q||q.team!==p.team||q.id===p.id||!q.alive||dist(p,q)>5||lineBlocked(map,p,q)||s.elapsedMs-p.cooldowns.link<20000||my.flux<15)return;
  my.flux-=15;p.shield=Math.min(60,p.shield+24);q.shield=Math.min(60,q.shield+24);
  p.linkUntil=q.linkUntil=s.elapsedMs+5000;p.cooldowns.link=s.elapsedMs;p.contributions++;ev(s,'link',{team:p.team});
 }else if(c.type==='formation'){
  if(!['guard','surge'].includes(c.stance)||my.flux<12||s.elapsedMs-p.cooldowns.formation<25000)return;
  if(!Object.values(s.players).some(q=>q.team===p.team&&q.id!==p.id&&q.alive&&dist(p,q)<=5))return;
  my.flux-=12;my.formation={stance:c.stance,until:s.elapsedMs+8000};p.cooldowns.formation=s.elapsedMs;p.contributions++;ev(s,'formation',{team:p.team,stance:c.stance});
 }else if(c.type==='build'){
  const cost={barrier:25,healing:30,bridge:20}[c.kind];if(!cost||s.elapsedMs-p.cooldowns.build<8000||!validMapPosition(map,c.x,c.y)||dist(p,c)>4.5||!s.relays.some(r=>r.owner===p.team&&dist(r,c)<6)||s.buildings.filter(b=>b.team===p.team).length>=3)return;
  const price=p.characterId==='phan'?Math.ceil(cost*.8):cost;if(my.flux<price)return;
  my.flux-=price;s.buildings.push({team:p.team,kind:c.kind,x:c.x,y:c.y,expires:s.elapsedMs+45000});p.cooldowns.build=s.elapsedMs;p.contributions++;ev(s,'build',{team:p.team,kind:c.kind});
 }
}
export function tickPractice(s,commands=[]){
 if(s.status!=='active')return s;
 if(!Array.isArray(commands)||commands.length>40)throw Error('Too many commands');
 s.tick++;s.elapsedMs+=TICK_MS;
 for(const p of Object.values(s.players)){p.capturing=false;if(!p.alive&&s.elapsedMs>=p.respawnAt){p.alive=true;p.hp=p.maxHp;p.shield=0;p.x=p.spawn.x;p.y=p.spawn.y;}}
 const actorCounts=new Map();
 for(const c of commands){const p=s.players[c?.actorId];if(!p||!p.alive||!Number.isSafeInteger(c.seq)||c.seq<=p.seq)continue;
  const count=(actorCounts.get(p.id)||0)+1;actorCounts.set(p.id,count);if(count>3)continue;
  p.seq=c.seq;p.lastCommandAt=s.elapsedMs;command(s,p,c);if(s.status!=='active')return s;
 }
 for(const r of s.relays){const near=Object.values(s.players).filter(p=>p.alive&&p.capturing&&dist(p,r)<=2.8);
  const a=near.filter(p=>p.team==='A').length,b=near.length-a;if((!a&&!b)||(a&&b))continue;
  const linked=near.filter(p=>p.linkUntil>s.elapsedMs).length>=2;
  r.progress=clamp(r.progress+(a?1:-1)*1.25*Math.min(2,Math.max(a,b))*(linked?1.5:1),-100,100);
  const old=r.owner;r.owner=r.progress===100?'A':r.progress===-100?'B':null;
  if(r.owner&&r.owner!==old)ev(s,'relay_capture',{team:r.owner,relayId:r.id});
 }
 s.buildings=s.buildings.filter(x=>x.expires>s.elapsedMs);
 for(const t of ['A','B']){const mine=s.teams[t],enemy=enemyTeam(t),owned=connectedRelays(s,t);
  mine.flux=Math.min(120,mine.flux+owned*.02);
  if(owned>=2&&s.mode!=='duel')s.teams[enemy].coreHp=Math.max(0,s.teams[enemy].coreHp-(s.overtime?.35:.1));
  mine.holdMs=owned>=3&&owned===s.relays.length?mine.holdMs+50:0;
  if(mine.holdMs>=12000)finish(s,t,'three_relay_network_lock');
  if(s.mode!=='duel'&&s.teams[enemy].coreHp<=0)finish(s,t,'relay_core_pressure');
 }
 for(const b of s.buildings)if(b.kind==='healing')for(const p of Object.values(s.players))if(p.alive&&p.team===b.team&&dist(p,b)<3)p.hp=Math.min(p.maxHp,p.hp+.2);
 if(s.status!=='active')return s;
 const cfg=MODES[s.mode];if(s.elapsedMs>=cfg.duration){
  if(!s.overtime){
   if(s.mode==='duel'){
    if(s.teams.A.kills!==s.teams.B.kills){finish(s,s.teams.A.kills>s.teams.B.kills?'A':'B','duel_score_timeout');return s}
    const [a,b]=['A','B'].map(t=>Object.values(s.players).filter(p=>p.team===t).reduce((n,p)=>n+p.hp,0));
    if(Math.abs(a-b)>.001){finish(s,a>b?'A':'B','duel_health_timeout');return s}
   }else{
    const a=s.teams.A.coreHp,b=s.teams.B.coreHp;if(Math.abs(a-b)>.001){finish(s,a>b?'A':'B','origin_health_timeout');return s}
    const ra=s.relays.filter(x=>x.owner==='A').length,rb=s.relays.filter(x=>x.owner==='B').length;
    if(ra!==rb){finish(s,ra>rb?'A':'B','relay_count_timeout');return s}
   }
   s.overtime=true;ev(s,'overtime');
  }else if(s.elapsedMs>=cfg.duration+60000)finish(s,null,'unresolved_tie_void');
 }
 return s;
}
export function aiCommands(s){
 const map=MAPS[s.mapId],result=[];for(const p of Object.values(s.players)){
  if(p.id==='A-0'||!p.alive)continue;
  const enemies=Object.values(s.players).filter(x=>x.team!==p.team&&x.alive).sort((a,b)=>dist(a,p)-dist(b,p));
  const enemy=enemies[0];let goal=null;
  if(s.mode==='duel')goal=enemy;
  else{
   const neutral=s.relays.filter(r=>r.owner!==p.team).sort((a,b)=>dist(a,p)-dist(b,p));
   const ours=s.relays.filter(r=>r.owner===p.team).sort((a,b)=>dist(a,p)-dist(b,p));
   goal=neutral[0]||ours[0]||{x:p.team==='A'?map.width-3:3,y:map.height/2};
   if(enemy&&dist(enemy,p)<2.6)goal=enemy;
  }
  const commands=[];if(!goal)continue;
  const dx=goal.x-p.x,dy=goal.y-p.y,d=Math.hypot(dx,dy);
  const seq=()=>{p.aiSeq=Math.max(p.aiSeq??0,p.seq)+1;return p.aiSeq}; // Dedicated AI input sequence.
  if(d>1.8){
   const vector={x:dx/d,y:dy/d};
   const ahead={x:p.x+vector.x*.25,y:p.y+vector.y*.25};
   const dodge=validMapPosition(map,ahead.x,ahead.y)?vector:{x:vector.y,y:-vector.x};
   commands.push({actorId:p.id,seq:seq(),type:'move',dx:dodge.x,dy:dodge.y});
  }
  if(s.mode!=='duel'&&s.relays.some(r=>dist(r,p)<=2.8))commands.push({actorId:p.id,seq:seq(),type:'capture'});
  if(enemy&&dist(enemy,p)<=HEROES[p.characterId].range&&s.elapsedMs-p.attackAt>=600)commands.push({actorId:p.id,seq:seq(),type:'attack',target:enemy.id});
  if(commands.length<3&&p.hp<p.maxHp*.65&&['heal','guard'].includes(HEROES[p.characterId].kind)&&s.elapsedMs-p.cooldowns.primary>=5000)commands.push({actorId:p.id,seq:seq(),type:'skill',slot:'primary',target:p.id});
  result.push(...commands);
 }
 return result;
}
export function nearestTarget(s,playerId){const p=s.players[playerId],map=MAPS[s.mapId];return Object.values(s.players).filter(x=>x.team!==p.team&&x.alive&&!lineBlocked(map,p,x)).sort((a,b)=>dist(p,a)-dist(p,b))[0]||null;}
export function remainingTime(s){const n=MODES[s.mode].duration+(s.overtime?60000:0)-s.elapsedMs;return Math.ceil(Math.max(0,n)/1000)}
