/** Music City: original note-sequence memory and rhythm grid gameplay rules. */
export const NOTE_NAMES=['DO','RE','MI','SOL'] as const;
export const MELODY_LEVELS=[
 {notes:[0,2,1],tempoMs:610},
 {notes:[0,1,3,2,0],tempoMs:525},
 {notes:[3,2,0,1,2,3,0],tempoMs:450},
] as const;
export type MelodyRound={level:number;notes:number[];index:number;misses:number;hintUsed:boolean;status:'playing'|'won'|'lost';score:number};
export function createMelodyRound(level:number):MelodyRound{
 const s=MELODY_LEVELS[level];
 if(!s||!Number.isInteger(level))throw Error('Invalid melody level');
 return {level,notes:[...s.notes],index:0,misses:0,hintUsed:false,status:'playing',score:0};
}
export function hintMelody(r:MelodyRound):MelodyRound{
 if(r.status!=='playing'||r.hintUsed)return r;
 return {...r,hintUsed:true};
}
export function enterMelodyNote(r:MelodyRound,note:number):MelodyRound{
 if(r.status!=='playing')throw Error('Melody round already completed');
 if(!Number.isInteger(note)||note<0||note>=NOTE_NAMES.length)throw Error('Invalid melody note');
 if(r.notes[r.index]!==note){
  const misses=r.misses+1;
  return {...r,index:0,misses,status:misses>=3?'lost':'playing'};
 }
 const index=r.index+1;
 const won=index===r.notes.length;
 return {...r,index,status:won?'won':'playing',score:won?
  Math.max(100,r.notes.length*150-r.misses*90-(r.hintUsed?100:0)):r.score};
}
export const BEAT_LANES=['KICK','CLAP','HAT','BELL'] as const;
type BeatConfig={kick:readonly number[];clap:readonly number[];hat:readonly number[];bell:readonly number[]};
export const BEAT_LEVELS:readonly BeatConfig[]=[
 {kick:[0,4],clap:[2,6],hat:[0,2,4,6],bell:[]},
 {kick:[0,3,4,7],clap:[2,6],hat:[0,2,4,6],bell:[4]},
 {kick:[0,4,6],clap:[2,6],hat:[1,3,5,7],bell:[0,4]},
];
export type BeatRound={level:number;target:boolean[][];draft:boolean[][];attempts:number;hintUsed:boolean;status:'playing'|'won'|'lost';score:number};
function emptyBeat():boolean[][]{return Array.from({length:4},()=>Array<boolean>(8).fill(false));}
export function createBeatRound(level:number):BeatRound{
 const cfg=BEAT_LEVELS[level];if(!cfg||!Number.isInteger(level))throw Error('Invalid beat level');
 const target=emptyBeat();
 const patterns=[cfg.kick,cfg.clap,cfg.hat,cfg.bell];
 patterns.forEach((line,track)=>line.forEach(step=>{if(!Number.isInteger(step)||step<0||step>7)throw Error('Invalid authored beat');target[track][step]=true;}));
 return {level,target,draft:emptyBeat(),attempts:0,hintUsed:false,status:'playing',score:0};
}
export function toggleBeat(r:BeatRound,lane:number,step:number):BeatRound{
 if(r.status!=='playing')throw Error('Beat round finished');
 if(!Number.isInteger(lane)||lane<0||lane>3||!Number.isInteger(step)||step<0||step>7)throw Error('Invalid beat cell');
 const draft=r.draft.map(line=>[...line]);draft[lane][step]=!draft[lane][step];
 return {...r,draft};
}
export function hintBeat(r:BeatRound):BeatRound{
 if(r.status!=='playing'||r.hintUsed)return r;
 return {...r,hintUsed:true};
}
export function gradeBeat(r:BeatRound):BeatRound{
 if(r.status!=='playing')throw Error('Beat round finished');
 const match=r.draft.every((row,i)=>row.every((hit,j)=>hit===r.target[i][j]));
 const attempts=r.attempts+1;
 return {...r,attempts,status:match?'won':attempts>=3?'lost':'playing',
  score:match?Math.max(120,1000-(attempts-1)*180-(r.hintUsed?180:0)):0};
}
