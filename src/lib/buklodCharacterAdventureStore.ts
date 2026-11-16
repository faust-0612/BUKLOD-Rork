/** User-and-character scoped local adventure journal. Non-credit content only. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ADVENTURE_RELICS, ADVENTURE_STORIES, initialAdventure, performAdventure,
  type AdventureCharacter,type AdventureAction,type AdventureOutcome,type AdventureState,
} from './buklodCharacterAdventure';

const PREFIX='buklod:adventure:preview:v1:';
const pending=new Map<string,Promise<AdventureOutcome>>();
function key(userId:string,character:AdventureCharacter):string {
  if(!/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(userId)) throw new Error('A signed-in BUKLOD account is required');
  if(!Object.hasOwn(ADVENTURE_STORIES,character))throw new Error('Unknown character');
  return PREFIX+userId+':'+character;
}
function bounded(value:unknown,max:number):number {
  const n=Number(value);return Number.isSafeInteger(n)&&n>=0?Math.min(n,max):0;
}
function validStrings(value:unknown,max:number,pattern:RegExp):string[]{
  if(!Array.isArray(value))return [];
  return [...new Set(value.filter(x=>typeof x==='string'&&x.length<110&&pattern.test(x)))].slice(0,max);
}
function parse(raw:string|null,character:AdventureCharacter):AdventureState {
  const fresh=initialAdventure(character);
  if(!raw)return fresh;
  try {
    const data=JSON.parse(raw);
    if(!data||data.version!==1||data.character!==character)return fresh;
    const fragments={...fresh.fragments},relics={...fresh.relics};
    for(const id of ADVENTURE_RELICS) {
      fragments[id]=bounded(data.fragments?.[id],1000);
      relics[id]=Math.min(1,bounded(data.relics?.[id],1));
    }
    const chapters:AdventureState['chapters']={};
    for(const id of ['0','1','2'])if(['heart','courage'].includes(data.chapters?.[id]))chapters[id]=data.chapters[id];
    const gates:number[]=Array.isArray(data.gates)
      ? [...new Set((data.gates as unknown[]).filter((n):n is number =>
        typeof n==='number' && [4,8,12,16].includes(n)))] : [];
    const level=Math.max(1,Math.min(20,bounded(data.level,20)));
    return {version:1,character,fragments,relics,gates,
      xp:bounded(data.xp,1e8),level,ascensions:bounded(data.ascensions,100),
      bond:bounded(data.bond,1e7),hibla:bounded(data.hibla,100000),dust:bounded(data.dust,100000),
      completed:validStrings(data.completed,10000,/^(chapter:|practice:)/),
      chapters,practiceDays:validStrings(data.practiceDays,6000,/^20\d\d-\d\d-\d\d:(wisdom|service|courage)$/),
      giftDays:validStrings(data.giftDays,2000,/^20\d\d-\d\d-\d\d$/),
      lastActiveDay:typeof data.lastActiveDay==='string'&&/^20\d\d-\d\d-\d\d$/.test(data.lastActiveDay)?data.lastActiveDay:null,
      streak:bounded(data.streak,10000),graceAvailable:data.graceAvailable!==false,
      hiddenPaths:bounded(data.hiddenPaths,10000)};
  }catch{return fresh;}
}
/** Philippines has no DST; use a stable calendar day for local-only practice. */
export function adventureManilaDay(now=Date.now()):string {
  return new Date(now+8*60*60*1000).toISOString().slice(0,10);
}
export async function loadCharacterAdventure(userId:string,character:AdventureCharacter):Promise<AdventureState> {
  const storageKey=key(userId,character);
  const queued=pending.get(storageKey);
  if(queued){try{await queued;}catch{/* previous I/O failure should not poison future reads */}}
  return parse(await AsyncStorage.getItem(storageKey),character);
}
/** Serializes user+character writes so rapid taps cannot mint duplicate local rewards. */
export async function actOnCharacterAdventure(userId:string,character:AdventureCharacter,action:AdventureAction):Promise<AdventureOutcome> {
  const storageKey=key(userId,character);
  const previous=pending.get(storageKey);
  const task=(async()=>{
    if(previous){try{await previous;}catch{/* subsequent action retries from persisted state */}}
    const current=parse(await AsyncStorage.getItem(storageKey),character);
    const next=performAdventure(current,action);
    if(next.changed)await AsyncStorage.setItem(storageKey,JSON.stringify(next.state));
    return next;
  })();
  pending.set(storageKey,task);
  try{return await task;}finally{if(pending.get(storageKey)===task)pending.delete(storageKey);}
}
