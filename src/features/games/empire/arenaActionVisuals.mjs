/** Original action-specific particle direction and world anchoring.
 * This is an entirely visual event adapter (does not change gameplay).
 */
export const ARENA_EFFECT_KIND=Object.freeze({
 damage:'hit',unit_hit:'hit',tower_hit:'hit',boss_hit:'hit',minion_hit:'hit',minion_siege_hit:'hit',
 defeat:'death',unit_ko:'death',minion_ko:'death',tower_ko:'death',trap_ko:'death',
 boss_ko:'death',hazard_ko:'death',storm_defeat:'death',
 skill:'ability',dash:'dash',tower_destroyed:'tower_break',
 building_destroyed:'building_break',seal_breached:'seal_break',
 seal_restored:'seal_restore',tower_upgrade:'upgrade',
 tower_upgrade_start:'build',tower_repair:'repair',villager_repair:'repair',
 construction_start:'build',construction_complete:'built',rebuild_start:'build',
 buff:'buff',minion_heal:'buff',minion_wave:'buff',equipment_drop:'loot',loot:'loot',item_consumed:'item',
 equipment_equip:'item',mine:'mining',map_hazard:'hazard',trap_hit:'trap',
 level_up:'level_up',boss_defeat:'boss_down',solo_round_end:'round',
});
const between=(n,a,b)=>Math.max(a,Math.min(b,Number.isFinite(n)?n:a));
const finite=(n)=>typeof n==='number'&&Number.isFinite(n);
function locate(state,id){
  if(typeof id!=='string')return null;
  const player=state?.players?.[id];if(player)return player;
  for(const key of ['towers','buildings','units','minions','creatures','nodes','loot']) {
    const found=state?.[key]?.find?.(a=>a.id===id);
    if(found)return found;
  }
  return null;
}
export function arenaActionVisuals(state,elapsed,ttl=950,limit=16) {
  if(!state||!Array.isArray(state.events))return [];
  const now=Number(elapsed)||0;
  const maxAge=between(ttl,120,1500);
  const out=[];
  for(let i=state.events.length-1;i>=0&&out.length<between(limit,1,20);i--){
    const e=state.events[i];const kind=ARENA_EFFECT_KIND[e?.type];
    if(!kind||!Number.isSafeInteger(e.seq)||!finite(e.time)||e.time>now||now-e.time>=maxAge)continue;
    let subject=null;
    if(['hit','death','trap'].includes(kind)) subject=locate(state,e.to??e.target??e.actor);
    else if(['tower_break','upgrade','repair'].includes(kind)) subject=locate(state,e.tower);
    else if(['building_break','build','built'].includes(kind))subject=locate(state,e.id??e.building);
    else subject=locate(state,e.actor??e.from);
    // Failed/destroyed objects are kept in state with alive:false. Explicit
    // event world coords are authoritative if they were provided by engine.
    let x=finite(e.x)?e.x:subject?.x;
    let y=finite(e.y)?e.y:subject?.y;
    if((kind==='seal_break'||kind==='seal_restore')&&(!finite(x)||!finite(y))){
      const team=e.team==='B'?'B':'A';
      x=team==='A'?14:state.w-14;
      y=state.h/2;
    }
    if(!finite(x)||!finite(y))continue;
    const age=now-e.time;
    const progress=between(age/maxAge,0,1);
    const style=kind==='ability'?e.style||state.players?.[e.actor]?.role||'burst':
      kind==='buff'?(e.kind||'lumen'):
      kind==='mining'?(e.kind||'stone'):'';
    const source=locate(state,e.from??e.actor);
    const destination=locate(state,e.to??e.target??e.targetId);
    // Prefer authoritative event-time geometry over current positions; a
    // moving opponent must not drag an old impact across the battlefield.
    out.push({seq:e.seq,type:e.type,kind,x,y,style,progress,alpha:1-progress,
      fromX:finite(e.fromX)?e.fromX:source?.x??x,
      fromY:finite(e.fromY)?e.fromY:source?.y??y,
      targetX:finite(e.toX)?e.toX:finite(e.targetX)?e.targetX:destination?.x??x,
      targetY:finite(e.toY)?e.toY:finite(e.targetY)?e.targetY:destination?.y??y,
      actor:e.actor??e.from??'',target:e.to??e.target??'',team:e.team??null,
      amount:Number(e.amount)||0});
  }
  return out.reverse();
}
