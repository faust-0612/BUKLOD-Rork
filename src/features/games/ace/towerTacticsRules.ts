/** Ace Tower Tactics: deterministic grid defense with resource and attack guards. */
export type TowerType='archer'|'cannon'|'scout';
export type GridCell={row:number;col:number};
export type Tower={id:number;row:number;col:number;type:TowerType;level:1|2};
export type Enemy={id:number;step:number;hp:number;maxHp:number};
export type TowerRound={
 level:number;credits:number;health:number;turn:number;
 towers:Tower[];enemies:Enemy[];nextEnemy:number;
 kills:number;score:number;status:'playing'|'won'|'lost';
};
export const TOWER_TYPES:Record<TowerType,{cost:number;range:number;damage:number}>={
 archer:{cost:4,range:3,damage:2},
 cannon:{cost:6,range:2,damage:4},
 scout:{cost:3,range:2,damage:1},
};
export const TOWER_LEVELS=[
 {credits:18,health:4,wave:[6,6,8,8,10,10]},
 {credits:25,health:4,wave:[8,9,10,10,12,12,14,14]},
 {credits:32,health:5,wave:[9,10,11,12,13,14,15,16,18,20]},
] as const;
export const TOWER_PATH:GridCell[]=Array.from({length:7},(_,col)=>({row:3,col}));
export function createTowerRound(level:number):TowerRound{
 const s=TOWER_LEVELS[level];if(!s||!Number.isInteger(level))throw Error('Invalid tower level');
 return {level,credits:s.credits,health:s.health,turn:0,towers:[],enemies:[],
  nextEnemy:0,kills:0,score:0,status:'playing'};
}
const validCell=(row:number,col:number)=>Number.isInteger(row)&&Number.isInteger(col)&&row>=0&&row<7&&col>=0&&col<7;
export function placeTower(run:TowerRound,row:number,col:number,type:TowerType):TowerRound{
 if(run.status!=='playing')throw Error('Tower round finished');
 if(!validCell(row,col)||row===3||!TOWER_TYPES[type]||
    run.towers.some(t=>t.row===row&&t.col===col)||run.credits<TOWER_TYPES[type].cost)
  return run;
 const nextId=run.towers.reduce((max,t)=>Math.max(max,t.id),-1)+1;
 return {...run,credits:run.credits-TOWER_TYPES[type].cost,
  towers:[...run.towers,{id:nextId,row,col,type,level:1}]};
}
export function upgradeTower(run:TowerRound,id:number):TowerRound{
 if(run.status!=='playing')throw Error('Tower round finished');
 const tower=run.towers.find(t=>t.id===id);
 if(!tower||tower.level===2||run.credits<4)return run;
 return {...run,credits:run.credits-4,towers:run.towers.map(t=>t.id===id?{...t,level:2}:t)};
}
const distance=(a:GridCell,b:GridCell)=>Math.abs(a.row-b.row)+Math.abs(a.col-b.col);
export function advanceTowerTurn(run:TowerRound):TowerRound{
 if(run.status!=='playing')throw Error('Tower round finished');
 const config=TOWER_LEVELS[run.level];
 const enemies:Enemy[]=run.enemies.map(e=>({...e}));
 let spawned=run.nextEnemy;
 if(spawned<config.wave.length){
  const hp=config.wave[spawned];enemies.push({id:spawned,step:0,hp,maxHp:hp});spawned++;
 }
 let killed=0;
 for(const tower of run.towers){
  const stat=TOWER_TYPES[tower.type];
  const available=enemies.filter(e=>e.hp>0&&distance(tower,TOWER_PATH[e.step])<=stat.range)
   .sort((a,b)=>b.step-a.step||a.id-b.id);
  if(!available.length)continue;
  available[0].hp-=stat.damage+(tower.level===2?2:0);
  if(available[0].hp<=0)killed++;
 }
 let health=run.health;
 const active:Enemy[]=[];
 for(const e of enemies){
  if(e.hp<=0)continue;
  if(e.step>=TOWER_PATH.length-1){health--;continue;}
  active.push({...e,step:e.step+1});
 }
 const turn=run.turn+1,kills=run.kills+killed;
 const cleared=spawned===config.wave.length&&active.length===0;
 const status:TowerRound['status']=health<=0||turn>=55?'lost':cleared?'won':'playing';
 const credits=run.credits+Math.floor(killed/2);
 const score=status==='won'?Math.max(100,kills*200+health*300+credits*20-turn*10):0;
 return {...run,enemies:active,nextEnemy:spawned,health,turn,kills,credits,score,status};
}
