/** Map options use the existing BUKLOD Arena names/art direction, not new asset hunts.
 * Geometry is normalized and mirrored economically between teams. Difficulty is
 * the PvE/terrain challenge, NEVER a hidden reward multiplier or unfair side buff.
 */
export const ARENA_MAPS=Object.freeze({
 genesis_rift:Object.freeze({name:'Genesis Rift',identity:'Crystal rifts / interlocking lanes',difficulty:3,
   biome:'rift',colors:['#111e3d','#28415b','#173643'],mineBias:{wood:1,gold:1.1,stone:1},regenRate:1,
   bossPressure:1.25,hazard:'unstable_rift',hazardInterval:30000,hazardDamage:9,
   cover:[[.29,.23,.025],[.71,.77,.025],[.42,.41,.025],[.58,.59,.025],[.48,.81,.018],[.52,.19,.018]],
   lanes:[.19,.5,.81],shortcuts:[[.35,.25,.48,.5],[.65,.75,.52,.5]],description:'Three crystal lanes, mirrored rift choke points, high-risk boss contests.'}),
 aurora_foundry:Object.freeze({name:'Aurora Foundry',identity:'Goldworks / engineered crossings',difficulty:2,
   biome:'foundry',colors:['#152b32','#36504e','#15393c'],mineBias:{wood:.95,gold:1.22,stone:1},regenRate:.85,
   bossPressure:1.1,hazard:'heat_vent',hazardInterval:36000,hazardDamage:6,
   cover:[[.34,.31,.022],[.66,.69,.022],[.44,.69,.024],[.56,.31,.024]],
   lanes:[.24,.5,.76],shortcuts:[[.31,.5,.5,.27],[.69,.5,.5,.73]],description:'Contested Gold, bridges and timed heat vents reward engineering.'}),
 verdant_fracture:Object.freeze({name:'Verdant Fracture',identity:'Forests / supply lines / ambush',difficulty:1,
   biome:'verdant',colors:['#102e2a','#26563f','#153c49'],mineBias:{wood:1.2,gold:.9,stone:1},regenRate:1.2,
   bossPressure:1,hazard:'none',hazardInterval:0,hazardDamage:0,
   cover:[[.31,.32,.02],[.69,.68,.02],[.43,.78,.024],[.57,.22,.024]],
   lanes:[.21,.5,.79],shortcuts:[[.39,.5,.48,.18],[.61,.5,.52,.82]],description:'Open tree routes, faster Wood renewal and easier wildlife encounters.'})
});
export function getArenaMap(id){const map=ARENA_MAPS[id];if(!map)throw Error('Unknown Arena map');return map}
export function terrainFor(mode,worldW,worldH,mapId){
 const cfg=getArenaMap(mapId),cover=cfg.cover.map(([nx,ny,nr])=>[nx*worldW,ny*worldH,nr*Math.min(worldW,worldH)]);
 return {cfg,cover,lanes:cfg.lanes.map(y=>y*worldH),shortcuts:cfg.shortcuts.map(([a,b,c,d])=>[[a*worldW,b*worldH],[c*worldW,d*worldH]])};
}
export function mapDifficultySummary(mapId){const m=getArenaMap(mapId);return `${m.name} · difficulty ${m.difficulty}/3 · ${m.identity}`}