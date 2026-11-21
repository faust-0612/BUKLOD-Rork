/**
 * BUKLOD Empire Arena — one authoritative Node process.
 * No game state or ranked result is accepted from a phone. All inputs flow
 * through the existing deterministic Arena V2 simulation and private ledger RPCs.
 * This package is NOT a standalone Android application.
 */
import { randomUUID } from 'node:crypto';
import { createPractice, command, tick, STEP_MS, MODES, HEROES, ARENA_MAPS } from '../../experiments/empire-arena-v2/arena-v2-engine.mjs';

const MAX_QUEUE=300, MAX_MATCHES=60, SNAPSHOT_EVERY=2, DISCONNECT_GRACE_MS=20_000;
const MAX_MESSAGES_PER_SEC=35;
const allowedModes=new Set(Object.keys(MODES));
const allowedMaps=new Set(Object.keys(ARENA_MAPS));
const allowedHeroes=new Set(Object.keys(HEROES));

const cap=(n,lo,hi)=>Math.min(hi,Math.max(lo,n));
const isFiniteWithin=(n,lo,hi)=>typeof n==='number'&&Number.isFinite(n)&&n>=lo&&n<=hi;
const safeId=value=>typeof value==='string'&&value.length<=52&&/^[a-zA-Z0-9_-]+$/.test(value);

export function sanitizeArenaAction(raw) {
  if (!raw || typeof raw!=='object'||Array.isArray(raw)||typeof raw.type!=='string') return null;
  const a=raw;
  const no=type=>({type});
  switch(a.type){
    case 'move':
      return isFiniteWithin(a.dx,-1,1)&&isFiniteWithin(a.dy,-1,1)&&
        Math.hypot(a.dx,a.dy)>=.05?{type:'move',dx:a.dx,dy:a.dy}:null;
    case 'attack':
      return !a.targetId||safeId(a.targetId)?{type:'attack',...(a.targetId?{targetId:a.targetId}:{})}:null;
    case 'skill':
      if(!['primary','secondary','ultimate'].includes(a.slot)||
         !isFiniteWithin(a.dx??1,-40,40)||!isFiniteWithin(a.dy??0,-40,40)||
         (a.targetId&&!safeId(a.targetId)))return null;
      return {type:'skill',slot:a.slot,dx:a.dx??1,dy:a.dy??0,
        ...(a.targetId?{targetId:a.targetId}:{})};
    case 'mine':return !a.nodeId||safeId(a.nodeId)?{type:'mine',...(a.nodeId?{nodeId:a.nodeId}:{})}:null;
    case 'deposit':return no('deposit');
    case 'train':
      return ['villager','scout','warrior','archer','guardian','siege'].includes(a.kind)
        ?{type:'train',kind:a.kind}:null;
    case 'order':
      return ['mine','escort','defend','push','retreat','patrol','repair'].includes(a.order)
        &&(!a.nodeId||safeId(a.nodeId))?
        {type:'order',order:a.order,...(a.nodeId?{nodeId:a.nodeId}:{})}:null;
    case 'build':
      return ['barracks','depot','workshop','watchtower'].includes(a.kind) &&
        isFiniteWithin(a.x,0,320)&&isFiniteWithin(a.y,0,220)
        ?{type:'build',kind:a.kind,x:a.x,y:a.y}:null;
    case 'seal_attack':return no('seal_attack');
    case 'loot':return !a.id||safeId(a.id)?{type:'loot',...(a.id?{id:a.id}:{})}:null;
    case 'tower_repair':
    case 'tower_upgrade':
      return safeId(a.towerId)?{type:a.type,towerId:a.towerId}:null;
    default:return null;
  }
}

function publicState(game) {
  return {
    w:game.w,h:game.h,tick:game.tick,elapsed:game.elapsed,status:game.status,
    mapId:game.mapId,map:game.map,players:game.players,
    teams:game.teams,towers:game.towers,units:game.units,
    creatures:game.creatures,buildings:game.buildings,nodes:game.nodes,
    loot:game.loot,cover:game.cover,seals:game.seals,
    events:game.events.slice(-18),result:game.result,
  };
}

function send(session,payload){
  try { session?.send?.(payload); } catch { /* Dead socket; forfeit grace handles disconnect. */ }
}

