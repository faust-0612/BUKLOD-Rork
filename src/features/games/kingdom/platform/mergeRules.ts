/** BUKLOD Kingdom 4×4 merge logic. No player cash/Character Points. */
export type MergeGameId = 'mitch-color-merge' | 'angel-treasure-merge' | 'vhen-farm-merge';
export type MergeDirection = 'up' | 'down' | 'left' | 'right';
export type MergeBoard = number[][];
export type MergeRound = {
 gameId:MergeGameId; level:number; board:MergeBoard; rng:number;
 moves:number; score:number; highest:number; goal:number; maxMoves:number;
 status:'playing'|'won'|'lost'; lastGained:number;
};
export const MERGE_LEVELS:Record<MergeGameId,readonly {goal:number;maxMoves:number;seed:number}[]>={
 'mitch-color-merge':[{goal:16,maxMoves:36,seed:79131},{goal:32,maxMoves:56,seed:79133},{goal:64,maxMoves:82,seed:79139}],
 'angel-treasure-merge':[{goal:16,maxMoves:36,seed:89141},{goal:32,maxMoves:58,seed:89147},{goal:64,maxMoves:88,seed:89153}],
 'vhen-farm-merge':[{goal:16,maxMoves:38,seed:99157},{goal:32,maxMoves:56,seed:99161},{goal:64,maxMoves:90,seed:99167}],
};
const clone=(board:ReadonlyArray<ReadonlyArray<number>>)=>board.map(row=>[...row]);
const rngNext=(seed:number)=>{let x=seed|0; x^=x<<13; x^=x>>>17; x^=x<<5; return x|0;};
function spawn(board:MergeBoard,seed:number):number{
 const empty:{r:number;c:number}[]=[];
 for(let r=0;r<4;r++)for(let c=0;c<4;c++)if(board[r][c]===0)empty.push({r,c});
 if(!empty.length)return seed;
 let next=rngNext(seed||1);
 const cell=empty[(next>>>0)%empty.length];
 next=rngNext(next);
 board[cell.r][cell.c]=(next>>>0)%10===0?4:2;
 return next;
}
const at=(dir:MergeDirection,line:number,index:number):[number,number]=>
 dir==='left'?[line,index]:dir==='right'?[line,3-index]:
 dir==='up'?[index,line]:[3-index,line];
function slide(board:MergeBoard,dir:MergeDirection):{board:MergeBoard;gained:number;changed:boolean}{
 const next=clone(board);let gained=0;
 for(let line=0;line<4;line++){
  const values:number[]=[];
  for(let i=0;i<4;i++){const [r,c]=at(dir,line,i);if(board[r][c])values.push(board[r][c]);}
  const merged:number[]=[];
  for(let i=0;i<values.length;i++){
   if(values[i]===values[i+1]){const v=values[i]*2;merged.push(v);gained+=v;i++;}
   else merged.push(values[i]);
  }
  for(let i=0;i<4;i++){const [r,c]=at(dir,line,i);next[r][c]=merged[i]||0;}
 }
 const changed=next.some((row,r)=>row.some((v,c)=>v!==board[r][c]));
 return {board:next,gained,changed};
}
export function mergeLegalMoves(board:ReadonlyArray<ReadonlyArray<number>>):MergeDirection[]{
 if(board.length!==4||board.some(row=>row.length!==4))return [];
 return (['up','down','left','right'] as MergeDirection[]).filter(dir=>slide(clone(board),dir).changed);
}
export function createMergeRound(gameId:MergeGameId,level:number):MergeRound{
 const config=MERGE_LEVELS[gameId]?.[level];
 if(!config||!Number.isInteger(level))throw Error('Invalid merge world or level');
 const board=Array.from({length:4},()=>[0,0,0,0]);
 let rng=spawn(board,config.seed);rng=spawn(board,rng);
 return {gameId,level,board,rng,moves:0,score:0,highest:4,goal:config.goal,maxMoves:config.maxMoves,
  status:'playing',lastGained:0};
}
export function moveMerge(run:MergeRound,dir:MergeDirection):MergeRound{
 if(run.status!=='playing')throw Error('Merge round already finished');
 if(!(['up','down','left','right'] as string[]).includes(dir))throw Error('Invalid merge direction');
 const {board,gained,changed}=slide(run.board,dir);
 if(!changed)return run;
 const rng=spawn(board,run.rng);
 const highest=Math.max(...board.flat());
 const moves=run.moves+1;
 const won=highest>=run.goal;
 const lost=!won&&(moves>=run.maxMoves||mergeLegalMoves(board).length===0);
 return {...run,board,rng,moves,highest,score:run.score+gained,lastGained:gained,
  status:won?'won':lost?'lost':'playing'};
}
