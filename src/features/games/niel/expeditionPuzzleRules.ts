/** Niel Expedition Puzzle: route planning with objective, terrain and supply constraints. */
export type ExpeditionNode={id:number;name:string;x:number;y:number};
export type ExpeditionEdge={a:number;b:number;food:number;water:number;risk:number};
export type ExpeditionMap={
 nodes:ExpeditionNode[];edges:ExpeditionEdge[];
 required:number[];start:number;exit:number;food:number;water:number;maxRisk:number;
};
export type ExpeditionRun={
 level:number;position:number;food:number;water:number;risk:number;visited:number[];
 history:number[];steps:number;status:'playing'|'won'|'lost';score:number;
};
const N=(names:string[]):ExpeditionNode[]=>names.map((name,id)=>({
 id,name,x:40+(id%4)*92,y:46+Math.floor(id/4)*118,
}));
const E=(a:number,b:number,food:number,water:number,risk=0):ExpeditionEdge=>({a,b,food,water,risk});
export const EXPEDITION_MAPS:readonly ExpeditionMap[]=[
 {nodes:N(['Base','Creek','Ridge','Signal','Forest','Exit']),
  edges:[E(0,1,1,1),E(1,2,2,1),E(2,3,1,2),E(3,4,1,1),E(4,5,1,1),
   E(0,2,4,3,1),E(1,3,3,3,1),E(3,5,4,3,1)],
  start:0,exit:5,required:[1,3],food:8,water:8,maxRisk:3},
 {nodes:N(['Base','Crossing','Scout','Shelter','Radio','Pass','Exit']),
  edges:[E(0,1,1,1),E(1,2,2,2),E(2,3,2,1),E(3,4,1,2),E(4,5,2,1),E(5,6,1,1),
   E(0,3,5,3,2),E(2,5,4,4,2),E(1,4,6,5,3)],
  start:0,exit:6,required:[2,4],food:12,water:11,maxRisk:4},
 {nodes:N(['Base','Waypoint','Trail','Canyon','Outpost','Forest','Beacon','Exit']),
  edges:[E(0,1,1,2),E(1,2,2,1),E(2,3,2,2),E(3,4,1,1),E(4,5,2,2),E(5,6,2,2),E(6,7,1,1),
   E(0,3,6,4,2),E(2,5,5,5,1),E(3,6,5,4,3),E(1,4,5,6,2)],
  start:0,exit:7,required:[1,4,6],food:14,water:14,maxRisk:5},
];
export function createExpeditionRun(level:number):ExpeditionRun{
 const m=EXPEDITION_MAPS[level];
 if(!m||!Number.isInteger(level))throw Error('Invalid expedition mission');
 return {level,position:m.start,food:m.food,water:m.water,risk:0,visited:[m.start],
  history:[m.start],steps:0,status:'playing',score:0};
}
export function expeditionNeighbors(run:ExpeditionRun):{node:ExpeditionNode;edge:ExpeditionEdge}[]{
 const map=EXPEDITION_MAPS[run.level];
 return map.edges.filter(e=>e.a===run.position||e.b===run.position)
  .map(edge=>({edge,node:map.nodes[edge.a===run.position?edge.b:edge.a]}));
}
export function moveExpedition(run:ExpeditionRun,nextNode:number):ExpeditionRun{
 if(run.status!=='playing')throw Error('Expedition already finished');
 const cfg=EXPEDITION_MAPS[run.level];
 const match=expeditionNeighbors(run).find(n=>n.node.id===nextNode);
 if(!match)return run;
 const {food,water,risk}=match.edge;
 if(food>run.food||water>run.water)return run;
 const nextFood=run.food-food,nextWater=run.water-water,nextRisk=run.risk+risk;
 const visited=run.visited.includes(nextNode)?run.visited:[...run.visited,nextNode];
 const steps=run.steps+1;
 const done=nextNode===cfg.exit&&cfg.required.every(id=>visited.includes(id));
 const danger=nextRisk>cfg.maxRisk;
 const exhausted=!done&&nextFood+nextWater<=0;
 const status=done?'won':danger||exhausted?'lost':'playing';
 const score=done?Math.max(100,1500+nextFood*35+nextWater*35-nextRisk*70-steps*25):0;
 return {...run,position:nextNode,food:nextFood,water:nextWater,risk:nextRisk,visited,
  history:[...run.history,nextNode],steps,status,score};
}
/** Exhaustive finite-state planner used to reject unreachable authored levels. */
export function expeditionHasSolution(level:number):boolean{
 const cfg=EXPEDITION_MAPS[level];if(!cfg)return false;
 const init=createExpeditionRun(level),queue=[init],seen=new Set<string>();
 for(let i=0;i<queue.length&&i<70000;i++){
  const r=queue[i];
  if(r.status==='won')return true;
  if(r.status!=='playing')continue;
  const id=[r.position,r.food,r.water,r.risk,[...r.visited].sort((a,b)=>a-b).join(',')].join('|');
  if(seen.has(id))continue;
  seen.add(id);
  for(const {node} of expeditionNeighbors(r)){
   const next=moveExpedition(r,node.id);
   if(next!==r)queue.push(next);
  }
 }
 return false;
}
