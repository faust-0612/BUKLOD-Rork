/**
 * BUKLOD Arena semantic announcer. Short team-relative phrases are selected
 * entirely from authoritative match event cues, never arbitrary user content.
 * This is presentation-only: no network, reward, identity or combat mutation.
 */
export const ARENA_ANNOUNCEMENTS=Object.freeze({
 self_down: {text:'You have fallen!',priority:10,cooldown:2400},
 ally_down: {text:'An ally has fallen!',priority:7,cooldown:3400},
 enemy_down: {text:'Enemy defeated!',priority:7,cooldown:3400},
 tower_ally: {text:'Our tower has fallen!',priority:10,cooldown:3000},
 tower_enemy: {text:'Enemy tower destroyed!',priority:9,cooldown:3000},
 building_ally: {text:'Our building is destroyed!',priority:8,cooldown:4200},
 building_enemy: {text:'Enemy building destroyed!',priority:7,cooldown:4200},
 seal_ally: {text:'Our seal is broken! Defend the base!',priority:10,cooldown:4800},
 seal_enemy: {text:'Enemy seal breached!',priority:10,cooldown:4800},
 seal_restored: {text:'Our seal has been restored!',priority:8,cooldown:4800},
 tower_upgrade: {text:'Tower upgraded!',priority:6,cooldown:5500},
 build_complete: {text:'Construction complete!',priority:6,cooldown:5700},
 item_drop: {text:'Rare loot found!',priority:5,cooldown:7000},
 item_pickup: {text:'Item collected!',priority:4,cooldown:6800},
 boss_down: {text:'Guardian defeated!',priority:8,cooldown:4500},
 final_hunt: {text:'Final battle has begun!',priority:9,cooldown:5000},
 victory: {text:'Victory! Well played!',priority:10,cooldown:2000},
 defeat: {text:'Defeat. Fight again!',priority:10,cooldown:2000},
 round_win: {text:'Round won!',priority:7,cooldown:2500},
 round_loss: {text:'Round lost!',priority:7,cooldown:2500},
 round_start: {text:'Battle!',priority:5,cooldown:1400},
});
const own=Object.prototype.hasOwnProperty;
export function arenaAnnouncementForCue(cue) {
  const id=typeof cue==='string'?cue:cue?.id;
  if(typeof id!=='string'||!own.call(ARENA_ANNOUNCEMENTS,id))return null;
  return Object.freeze({id,...ARENA_ANNOUNCEMENTS[id]});
}
export function selectArenaAnnouncement(cues,lastVoiceAt,now,minGap=3200) {
  if(!Array.isArray(cues)||!Number.isFinite(now))return null;
  const announceable=cues.map(arenaAnnouncementForCue).filter(Boolean)
    .sort((a,b)=>b.priority-a.priority);
  if(!announceable.length)return null;
  const top=announceable[0];
  const gap=Math.max(top.cooldown,Number(minGap)||3200);
  if(now-(Number(lastVoiceAt)||0)<gap)return null;
  return top;
}
