/* BUKLOD Empire Arena — headless authoritative domain logic, V1.
 * Never place BP writes, authentication secrets or client-trusted outcomes here.
 * The same fixed-tick transition must run on the trusted match server.
 */
export const MODES = Object.freeze({
  duel:{playersPerTeam:1,durationMs:180000,coreHp:0,respawnMs:6000,minRankedMs:45000},
  cluster:{playersPerTeam:3,durationMs:330000,coreHp:1000,respawnMs:6000,minRankedMs:120000},
  grand:{playersPerTeam:5,durationMs:540000,coreHp:1600,respawnMs:7500,minRankedMs:180000}
});
export const MAPS = Object.freeze({
  genesis_rift:{width:40,height:24,cores:{A:{x:3,y:12},B:{x:37,y:12}},relays:[[20,4],[20,12],[20,20],[30,12]],cover:[[14,7,2],[26,17,2]]},
  aurora_foundry:{width:44,height:26,cores:{A:{x:3,y:13},B:{x:41,y:13}},relays:[[22,4],[22,13],[22,22],[32,13]],cover:[[15,13,2],[29,13,2]]},
  verdant_fracture:{width:38,height:24,cores:{A:{x:3,y:12},B:{x:35,y:12}},relays:[[19,5],[19,12],[19,19],[28,12]],cover:[[12,8,1.7],[26,16,1.7]]}
});
export const HEROES = Object.freeze({
  phan:{role:"architect",primary:"supply",hp:112,range:4.3},
  quin:{role:"scout",primary:"blink",hp:90,range:6},
  van:{role:"support",primary:"heal",hp:104,range:5},
  christian:{role:"commander",primary:"guard",hp:112,range:4.8},
  lhen:{role:"tempo",primary:"supply",hp:100,range:5.1},
  jawo:{role:"skirmisher",primary:"blink",hp:96,range:5.3},
  trudice:{role:"illusionist",primary:"disrupt",hp:95,range:5.5},
  ace:{role:"vanguard",primary:"burst",hp:120,range:3.6},
  mitch:{role:"terrain",primary:"guard",hp:108,range:4.4},
  niel:{role:"signal",primary:"disrupt",hp:98,range:5.7},
  angel:{role:"medic",primary:"heal",hp:106,range:4.8},
  vhen:{role:"growth",primary:"heal",hp:102,range:4.5},
  ellusur:{role:"rift",primary:"burst",hp:92,range:6.1}
});
export const DIAMOND_THRESHOLDS = Object.freeze([0,15,35,55,75,100,120,155,200,260,340,440,570,730,930,1180,1490,1870,2330,2900]);
export function clamp(v,min,max){return Number.isFinite(v)?Math.max(min,Math.min(max,v)):min;}
export function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
export function levelForDiamonds(balance){
  let level=1;
  for(let i=0;i<DIAMOND_THRESHOLDS.length;i++)if(clamp(balance,0,1e9)>=DIAMOND_THRESHOLDS[i])level=i+1;
  return level;
}
export function effectiveCombatLevel({developmentLevel,bpEligibleLevel,itemVerifiedLevel,diamondBalance}){
  // All gates are required: omitted eligibility fails closed to Level 1.
  return Math.max(1,Math.min(20,Math.floor(clamp(developmentLevel,1,20)),Math.floor(clamp(bpEligibleLevel,1,20)),Math.floor(clamp(itemVerifiedLevel,1,20)),levelForDiamonds(diamondBalance)));
}
export function walkable(map,x,y){
  return Number.isFinite(x)&&Number.isFinite(y)&&x>0.7&&y>0.7&&x<map.width-0.7&&y<map.height-0.7
    &&map.cover.every(([cx,cy,r])=>Math.hypot(cx-x,cy-y)>r+0.7);
}
export function lineBlocked(map,a,b){
  return map.cover.some(([x,y,r])=>{
    const dx=b.x-a.x,dy=b.y-a.y,d=dx*dx+dy*dy;
    const u=d===0?0:clamp(((x-a.x)*dx+(y-a.y)*dy)/d,0,1);
    return Math.hypot(a.x+u*dx-x,a.y+u*dy-y)<r+0.2;
  });
}
export function event(s,type,extra={}){
  s.events.push({tick:s.tick,type,...extra});
  if(s.events.length>128)s.events=s.events.slice(-128);
}
export function finish(s,team,reason){
  if(s.status!=="active")return;
  s.status=team?"finished":"void";
  s.result={winner:team,loser:team?(team==="A"?"B":"A"):null,reason,elapsedMs:s.elapsedMs};
  event(s,"result",{team,reason});
}
export function createMatch({id,mode="cluster",mapId="genesis_rift",ranked=false,roster}){
  const conf=MODES[mode],map=MAPS[mapId];
  if(!conf||!map)throw Error("invalid_mode_map");
  if(typeof id!=="string"||id.length<8||id.length>128)throw Error("invalid_match_id");
  if(!Array.isArray(roster)||roster.length!==2*conf.playersPerTeam)throw Error("invalid_roster");
  if(new Set(roster.map(x=>x.id)).size!==roster.length)throw Error("duplicate_identity");
  if(roster.some(r=>!r||!r.id||!HEROES[r.characterId]||!["A","B"].includes(r.team)))throw Error("invalid_player");
  if(["A","B"].some(t=>roster.filter(r=>r.team===t).length!==conf.playersPerTeam))throw Error("unbalanced_teams");
  if(ranked&&roster.some(r=>r.humanVerified!==true))throw Error("unverified_ranked_player");
  const players={};
  for(const t of ["A","B"]){
    const group=roster.filter(r=>r.team===t).sort((a,b)=>String(a.id).localeCompare(String(b.id)));
    group.forEach((r,i)=>{
      const hero=HEROES[r.characterId],level=Math.floor(clamp(r.effectiveLevel,1,20));
      const x=t==="A"?5:map.width-5,y=map.height/2+(i-(group.length-1)/2)*2.3;
      const maxHp=Math.round(hero.hp*(1+0.006*(level-1)));
      players[r.id]={id:r.id,team:t,characterId:r.characterId,role:hero.role,level,x,y,spawn:{x,y},
        hp:maxHp,maxHp,shield:0,alive:true,respawnAt:0,attackAt:-1e6,lastSeq:0,
        cooldown:{primary:-1e6,secondary:-1e6,ultimate:-1e6,build:-1e6},
        lastActionAt:-1e6,activeMs:0,commands:0,contributions:0,kills:0,deaths:0,damage:0,capturing:false};
    });
  }
  const relays=mode==="duel"?[]:map.relays.slice(0,mode==="grand"?4:3).map(([x,y],i)=>({id:"relay"+i,x,y,progress:0,owner:null}));
  return {id,mode,mapId,ranked:!!ranked,ruleVersion:1,tick:0,elapsedMs:0,status:"active",overtime:false,result:null,players,
    teams:{A:{coreHp:conf.coreHp,flux:40,kills:0,holdMs:0},B:{coreHp:conf.coreHp,flux:40,kills:0,holdMs:0}},
    relays,buildings:[],events:[]};
}
export function damage(s,attacker,victim,base){
  if(!victim.alive||attacker.team===victim.team)return false;
  const reduction=Math.min(victim.shield,base);victim.shield-=reduction;
  const taken=Math.max(0,base-reduction);
  victim.hp=Math.max(0,victim.hp-taken);attacker.damage+=taken;
  if(victim.hp===0){
    victim.alive=false;victim.deaths++;attacker.kills++;
    victim.respawnAt=s.elapsedMs+MODES[s.mode].respawnMs;
    s.teams[attacker.team].kills++;
    event(s,"knockout",{attacker:attacker.id,victim:victim.id});
    if(s.mode==="duel"&&s.teams[attacker.team].kills>=2)finish(s,attacker.team,"duel_best_of_three");
  }
  return true;
}
export function attack(s,p,c,map){
  if(s.elapsedMs-p.attackAt<600)return;
  const enemy=p.team==="A"?"B":"A";
  if(c.target==="core"&&s.mode!=="duel"){
    const core=map.cores[enemy],near=distance({x:p.x,y:p.y},core)<=4.5;
    if(!near||s.relays.filter(n=>n.owner===p.team).length<2)return;
    const shield=s.buildings.some(b=>b.team===enemy&&b.kind==="barrier"&&distance(b,core)<6);
    const n=16*(1+0.006*(p.level-1))*(shield?0.55:1);
    s.teams[enemy].coreHp=Math.max(0,s.teams[enemy].coreHp-n);
    p.attackAt=s.elapsedMs;p.contributions++;p.damage+=n;
    if(!s.teams[enemy].coreHp)finish(s,p.team,"enemy_origin_destroyed");
  }else{
    const victim=s.players[c.target],here={x:p.x,y:p.y};
    if(!victim||!victim.alive||victim.team===p.team||distance(here,{x:victim.x,y:victim.y})>HEROES[p.characterId].range||lineBlocked(map,here,{x:victim.x,y:victim.y}))return;
    p.attackAt=s.elapsedMs;p.contributions++;
    damage(s,p,victim,18*(1+0.006*(p.level-1)));
  }
}
export function skill(s,p,c,map){
  if(!["primary","secondary","ultimate"].includes(c.slot))return;
  if(c.slot==="secondary"&&p.level<3||c.slot==="ultimate"&&p.level<6)return;
  const duration={primary:5000,secondary:7500,ultimate:45000}[c.slot];
  if(s.elapsedMs-p.cooldown[c.slot]<duration)return;
  const victim=s.players[c.target];
  const here={x:p.x,y:p.y};
  if(c.slot==="secondary"||c.slot==="primary"&&HEROES[p.characterId].primary==="blink"){
    const mag=Math.hypot(c.dx,c.dy);if(!Number.isFinite(mag)||mag<0.1)return;
    const boost=c.slot==="secondary"?3:4,x=p.x+boost*c.dx/mag,y=p.y+boost*c.dy/mag;
    if(!walkable(map,x,y))return;
    p.x=x;p.y=y;
  }else if(c.slot==="ultimate"){
    if(s.teams[p.team].flux<30||!victim||!victim.alive||victim.team===p.team||distance(here,{x:victim.x,y:victim.y})>6||lineBlocked(map,here,{x:victim.x,y:victim.y}))return;
    s.teams[p.team].flux-=30;
    damage(s,p,victim,55*(1+0.006*(p.level-1)));
  }else{
    const kind=HEROES[p.characterId].primary;
    if(kind==="heal"||kind==="guard"){
      const ally=victim&&victim.team===p.team&&victim.alive?victim:p;
      if(distance(here,{x:ally.x,y:ally.y})>6)return;
      if(kind==="heal")ally.hp=Math.min(ally.maxHp,ally.hp+32);
      else ally.shield=Math.min(60,ally.shield+32);
    }else if(kind==="supply")s.teams[p.team].flux=Math.min(120,s.teams[p.team].flux+12);
    else if(kind==="burst"){
      if(!victim||!victim.alive||victim.team===p.team||distance(here,{x:victim.x,y:victim.y})>5.5||lineBlocked(map,here,{x:victim.x,y:victim.y}))return;
      damage(s,p,victim,32*(1+0.006*(p.level-1)));
    }else if(kind==="disrupt"){
      const relay=s.relays.find(n=>n.id===c.relayId);
      if(!relay||distance(here,relay)>5.5||relay.owner===p.team)return;
      relay.progress=clamp(relay.progress+(p.team==="A"?30:-30),-100,100);
      if(Math.abs(relay.progress)<100)relay.owner=null;
    }else return;
  }
  p.cooldown[c.slot]=s.elapsedMs;p.contributions++;
}
export function build(s,p,c,map){
  const costs={barrier:25,healing:30,bridge:20},cost=costs[c.kind];
  if(!cost||!Number.isFinite(c.x)||!Number.isFinite(c.y)||s.elapsedMs-p.cooldown.build<8000)return;
  if(!walkable(map,c.x,c.y)||distance({x:p.x,y:p.y},c)>4.5)return;
  if(!s.relays.some(n=>n.owner===p.team&&distance(n,c)<6))return;
  if(s.buildings.filter(x=>x.team===p.team).length>=3)return;
  const charge=p.role==="architect"?Math.ceil(cost*0.8):cost;
  if(s.teams[p.team].flux<charge)return;
  s.teams[p.team].flux-=charge;
  s.buildings.push({id:String(s.tick)+":"+p.id+":"+s.buildings.length,team:p.team,kind:c.kind,x:c.x,y:c.y,hp:150,expiresMs:s.elapsedMs+45000});
  p.cooldown.build=s.elapsedMs;p.contributions++;
}
export function stepMatch(previous,input=[],stepMs=50){
  if(stepMs!==50)throw Error("fixed_tick_required");
  if(!Array.isArray(input)||input.length>40)throw Error("input_batch_too_large");
  // Serializable deterministic state copy: intentionally no wall-clock, RNG, DB or IO.
  const s=JSON.parse(JSON.stringify(previous));
  if(s.status!=="active")return s;
  s.tick++;s.elapsedMs+=stepMs;
  const map=MAPS[s.mapId],used={};
  for(const p of Object.values(s.players)){
    p.capturing=false;
    if(!p.alive&&s.elapsedMs>=p.respawnAt){p.alive=true;p.hp=p.maxHp;p.shield=0;p.x=p.spawn.x;p.y=p.spawn.y;}
    if(p.alive&&s.elapsedMs-p.lastActionAt<10000)p.activeMs+=stepMs;
  }
  for(const c of [...input].sort((a,b)=>String(a?.actorId).localeCompare(String(b?.actorId))||((a?.seq||0)-(b?.seq||0)))){
    if(s.status!=="active")break;
    if(!c||!Number.isSafeInteger(c.seq)||c.seq<=0)continue;
    const p=s.players[c.actorId];if(!p||!p.alive||c.seq<=p.lastSeq)continue;
    used[p.id]=(used[p.id]||0)+1;if(used[p.id]>3)continue;
    p.lastSeq=c.seq;p.lastActionAt=s.elapsedMs;p.commands++;
    if(c.type==="move"){
      const mag=Math.hypot(c.dx,c.dy);
      if(!Number.isFinite(mag)||mag<0.05||mag>1.5)continue;
      const speed=4.6*(1+0.003*(p.level-1));
      const x=p.x+(c.dx/Math.max(1,mag))*speed*.05,y=p.y+(c.dy/Math.max(1,mag))*speed*.05;
      if(walkable(map,x,y)){p.x=x;p.y=y;}
    }else if(c.type==="attack")attack(s,p,c,map);
    else if(c.type==="skill")skill(s,p,c,map);
    else if(c.type==="build")build(s,p,c,map);
    else if(c.type==="capture"){p.capturing=true;p.contributions++;}
  }
  if(s.status!=="active")return s;
  for(const n of s.relays){
    const nearby=Object.values(s.players).filter(p=>p.alive&&p.capturing&&distance({x:p.x,y:p.y},n)<=2.8);
    const a=nearby.filter(p=>p.team==="A").length,b=nearby.length-a;
    if(!a&&!b||a&&b)continue;
    const delta=(a?1:-1)*1.25*Math.min(2,Math.max(a,b)),was=n.owner;
    n.progress=clamp(n.progress+delta,-100,100);
    n.owner=n.progress===100?"A":n.progress===-100?"B":null;
    if(n.owner&&n.owner!==was)event(s,"relay_capture",{relayId:n.id,team:n.owner});
  }
  s.buildings=s.buildings.filter(b=>b.expiresMs>s.elapsedMs&&b.hp>0);
  for(const team of ["A","B"]){
    const other=team==="A"?"B":"A",mine=s.teams[team];
    const owned=s.relays.filter(n=>n.owner===team).length;
    mine.flux=Math.min(120,mine.flux+owned*.02);
    if(owned>=2&&s.mode!=="duel")s.teams[other].coreHp=Math.max(0,s.teams[other].coreHp-(s.overtime?.35:.1));
    mine.holdMs=owned>=3&&owned===s.relays.length?mine.holdMs+50:0;
    if(mine.holdMs>=12000)finish(s,team,"three_relay_network_lock");
    if(s.mode!=="duel"&&s.teams[other].coreHp<=0)finish(s,team,"relay_core_pressure");
  }
  for(const b of s.buildings)if(b.kind==="healing")
    for(const p of Object.values(s.players))if(p.alive&&p.team===b.team&&distance({x:p.x,y:p.y},b)<3)p.hp=Math.min(p.maxHp,p.hp+.2);
  if(s.status!=="active")return s;
  const conf=MODES[s.mode];
  if(s.elapsedMs>=conf.durationMs){
    if(!s.overtime){
      if(s.mode==="duel"){
        if(s.teams.A.kills!==s.teams.B.kills){finish(s,s.teams.A.kills>s.teams.B.kills?"A":"B","duel_score_timeout");return s;}
        const a=Object.values(s.players).filter(p=>p.team==="A").reduce((v,p)=>v+p.hp,0),b=Object.values(s.players).filter(p=>p.team==="B").reduce((v,p)=>v+p.hp,0);
        if(Math.abs(a-b)>.001){finish(s,a>b?"A":"B","duel_health_timeout");return s;}
      }else{
        const a=s.teams.A.coreHp,b=s.teams.B.coreHp;
        if(Math.abs(a-b)>.001){finish(s,a>b?"A":"B","origin_health_timeout");return s;}
        const ra=s.relays.filter(n=>n.owner==="A").length,rb=s.relays.filter(n=>n.owner==="B").length;
        if(ra!==rb){finish(s,ra>rb?"A":"B","relay_count_timeout");return s;}
      }
      s.overtime=true;event(s,"sudden_death");
    }else if(s.elapsedMs>=conf.durationMs+60000)
      finish(s,null,"fully_tied_void_no_reward"); // Never fake a winner for an inactive stalemate.
  }
  return s;
}
export function validateCommandEnvelope(match,authenticatedUid,verifiedTicket,command,serverNowMs){
  // verifiedTicket MUST be produced by a server-side signature verifier.
  if(!verifiedTicket||verifiedTicket.userId!==authenticatedUid||verifiedTicket.matchId!==match.id||verifiedTicket.expiresAtMs<=serverNowMs)return false;
  if(!match.players[authenticatedUid]||!command||command.actorId!==authenticatedUid)return false;
  if(!Number.isSafeInteger(command.seq)||command.seq<1||JSON.stringify(command).length>360)return false;
  return ["move","attack","skill","build","capture"].includes(command.type);
}
export function publicResult(match){
  if(!match.result)return null;
  return {matchId:match.id,mode:match.mode,ranked:match.ranked,...match.result,players:Object.values(match.players).map(p=>({id:p.id,team:p.team,characterId:p.characterId,level:p.level,kills:p.kills,deaths:p.deaths,damage:Math.round(p.damage),activeMs:p.activeMs}))};
}
