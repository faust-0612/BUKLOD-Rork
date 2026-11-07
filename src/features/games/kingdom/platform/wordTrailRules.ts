/** Offline 4x4 word-connection engine with guaranteed adjacent solution paths. */
export type WordGameId='trudice-word-garden'|'niel-word-explorer';
export type WordCell={row:number;col:number};
type LevelSpec={words:readonly string[];seed:number};
export const WORD_LEVELS:Record<WordGameId,readonly LevelSpec[]>={
 'trudice-word-garden':[
  {words:['BLOOM','GROW','PETAL'],seed:5211},
  {words:['TANIM','DAHON','SIBOL'],seed:5231},
  {words:['GARDEN','FLOWER','SEED'],seed:5271},
 ],
 'niel-word-explorer':[
  {words:['MAP','TRAIL','CAMP'],seed:6113},
  {words:['FOREST','RIVER','ROCK'],seed:6133},
  {words:['COMPASS','ISLAND','SEA'],seed:6173},
 ],
};
export type WordRound={gameId:WordGameId;level:number;board:string[][];words:string[];
 path:WordCell[];found:string[];attempts:number;score:number;status:'playing'|'won'};
const SIZE=4;
const key=(c:WordCell)=>c.row+':'+c.col;
export function wordSnakePath():WordCell[]{
 return Array.from({length:16},(_,i)=>({row:Math.floor(i/4),col:Math.floor(i/4)%2===0?i%4:3-i%4}));
}
function rotate(p:WordCell,quadrants:number):WordCell{
 let {row,col}=p;
 for(let q=0;q<quadrants;q++){const nextRow=col;col=SIZE-1-row;row=nextRow;}
 return {row,col};
}
export function createWordRound(gameId:WordGameId,level:number):WordRound{
 const spec=WORD_LEVELS[gameId]?.[level];
 if(!spec||!Number.isInteger(level))throw Error('Invalid word world or level');
 const letters=spec.words.join('').split('');
 if(letters.length>16||spec.words.some(w=>!/^[A-Z]{3,8}$/.test(w)))throw Error('Invalid word bank');
 const board=Array.from({length:4},()=>['A','E','O','I']);
 const cells=wordSnakePath().map(p=>rotate(p,spec.seed%4));
 for(let i=0;i<16;i++){
  const filler=['A','E','I','O','U','S','N','R'];
  board[cells[i].row][cells[i].col]=letters[i]??filler[(spec.seed+i*3)%filler.length];
 }
 return {gameId,level,board,words:[...spec.words],path:[],found:[],attempts:0,score:0,status:'playing'};
}
export function wordPathValid(board:readonly (readonly string[])[],path:readonly WordCell[]):boolean{
 if(!Array.isArray(path)||path.length>16)return false;
 const seen=new Set<string>();
 for(let i=0;i<path.length;i++){
  const c=path[i];
  if(!Number.isInteger(c.row)||!Number.isInteger(c.col)||c.row<0||c.col<0||c.row>=SIZE||c.col>=SIZE)return false;
  if(seen.has(key(c)))return false;
  seen.add(key(c));
  if(i>0 && Math.max(Math.abs(c.row-path[i-1].row),Math.abs(c.col-path[i-1].col))!==1)return false;
 }
 return true;
}
export function addWordCell(run:WordRound,cell:WordCell):WordRound{
 if(run.status!=='playing')throw Error('Word round already finished');
 if(!wordPathValid(run.board,[cell]))return run;
 const previous=run.path[run.path.length-1];
 if(previous && key(previous)===key(cell))return run;
 if(run.path.length>=2 && key(run.path[run.path.length-2])===key(cell))
  return {...run,path:run.path.slice(0,-1)};
 const next=[...run.path,cell];
 if(!wordPathValid(run.board,next))return run;
 return {...run,path:next};
}
export function currentWord(run:WordRound):string{
 return run.path.map(c=>run.board[c.row][c.col]).join('');
}
export function clearWordPath(run:WordRound):WordRound{
 return run.path.length?{...run,path:[]}:run;
}
export function submitWordPath(run:WordRound):WordRound{
 if(run.status!=='playing')throw Error('Word round already finished');
 if(!wordPathValid(run.board,run.path))throw Error('Illegal word path');
 const word=currentWord(run);
 const accepted=run.words.includes(word)&&!run.found.includes(word);
 const found=accepted?[...run.found,word]:run.found;
 const completed=found.length===run.words.length;
 return {...run,found,path:[],attempts:run.attempts+1,
  score:run.score+(accepted?word.length*90+Math.max(0,10-run.attempts)*5:0),
  status:completed?'won':'playing'};
}
