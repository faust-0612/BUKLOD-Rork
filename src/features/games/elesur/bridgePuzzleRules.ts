/** ELESUR Bridge Puzzle: Hashi-style finite island connections with crossing/load guards. */
export type BridgeNode={id:number;x:number;y:number;target:number};
export type BridgeEdge={id:string;a:number;b:number;count:number;axis:'h'|'v'};
type BridgeLevel={nodes:BridgeNode[];solution:Record<string,number>;maxMoves:number};
export type BridgeRun={
 level:number;nodes:BridgeNode[];edges:BridgeEdge[];
 moves:number;history:BridgeEdge[][];hints:number;
 status:'playing'|'won'|'lost';score:number;
};
const nodes=(places:[number,number,number][]):BridgeNode[]=>
 places.map(([x,y,target],id)=>({id,x,y,target}));
export const BRIDGE_LEVELS:readonly BridgeLevel[]=[
 {nodes:nodes([[0,0,2],[2,0,2],[0,2,2],[2,2,2]]),
  solution:{'0-1':1,'0-2':1,'1-3':1,'2-3':1},maxMoves:24},
 {nodes:nodes([[0,0,2],[2,0,4],[4,0,2],[0,2,2],[2,2,4],[4,2,2]]),
  solution:{'0-1':1,'1-2':1,'0-3':1,'1-4':2,'2-5':1,'3-4':1,'4-5':1},maxMoves:38},
 {nodes:nodes([[0,0,2],[2,0,2],[4,0,2],[0,2,3],[4,2,3],[0,4,2],[2,4,2],[4,4,2]]),
  solution:{'0-1':1,'1-2':1,'2-4':1,'4-7':1,'6-7':1,
   '5-6':1,'3-5':1,'0-3':1,'3-4':1},maxMoves:52},
];
const key=(a:number,b:number)=>Math.min(a,b)+'-'+Math.max(a,b);
function crossing(x:BridgeEdge,y:BridgeEdge,nodes:BridgeNode[]):boolean{
 if(x.axis===y.axis)return false;
 const h=x.axis==='h'?x:y,v=x.axis==='v'?x:y;
 const ha=nodes[h.a],hb=nodes[h.b],va=nodes[v.a],vb=nodes[v.b];
 return va.x>Math.min(ha.x,hb.x)&&va.x<Math.max(ha.x,hb.x)&&
  ha.y>Math.min(va.y,vb.y)&&ha.y<Math.max(va.y,vb.y);
}
export function bridgeCandidates(places:readonly BridgeNode[]):BridgeEdge[]{
 const found=new Map<string,BridgeEdge>();
 for(const n of places){
  for(const axis of ['h','v'] as const){
   for(const sign of [-1,1]){
    const suitable=places.filter(p=>p.id!==n.id&&
      (axis==='h'?p.y===n.y&&Math.sign(p.x-n.x)===sign:
       p.x===n.x&&Math.sign(p.y-n.y)===sign))
      .sort((a,b)=>axis==='h'?Math.abs(a.x-n.x)-Math.abs(b.x-n.x):Math.abs(a.y-n.y)-Math.abs(b.y-n.y));
    if(suitable.length){
     const p=suitable[0],id=key(n.id,p.id);
     found.set(id,{id,a:Math.min(n.id,p.id),b:Math.max(n.id,p.id),count:0,axis});
    }
   }
  }
 }
 return [...found.values()].sort((a,b)=>a.a-b.a||a.b-b.b);
}
export function bridgeDegrees(run:BridgeRun):number[]{
 const deg=run.nodes.map(()=>0);
 for(const edge of run.edges){deg[edge.a]+=edge.count;deg[edge.b]+=edge.count;}
 return deg;
}
export function bridgeIsConnected(run:BridgeRun):boolean{
 const reachable=new Set<number>([run.nodes[0].id]),queue=[run.nodes[0].id];
 for(let i=0;i<queue.length;i++)for(const e of run.edges){
  if(e.count===0)continue;
  const next=e.a===queue[i]?e.b:e.b===queue[i]?e.a:-1;
  if(next>=0&&!reachable.has(next)){reachable.add(next);queue.push(next);}
 }
 return reachable.size===run.nodes.length;
}
export function bridgeSolved(run:BridgeRun):boolean{
 return bridgeDegrees(run).every((value,i)=>value===run.nodes[i].target)&&bridgeIsConnected(run);
}
export function createBridgeRound(level:number):BridgeRun{
 const cfg=BRIDGE_LEVELS[level];
 if(!cfg||!Number.isInteger(level))throw Error('Invalid bridge level');
 return {level,nodes:cfg.nodes.map(n=>({...n})),edges:bridgeCandidates(cfg.nodes),moves:0,
  history:[],hints:0,status:'playing',score:0};
}
export function setBridge(run:BridgeRun,id:string,count:number):BridgeRun{
 if(run.status!=='playing')throw Error('Bridge round finished');
 if(!Number.isInteger(count)||count<0||count>2)throw Error('Invalid bridge capacity');
 const chosen=run.edges.find(e=>e.id===id);if(!chosen)throw Error('Unknown bridge edge');
 if(chosen.count===count)return run;
 const next=run.edges.map(e=>e.id===id?{...e,count}:e);
 const trial={...run,edges:next};
 const degrees=bridgeDegrees(trial);
 if(degrees.some((degree,i)=>degree>run.nodes[i].target))return run;
 if(next.some((a,i)=>a.count>0&&next.some((b,j)=>j>i&&b.count>0&&crossing(a,b,run.nodes))))return run;
 const moves=run.moves+1,won=bridgeSolved(trial);
 const lost=moves>=BRIDGE_LEVELS[run.level].maxMoves&&!won;
 return {...trial,moves,history:[...run.history,run.edges.map(e=>({...e}))],
  status:won?'won':lost?'lost':'playing',
  score:won?Math.max(120,1500-moves*16-run.hints*120):0};
}
export function cycleBridge(run:BridgeRun,id:string):BridgeRun{
 const e=run.edges.find(x=>x.id===id);if(!e)throw Error('Unknown bridge edge');
 return setBridge(run,id,(e.count+1)%3);
}
export function undoBridge(run:BridgeRun):BridgeRun{
 if(run.status!=='playing'||!run.history.length)return run;
 const previous=run.history[run.history.length-1];
 return {...run,edges:previous,moves:Math.max(0,run.moves-1),history:run.history.slice(0,-1)};
}
export function hintBridge(run:BridgeRun):BridgeRun{
 if(run.status!=='playing')return run;
 const answer=BRIDGE_LEVELS[run.level].solution;
 for(const edge of run.edges){
  const target=answer[edge.id]||0;
  if(edge.count<target){
   const next=setBridge(run,edge.id,edge.count+1);
   if(next!==run)return {...next,hints:run.hints+1,score:next.status==='won'?
     Math.max(120,next.score-120):0};
  }
 }
 return run;
}
