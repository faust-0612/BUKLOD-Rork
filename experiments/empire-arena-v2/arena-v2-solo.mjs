/**
 * BUKLOD Arena — fully local 1v1 CPU duel. Uses the canonical attack/skill/
 * movement command validations and physics; NEVER touches ranked, BP, diamonds,
 * QMP, user inventory, Supabase or any server.
 *
 * Designed for a previously signed-in BUKLOD user to play with zero signal.
 * No independent matchmaking or shadow economy is introduced.
 */
import { HEROES, createPractice, command, tick, STEP_MS } from './arena-v2-engine.mjs';

export const SOLO_CPU_DIFFICULTIES = Object.freeze({
  easy: Object.freeze({label:'Beginner',thinkMs:700,attackEvery:2,skillEvery:4,moveEvery:2,strafe:false}),
  normal: Object.freeze({label:'Challenger',thinkMs:420,attackEvery:1,skillEvery:2,moveEvery:1,strafe:true}),
  hard: Object.freeze({label:'Veteran',thinkMs:250,attackEvery:1,skillEvery:1,moveEvery:1,strafe:true}),
});
export const SOLO_ROUND_MS = 90000;
export const SOLO_INTERMISSION_MS = 1400;
export const SOLO_TARGET_WINS = 2;

const between=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const midpoint=(s,team)=>({x:s.w/2+(team==='A'?-11:11),y:s.h/2});

/** Log only match-local metadata; avoids exposing IDs or creating XP. */
function emit(s,type,extra={}) {
  s.events.push({seq:++s.eventSeq,time:s.elapsed,type,...extra});
  if(s.events.length>100)s.events.shift();
}
function restoreRound(s) {
  for(const [id,p] of Object.entries(s.players)) {
    const spot=midpoint(s,p.team);
    p.x=spot.x;p.y=spot.y;
    p.spawn={...spot};p.hp=p.maxHp;p.mana=p.maxMana;p.shield=0;
    p.alive=true;p.respawnAt=0;p.lastAttacked=-1e8;p.lastMoveTick=-1;
    p.cooldowns={primary:-1e8,secondary:-1e8,ultimate:-1e8};
    p.effects={};p.target=null;p.lastDamage=-1e8;
    p.bot=false; // Engine miner/war bot may never replace the 1v1 CPU brain.
    if(id==='B0')p.botAt=0;
  }
  s.loot=[];s.traps=[];
  s.solo.roundStartedAt=s.elapsed;
  s.solo.intermissionUntil=0;
  s.solo.lastRoundWinner=null;
  emit(s,'solo_round_start',{round:s.solo.round});
}

/**
 * Every participant has an equal MATCH-ONLY combat level (skills + ultimate
 * available). This is not verified character progression or Diamond grant.
 */
export function createOfflineSoloBattle({
  hero='phan',opponent='ace',difficulty='normal',
  mapId='verdant_fracture',seed=20261121,
}={}) {
  if(!HEROES[hero]||!HEROES[opponent])throw Error('Unknown BUKLOD CPU duel character');
  if(!SOLO_CPU_DIFFICULTIES[difficulty])throw Error('Invalid CPU difficulty');
  const s=createPractice({
    mode:'duel',hero,foes:[opponent],mapId,seed,
    snapshot:{characterLevel:1,bpEligibleLevel:1,itemVerifiedLevel:1,diamonds:0,verifiedItems:[]},
  });
  s.kind='OFFLINE_SOLO_CPU';
  s.ranked=false;
  s.solo={
    difficulty,round:1,wins:{A:0,B:0},draws:0,roundStartedAt:0,
    intermissionUntil:0,lastRoundWinner:null,opponent,playerHero:hero,
    cpuDecisions:0,lastCpuThink:-1e8,lastCpuMove:-1e8,
  };
  // Environment is artwork only in solo combat. No villager, tower, trap,
  // resource or NPC can score a hidden hit; the arena duel is hero vs hero.
  s.units=[];s.towers=[];s.creatures=[];s.nodes=[];s.buildings=[];
  s.loot=[];s.traps=[];
  s.teams.A.queue=[];s.teams.B.queue=[];
  for(const p of Object.values(s.players)) {
    p.matchLevel=6; // local-only equal skill availability, both sides
    p.x=midpoint(s,p.team).x;p.y=midpoint(s,p.team).y;
    p.maxHp=180;p.hp=180;
    p.maxMana=120;p.mana=120;
    p.bot=false;
  }
  restoreRound(s);
  emit(s,'solo_match_start',{difficulty,hero,opponent,roundsToWin:SOLO_TARGET_WINS});
  return s;
}

