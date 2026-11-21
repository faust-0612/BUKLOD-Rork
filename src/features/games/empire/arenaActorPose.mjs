/**
 * BUKLOD Arena authoritative combat-state presentation.
 * Visual animation is selected from server-authored action events/timestamps.
 * Never creates a combat event, changes HP, or modifies ranked results.
 */
/**
 * @param {any} state
 * @param {any} actor
 * @param {{actor?:string,type?:string,time?:number}|null} [localCue]
 * @returns {'idle'|'walk'|'attack'|'skill'}
 */
export function arenaActorPose(state,actor,localCue=null) {
  if(!state||!actor)return 'idle';
  const now=Number(state.elapsed)||0;
  const events=Array.isArray(state.events)?state.events:[];
  const last=events.slice(-30).reverse().find(e=>
    e && e.actor===actor.id && ['skill','dash','attack','seal_attack'].includes(e.type) &&
    Number.isFinite(e.time) && e.time<=now && now-e.time<=880);
  let type=last?.type||'';
  // DEV practice receives immediate local cues, while ranked snapshots use only
  // server-confirmed event history. Never attribute another player's VFX to this actor.
  if(!type&&localCue?.actor===actor.id && localCue.time<=now && now-localCue.time<=880)
    type=localCue.type;
  if(type==='skill'||type==='dash')return 'skill';
  if(type==='attack'||type==='seal_attack')return 'attack';
  if(Number.isFinite(actor.lastAttacked)&&actor.lastAttacked>0&&
     now>=actor.lastAttacked&&now-actor.lastAttacked<=850)return 'attack';
  if(Number.isFinite(actor.lastMoveTick)&&actor.lastMoveTick>=state.tick-1)return 'walk';
  return 'idle';
}
