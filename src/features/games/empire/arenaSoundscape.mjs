/**
 * BUKLOD Empire Arena: semantic event score + noise-safe local soundscape.
 * Pure deterministic presenter, shared by offline and ranked snapshots.
 * Does not invoke API, mutate combat state, alter economy, or trust user identity.
 *
 * Every cue is backed by a compiled-in CC0 Kingdom SFX. A sound can be reused
 * at different playback rates, but the event meaning and cooldown stay distinct.
 */
export const ARENA_SOUND_CUE = Object.freeze({
  impact:         {sound:'build_hit', rate:1.05,volume:.20,priority:1,cooldown:165},
  minion_wave:    {sound:'enter',rate:.90,volume:.14,priority:1,cooldown:6500},
  minion_clash:   {sound:'beat_hit',rate:1.30,volume:.11,priority:1,cooldown:1000},
  minion_mend:    {sound:'pickup',rate:1.21,volume:.13,priority:1,cooldown:2100},
  minion_siege:   {sound:'build_hit',rate:.75,volume:.24,priority:2,cooldown:2200},
  minion_down:    {sound:'beat_hit',rate:.83,volume:.13,priority:1,cooldown:1500},
  skill:          {sound:'unlock', rate:1.08,volume:.29,priority:2,cooldown:200},
  dash:           {sound:'ui_tap',rate:1.10,volume:.16,priority:1,cooldown:550},
  ally_down:      {sound:'retry',rate:.88,volume:.43,priority:6,cooldown:100},
  self_down:      {sound:'retry',rate:.78,volume:.48,priority:9,cooldown:100},
  enemy_down:     {sound:'beat_combo',rate:1.10,volume:.38,priority:6,cooldown:160},
  ally_unit_down: {sound:'retry',rate:1.04,volume:.27,priority:3,cooldown:850},
  enemy_unit_down:{sound:'beat_hit',rate:1.08,volume:.25,priority:2,cooldown:850},
  tower_ally:     {sound:'build_hit',rate:.73,volume:.45,priority:9,cooldown:200},
  tower_enemy:    {sound:'beat_combo',rate:.79,volume:.43,priority:8,cooldown:200},
  building_ally:  {sound:'build_hit',rate:.81,volume:.4,priority:7,cooldown:350},
  building_enemy: {sound:'beat_combo',rate:.9,volume:.37,priority:6,cooldown:350},
  seal_ally:      {sound:'retry',rate:.75,volume:.48,priority:10,cooldown:200},
  seal_enemy:     {sound:'victory',rate:.95,volume:.47,priority:10,cooldown:200},
  seal_restored:  {sound:'victory_alt',rate:1.00,volume:.36,priority:7,cooldown:650},
  build_start:    {sound:'build_hit',rate:1.07,volume:.27,priority:3,cooldown:320},
  build_complete: {sound:'enter',rate:1.02,volume:.35,priority:5,cooldown:290},
  tower_upgrade_start:{sound:'build_hit',rate:1.17,volume:.27,priority:3,cooldown:500},
  tower_upgrade:  {sound:'unlock',rate:.93,volume:.39,priority:6,cooldown:440},
  tower_repair:   {sound:'build_hit',rate:1.19,volume:.20,priority:2,cooldown:650},
  mining_wood:    {sound:'build_hit',rate:1.23,volume:.18,priority:1,cooldown:530},
  mining_stone:   {sound:'build_hit',rate:.88,volume:.21,priority:1,cooldown:530},
  mining_gold:    {sound:'coins',rate:1.03,volume:.22,priority:1,cooldown:530},
  deposit:        {sound:'coins',rate:.97,volume:.26,priority:2,cooldown:400},
  recruit:        {sound:'enter',rate:1.07,volume:.25,priority:2,cooldown:980},
  order:          {sound:'mission_go',rate:1.07,volume:.24,priority:2,cooldown:600},
  item_drop:      {sound:'pickup',rate:1.24,volume:.32,priority:4,cooldown:330},
  item_pickup:    {sound:'pickup',rate:1.08,volume:.35,priority:4,cooldown:210},
  item_equip:     {sound:'unlock',rate:1.22,volume:.35,priority:5,cooldown:320},
  item_use:       {sound:'pickup',rate:.90,volume:.3,priority:3,cooldown:250},
  buff_forest:    {sound:'pickup',rate:1.19,volume:.28,priority:3,cooldown:450},
  buff_golden:    {sound:'coins',rate:1.13,volume:.29,priority:3,cooldown:450},
  buff_stone:     {sound:'build_hit',rate:1.19,volume:.25,priority:3,cooldown:450},
  buff_lumen:     {sound:'unlock',rate:1.28,volume:.32,priority:3,cooldown:450},
  buff_forager:   {sound:'pickup',rate:.82,volume:.30,priority:3,cooldown:450},
  buff_wisp:      {sound:'ui_confirm',rate:1.28,volume:.30,priority:3,cooldown:450},
  buff_respawn:   {sound:'ui_tap',rate:1.22,volume:.12,priority:1,cooldown:2500},
  boss_hit:       {sound:'build_hit',rate:.78,volume:.24,priority:2,cooldown:600},
  buff_chirp:     {sound:'ui_confirm',rate:1.26,volume:.10,priority:1,cooldown:8500},
  boss_down:      {sound:'victory_alt',rate:.82,volume:.4,priority:7,cooldown:600},
  hero_respawn:   {sound:'enter',rate:.96,volume:.36,priority:5,cooldown:400},
  level_up:       {sound:'unlock',rate:1.0,volume:.32,priority:4,cooldown:300},
  map_hazard:     {sound:'build_hit',rate:.70,volume:.27,priority:3,cooldown:950},
  trap:           {sound:'beat_hit',rate:.87,volume:.25,priority:3,cooldown:800},
  seal_damage:    {sound:'build_hit',rate:.79,volume:.24,priority:3,cooldown:800},
  final_hunt:     {sound:'mission_go',rate:.85,volume:.42,priority:7,cooldown:350},
  victory:        {sound:'victory',rate:1,volume:.48,priority:10,cooldown:200},
  defeat:         {sound:'retry',rate:.89,volume:.47,priority:10,cooldown:200},
  draw:           {sound:'ui_confirm',rate:.91,volume:.33,priority:7,cooldown:200},
  round_win:      {sound:'victory_alt',rate:1.07,volume:.40,priority:7,cooldown:200},
  round_loss:     {sound:'retry',rate:1.02,volume:.40,priority:7,cooldown:200},
  round_start:    {sound:'enter',rate:1.12,volume:.32,priority:4,cooldown:1000},
});
const has=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const typeOf=e=>typeof e?.type==='string'?e.type:'';
const playerTeam=(id,ctx)=>{
  if(typeof id!=='string')return null;
  const p=ctx.players?.[id] ?? ctx.minions?.find?.(u=>u.id===id) ?? ctx.units?.find?.(u=>u.id===id) ??
    ctx.towers?.find?.(t=>t.id===id) ?? ctx.buildings?.find?.(b=>b.id===id);
  if(p?.team==='A'||p?.team==='B')return p.team;
  // Canonical Arena seating is A0..A4/B0..B4. Never infer team from arbitrary IDs.
  return /^[AB][0-4]$/.test(id)?id[0]:null;
};
const perspective=(team,ctx)=>team===ctx.team?'ally':team===null?'neutral':'enemy';
const localActor=(actor,ctx)=>actor===ctx.seat;
function key(id){return has(ARENA_SOUND_CUE,id)?id:null;}
function cueFor(e,ctx){
  const type=typeOf(e);
  const own=ctx.team ?? 'A';
  const seat=ctx.seat ?? 'A0';
  const actor=e.actor ?? e.from;
  const target=e.to ?? e.target;
  const ownerTeam=playerTeam(actor,ctx);
  const targetTeam=playerTeam(target,ctx);
  const ownAction=actor===seat;
  const ownsEvent=e.team===own;
  if(type==='result')return key(e.winner===own?'victory':e.winner==null?'draw':'defeat');
  if(type==='solo_round_end')return key(e.winner===own?'round_win':e.winner==null?'draw':'round_loss');
  if(type==='solo_round_start')return key('round_start');
  if(type==='defeat'){
    // Actor is the killer, 'to' is the victim. Wildlife is not a hero.
    if(['stalker','shellkeeper','forest','golden','stone','lumen','forager','wisp'].includes(e.kind)) return null;
    if(target===seat)return key('self_down');
    if(e.kind&&e.kind!=='hero')return key(targetTeam===own?'ally_unit_down':targetTeam?'enemy_unit_down':null);
    return key(targetTeam===own?'ally_down':targetTeam?'enemy_down':null);
  }
  if(type==='unit_ko'||type==='tower_ko'||type==='boss_ko'||type==='trap_ko'||type==='hazard_ko'||type==='storm_defeat'){
    // Environmental casualties have actor=the victim, others have target=the victim.
    const victim=(type==='hazard_ko'||type==='storm_defeat')?e.actor:target;
    if(victim===seat)return key('self_down');
    const victimTeam=playerTeam(victim,ctx);
    const hero=Boolean(ctx.players?.[victim]);
    return key(victimTeam===own?(hero?'ally_down':'ally_unit_down'):
      victimTeam?(hero?'enemy_down':'enemy_unit_down'):null);
  }
  if(type==='tower_destroyed')return key(e.team===own?'tower_ally':'tower_enemy');
  if(type==='building_destroyed')return key(e.team===own?'building_ally':'building_enemy');
  if(type==='seal_breached')return key(e.team===own?'seal_ally':'seal_enemy');
  if(type==='both_seals_breached')return key('final_hunt');
  if(type==='seal_restored')return ownsEvent?'seal_restored':null;
  if(type==='final_hunt')return 'final_hunt';
  if(type==='minion_wave')return 'minion_wave';
  if(type==='minion_ko')return target===seat?'self_down':e.team===own?'minion_down':null;
  if(type==='minion_siege_hit')return e.team===own?'minion_siege':null;
  if(type==='minion_hit'||type==='minion_heal'){
    const player=ctx.players?.[seat];
    const near=player&&Number.isFinite(e.x)&&Number.isFinite(e.y)&&Math.hypot(player.x-e.x,player.y-e.y)<12;
    return near?type==='minion_heal'&&e.team===own?'minion_mend':type==='minion_hit'?'minion_clash':null:null;
  }
  if(type==='damage'||type==='unit_hit'||type==='tower_hit'||type==='boss_hit')return ownAction||target===seat?'impact':null;
  if(type==='skill')return ownAction?'skill':null;
  if(type==='dash')return ownAction?'dash':null;
  if(type==='buff')return ownAction?key('buff_'+e.kind):null;
  if(type==='creature_respawn')return null; // No ambient audio spam far from player
  if(type==='mine')return ownAction?key('mining_'+e.kind):null;
  if(type==='deposit')return ownAction?'deposit':null;
  if(type==='train_order'||type==='unit_spawn')return ownAction||ownsEvent?'recruit':null;
  if(type==='army_order')return ownsEvent?'order':null;
  if(type==='equipment_drop')return ownAction?'item_drop':null;
  if(type==='loot')return ownAction?'item_pickup':null;
  if(type==='equipment_equip'||type==='relic_reinforced')return ownAction?'item_equip':null;
  if(type==='item_consumed')return ownAction?'item_use':null;
  if(type==='construction_start'||type==='rebuild_start')return ownAction?'build_start':null;
  if(type==='construction_complete')return ownsEvent?'build_complete':null;
  if(type==='tower_upgrade_start')return ownAction?'tower_upgrade_start':null;
  if(type==='tower_upgrade')return playerTeam(e.tower,ctx)===own?'tower_upgrade':null;
  if(type==='tower_repair'||type==='villager_repair')return ownAction||ownsEvent?'tower_repair':null;
  if(type==='respawn')return e.actor===seat?'hero_respawn':null;
  if(type==='level_up')return ownAction?'level_up':null;
  if(type==='map_hazard')return e.actor===seat?'map_hazard':null;
  if(type==='trap_hit')return e.target===seat?'trap':null;
  if(type==='seal_damage')return e.team===own?'seal_damage':null;
  if(type==='hunter_reward'||type==='boss_defeat')return ownAction?'boss_down':null;
  return null;
}
export function arenaCueForEvent(event,context={}) {
  if(!event||typeof event!=='object')return null;
  const ctx={team:'A',seat:'A0',players:{},units:[],minions:[],...context};
  const id=cueFor(event,ctx);
  return id?Object.freeze({id,...ARENA_SOUND_CUE[id]}):null;
}
export function drainArenaSoundscape(events,previousSeq,currentSeq,context={},limit=3) {
  const start=Number.isSafeInteger(previousSeq)?previousSeq:0;
  const end=Number.isSafeInteger(currentSeq)?currentSeq:start;
  if(!Array.isArray(events)||end<=start)return {lastSeq:Math.max(start,end),cues:[]};
  const sorted=events.filter(e=>Number.isSafeInteger(e?.seq)&&e.seq>start&&e.seq<=end)
    .sort((a,b)=>a.seq-b.seq).slice(-72);
  const scheduled=sorted.map(e=>({seq:e.seq,cue:arenaCueForEvent(e,context)}))
    .filter(x=>x.cue);
  // Preserve critical outcomes even during a barrage of combat damage events.
  // Avoid repeated identical low-priority ticks in a single drain window.
  const deduped=[];
  const seen=new Set();
  for(let i=scheduled.length-1;i>=0;i--){
    const item=scheduled[i];
    const recurring=item.cue.priority<5;
    if(recurring&&seen.has(item.cue.id))continue;
    seen.add(item.cue.id);
    deduped.push(item);
  }
  const selected=deduped.sort((a,b)=>b.cue.priority-a.cue.priority||b.seq-a.seq)
    .slice(0,Math.max(0,Math.min(3,Number(limit)||3)))
    .sort((a,b)=>a.seq-b.seq).map(x=>x.cue);
  return {lastSeq:end,cues:selected};
}
export const ARENA_VISUAL_EVENT_TYPES=Object.freeze(new Set([
  'damage','defeat','unit_ko','minion_hit','minion_siege_hit','minion_ko','minion_heal','minion_wave','tower_ko','boss_ko','trap_ko','storm_defeat','tower_destroyed','building_destroyed',
  'seal_breached','seal_restored','construction_start','construction_complete',
  'tower_upgrade_start','tower_upgrade','tower_repair','villager_repair',
  'equipment_drop','equipment_equip','loot','item_consumed','buff',
  'mine','level_up','skill','dash','trap_hit','map_hazard','boss_hit','tower_hit','boss_defeat',
  'final_hunt','solo_round_end','solo_round_start','unit_spawn',
]));


/** Quiet proximate buff/magic chirp. Up to one event every 8.5 seconds per
 * semantic sound ID, even during 10 Hz simulation or 5v5 spectator feeds. */
export function nearbyArenaBuffCue(state,seat='A0') {
  const player=state?.players?.[seat];
  if(!player||!player.alive||state?.status!=='active')return null;
  const creatures=Array.isArray(state.creatures)?state.creatures:[];
  const buffs=creatures.filter(c=>c&&c.alive&&
    ['forest','golden','stone','lumen','forager','wisp'].includes(c.kind)&&
    Math.hypot(c.x-player.x,c.y-player.y)<=10);
  if(!buffs.length)return null;
  buffs.sort((a,b)=>Math.hypot(a.x-player.x,a.y-player.y)-Math.hypot(b.x-player.x,b.y-player.y));
  const first=buffs[0];
  const cue=ARENA_SOUND_CUE['buff_'+first.kind] || ARENA_SOUND_CUE.buff_chirp;
  // Same timbre but quieter and slower than the pickup notification.
  return {id:'nearby_'+first.kind,sound:cue.sound,
    rate:Math.max(.76,Math.min(1.2,cue.rate*.91)),volume:.105,priority:1,cooldown:8500};
}