function obstacleAt(s,x,y) {
  return s.cover.some(([cx,cy,r])=>Math.hypot(x-cx,y-cy)<r+1.3);
}
function moveCpu(s,p,goal,difficulty) {
  if(s.tick % difficulty.moveEvery!==0)return;
  const dx=goal.x-p.x,dy=goal.y-p.y;
  const length=Math.hypot(dx,dy);
  if(length<.5)return;
  const a=Math.atan2(dy,dx);
  // Deterministic obstacle dodges, bounded fixed candidates. Uses the same
  // engine command as a human and cannot teleport through terrain.
  for(const angle of [a,a+.75,a-.75,a+1.4,a-1.4,a+Math.PI/2,a-Math.PI/2]) {
    const vx=Math.cos(angle),vy=Math.sin(angle);
    if(obstacleAt(s,p.x+vx*.7,p.y+vy*.7))continue;
    if(command(s,p.id,{type:'move',dx:vx,dy:vy}))return;
  }
}
function runSoloCpu(s) {
  const cfg=SOLO_CPU_DIFFICULTIES[s.solo.difficulty];
  const cpu=s.players.B0,player=s.players.A0;
  if(!cpu?.alive||!player?.alive)return;
  const d=dist(cpu,player);
  const low=cpu.hp/cpu.maxHp<.34;
  const isSupport=['heal','guard','supply'].includes(HEROES[cpu.hero].style);
  const face={dx:player.x-cpu.x,dy:player.y-cpu.y};
  // Close distance every movement frame. Strafe around an aggressive opponent
  // rather than standing in place like the old mining bot.
  const flank=cfg.strafe&&d<5.4 && !low && Math.floor(s.elapsed/1800)%2===0;
  if(d>4.3||flank) {
    const goal=flank
      ? {x:player.x+(cpu.y-player.y)*.4,y:player.y+(player.x-cpu.x)*.4}
      : {x:player.x,y:player.y};
    moveCpu(s,cpu,goal,cfg);
  }
  if(s.elapsed-s.solo.lastCpuThink<cfg.thinkMs)return;
  s.solo.lastCpuThink=s.elapsed;
  s.solo.cpuDecisions++;
  const turn=s.solo.cpuDecisions;
  // Both attacks AND abilities use canonical real cooldowns/mana/damage.
  if(d<=5.5&&turn%cfg.attackEvery===0) {
    command(s,cpu.id,{type:'attack',targetId:player.id});
  }
  if((turn%cfg.skillEvery===0 || low&&isSupport) && d<7.8) {
    command(s,cpu.id,{type:'skill',slot:'primary',targetId:player.id,...face});
  }
  if(d<9.2 && (turn%Math.max(3,cfg.skillEvery+2)===0 || low&&isSupport)) {
    command(s,cpu.id,{type:'skill',slot:'ultimate',targetId:player.id,...face});
  }
  if(d>5.8&&d<13 && turn%Math.max(4,cfg.skillEvery+3)===0) {
    command(s,cpu.id,{type:'skill',slot:'secondary',targetId:player.id,...face});
  }
}

function roundWinner(s) {
  const player=s.players.A0,cpu=s.players.B0;
  if(!player.alive&&!cpu.alive)return null;
  if(!player.alive)return 'B';
  if(!cpu.alive)return 'A';
  const a=player.hp/player.maxHp,b=cpu.hp/cpu.maxHp;
  if(Math.abs(a-b)>.00001)return a>b?'A':'B';
  const damageA=player.hits,damageB=cpu.hits;
  if(damageA!==damageB)return damageA>damageB?'A':'B';
  return null;
}
function finishRound(s,winner) {
  const solo=s.solo;
  if(solo.intermissionUntil)return;
  solo.lastRoundWinner=winner;
  if(winner)solo.wins[winner]++;
  else solo.draws++;
  emit(s,'solo_round_end',{round:solo.round,winner,score:{...solo.wins}});
  if(solo.wins.A>=SOLO_TARGET_WINS||solo.wins.B>=SOLO_TARGET_WINS) {
    s.status='finished';s.result={winner,reason:'offline_cpu_best_of_three'};
    emit(s,'result',s.result);return;
  }
  // Three draws should never award an arbitrary winner.
  if(solo.draws>=3) {
    s.status='void';s.result={winner:null,reason:'offline_cpu_three_draws'};
    emit(s,'result',s.result);return;
  }
  solo.intermissionUntil=s.elapsed+SOLO_INTERMISSION_MS;
}
export function tickOfflineSolo(s) {
  if(!s||s.kind!=='OFFLINE_SOLO_CPU'||!s.solo)throw Error('Not an offline solo battle');
  if(s.status!=='active')return s;
  if(s.solo.intermissionUntil) {
    // Freeze both heroes between rounds, yet advance the bounded presentation
    // clock. Never process auto-respawns, wildlife, bots or hidden unit damage.
    s.tick++;s.elapsed+=STEP_MS;
    if(s.elapsed>=s.solo.intermissionUntil) {
      s.solo.round++;
      restoreRound(s);
    }
    return s;
  }
  tick(s);
  if(s.status!=='active')return s;
  if(s.players.A0.alive&&s.players.B0.alive)runSoloCpu(s);
  if(!s.players.A0.alive||!s.players.B0.alive||s.elapsed-s.solo.roundStartedAt>=SOLO_ROUND_MS) {
    finishRound(s,roundWinner(s));
  }
  return s;
}