export class ArenaMatchCoordinator {
  constructor({store, clock=()=>Date.now(),randomId=()=>randomUUID(),onError=()=>{}}){
    if(!store||!['open','settle','abort'].every(k=>typeof store[k]==='function'))throw Error('Trusted ranked store required');
    this.store=store;
    this.clock=clock;
    this.randomId=randomId;
    this.onError=onError;
    this.queues=new Map();
    this.matches=new Map();
    this.occupied=new Map();
    this.globalTick=0;
  }
  async enqueue(session,mode,mapId){
    if(!allowedModes.has(mode)||!allowedMaps.has(mapId)||!allowedHeroes.has(session.hero))
      throw Error('invalid_queue_choice');
    if(!session.userId||!session.verified||!session.eligible||!session.profile)
      throw Error('verified_ranked_profile_required');
    if(this.occupied.has(session.userId))throw Error('already_in_arena');
    if(this.matches.size>=MAX_MATCHES)throw Error('arena_at_capacity');
    const total=[...this.queues.values()].reduce((n,q)=>n+q.length,0);
    if(total>=MAX_QUEUE)throw Error('queue_capacity');
    const key=mode+':'+mapId;
    const bucket=this.queues.get(key)||[];
    this.queues.set(key,bucket);
    bucket.push({session,joinedAt:this.clock()});
    this.occupied.set(session.userId,{kind:'queued',key});
    send(session,{type:'queued',mode,mapId,position:bucket.length});
    if(bucket.length>=2*MODES[mode].n){
      const group=bucket.splice(0,2*MODES[mode].n);
      if(!bucket.length)this.queues.delete(key);
      for(const {session:s} of group)this.occupied.set(s.userId,{kind:'allocating'});
      // Deliberately await one trusted, transactionally reserved match.
      await this.startMatch(group,mode,mapId);
    }
  }
  async startMatch(group,mode,mapId){
    const n=MODES[mode].n;
    const roster=group.map(({session},i)=>({
      session,team:i%2===0?'A':'B',slot:(i%2===0?'A':'B')+Math.floor(i/2),
    }));
    const matchId=this.randomId();
    const seats=roster.map(({session,team,slot})=>({
      seat_id:slot,user_id:session.userId,hero_id:session.hero,
    }));
    let reserved=false;
    try {
      const receipt=await this.store.open({matchId,mode,mapId,players:seats});
      if(receipt?.accepted!==true)throw Error('diamond_reservation_rejected');
      reserved=true;
      const playerBySlot=Object.fromEntries(roster.map(x=>[x.slot,x]));
      const allyIds=Array.from({length:n-1},(_,i)=>playerBySlot['A'+(i+1)].session.hero);
      const foeIds=Array.from({length:n},(_,i)=>playerBySlot['B'+i].session.hero);
      const snapshots=Object.fromEntries(roster.map(x=>[x.slot,x.session.snapshot]));
      const state=createPractice({
        mode,mapId,hero:playerBySlot.A0.session.hero,
        snapshot:playerBySlot.A0.session.snapshot,
        snapshots,allies:allyIds,foes:foeIds,
      });
      for(const player of Object.values(state.players))player.bot=false;
      const match={id:matchId,mode,mapId,state,roster,status:'active',
        createdAt:this.clock(),lastSnapshotTick:0,settling:false};
      this.matches.set(matchId,match);
      for(const {session,slot} of roster){
        this.occupied.set(session.userId,{kind:'playing',matchId,slot});
        session.matchId=matchId;
        session.slot=slot;
        session.disconnectedAt=null;
        send(session,{type:'match_start',matchId,slot,mode,mapId,
          tickMs:STEP_MS,ranked:true,diamondStake:1,
          state:publicState(state)});
      }
    }catch(error){
      if(reserved) {
        try {await this.store.abort({matchId,reason:'match_initialization_failed'});}
        catch(e){this.onError('startup_abort_pending',e);}
      }
      for(const {session} of roster){
        this.occupied.delete(session.userId);
        send(session,{type:'error',code:'match_setup_failed'});
      }
      this.onError('match_setup_failed',error);
    }
  }
  input(session,seq,raw){
    if(!Number.isSafeInteger(seq)||seq<1||seq>2_000_000_000)return false;
    const presence=this.occupied.get(session.userId);
    if(!presence||presence.kind!=='playing'||presence.matchId!==session.matchId)return false;
    const match=this.matches.get(presence.matchId);
    if(!match||match.status!=='active'||!session.verified||session.disconnectedAt)return false;
    const now=this.clock();
    if(!session.rate||now-session.rate.since>=1000)session.rate={since:now,count:0};
    if(++session.rate.count>MAX_MESSAGES_PER_SEC)return false;
    if(seq<=(session.lastCommandSeq??0))return false;
    if(seq>(session.lastCommandSeq??0)+1000)return false;
    const action=sanitizeArenaAction(raw);
    if(!action)return false;
    session.lastCommandSeq=seq;
    // Invariant: authenticated connection chooses no seat; server owns it.
    const allowed=command(match.state,presence.slot,action);
    if(allowed)send(session,{type:'command_ack',seq,serverTick:match.state.tick});
    return allowed;
  }
  reattach(session){
    const current=this.occupied.get(session.userId);
    if(!current||current.kind!=='playing')return false;
    const match=this.matches.get(current.matchId);
    if(!match||match.status!=='active')return false;
    const seat=match.roster.find(r=>r.slot===current.slot);
    if(!seat)return false;
    // Character identity is frozen by the original verified match roster.
    // A profile switch during a network drop must not impersonate another hero,
    // reset another hero's level, or change the already reserved Diamond stake.
    session.hero=match.state.players[current.slot]?.hero||seat.session.hero;
    session.snapshot=seat.session.snapshot;
    seat.session=session;
    session.matchId=match.id;session.slot=current.slot;
    session.lastCommandSeq=0;session.disconnectedAt=null;
    send(session,{type:'match_resume',matchId:match.id,slot:current.slot,state:publicState(match.state)});
    return true;
  }
  disconnect(session,{intentional=false}={}){
    const p=this.occupied.get(session.userId);
    if(!p)return;
    if(p.kind==='queued'){
      const queue=this.queues.get(p.key)||[];
      const next=queue.filter(x=>x.session!==session);
      if(next.length)this.queues.set(p.key,next);else this.queues.delete(p.key);
      this.occupied.delete(session.userId);
    }
    if(p.kind==='playing'){
      const match=this.matches.get(p.matchId);
      const seat=match?.roster.find(r=>r.slot===p.slot);
      if(seat&&seat.session===session)seat.session.disconnectedAt=this.clock()-(intentional?DISCONNECT_GRACE_MS:0);
    }
  }
  async heartbeat(){
    const now=this.clock();
    this.globalTick++;
    for(const [key,q] of this.queues){
      const fresh=q.filter(x=>now-x.joinedAt<=120_000);
      for(const x of q)if(!fresh.includes(x)){this.occupied.delete(x.session.userId);send(x.session,{type:'error',code:'queue_timeout'});}
      if(fresh.length)this.queues.set(key,fresh);else this.queues.delete(key);
    }
    for(const match of [...this.matches.values()]){
      if(match.status!=='active')continue;
      const departed=match.roster.filter(r=>r.session.disconnectedAt!==null &&
        r.session.disconnectedAt!==undefined && now-r.session.disconnectedAt>=DISCONNECT_GRACE_MS);
      if(departed.length){
        const hasA=departed.some(x=>x.team==='A'),hasB=departed.some(x=>x.team==='B');
        if(hasA&&hasB){await this.abort(match,'both_teams_disconnected');continue;}
        match.state.result={winner:hasA?'B':'A',reason:'disconnect_forfeit'};
        match.state.status='finished';
      }else {
        try {tick(match.state);}catch(error){this.onError('engine_tick_failed',error);await this.abort(match,'engine_tick_failed');continue;}
      }
      if(match.state.result||match.state.status!=='active'){
        await this.settle(match);
      }else if(this.globalTick%SNAPSHOT_EVERY===0){
        const state=publicState(match.state);
        for(const {session} of match.roster)if(!session.disconnectedAt)
          send(session,{type:'snapshot',matchId:match.id,state});
      }
    }
  }
  async settle(match){
    if(match.settling||match.status!=='active')return;
    match.settling=true;
    const winner=match.state.result?.winner;
    const allowed=winner==='A'||winner==='B'?winner:'DRAW';
    try{
      const receipt=await this.store.settle({matchId:match.id,winner:allowed,
        reason:match.state.result?.reason||'engine_result'});
      if(receipt?.settled!==true&&receipt?.reason!=='already_settled')
        throw Error('ranked_settlement_unconfirmed');
      match.status='settled';
      for(const {session} of match.roster){
        this.occupied.delete(session.userId);
        send(session,{type:'match_end',matchId:match.id,winner:allowed,
          result:match.state.result,confirmed:true});
      }
      this.matches.delete(match.id);
    }catch(error){
      this.onError('settlement_pending',error);
      // No client success and no local Diamond mutation until DB settlement.
      match.status='pending_settlement';
      for(const {session} of match.roster)send(session,{type:'error',code:'settlement_pending'});
    }finally{match.settling=false;}
  }
  async abort(match,reason){
    if(match.status!=='active')return;
    match.status='aborting';
    try{
      await this.store.abort({matchId:match.id,reason});
      for(const {session} of match.roster){
        this.occupied.delete(session.userId);
        send(session,{type:'match_aborted',matchId:match.id,reason});
      }
      this.matches.delete(match.id);
    }catch(error){
      match.status='pending_abort';
      this.onError('abort_refund_pending',error);
    }
  }
  async shutdown(){
    for(const match of [...this.matches.values()])await this.abort(match,'server_shutdown');
  }
}
