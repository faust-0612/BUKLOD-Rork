/**
 * Account-scoped offline game mastery only. This is NOT a backend BP or
 * Character-XP ledger and must never feed verified real rewards.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { KINGDOM_ARCADE_IDS } from './arcadeCatalog';
import {
  blankArcadeProgress,normalizeArcadeProgress,clearArcadeStage,
  type ArcadeProgressRecord,
} from './arcadeProgressCore';

const PREFIX='@buklod/kingdom/arcade-stage-v1/';
const pending=new Map<string,Promise<unknown>>();
function keyFor(userId:string,gameId:string) {
  if(!/^[0-9a-f-]{36}$/i.test(userId)||!KINGDOM_ARCADE_IDS.has(gameId)){
    throw Error('Invalid arcade account/game scope.');
  }
  return PREFIX+userId.toLowerCase()+'/'+gameId;
}
export async function readArcadeProgress(userId:string,gameId:string):Promise<ArcadeProgressRecord>{
  const key=keyFor(userId,gameId);
  const raw=await AsyncStorage.getItem(key);
  if(!raw)return blankArcadeProgress(gameId);
  try {return normalizeArcadeProgress(gameId,JSON.parse(raw));}
  catch {return blankArcadeProgress(gameId);}
}
export async function checkpointArcadeStage(
  userId:string,gameId:string,stage:number,score:number,receipt:string,
):Promise<ArcadeProgressRecord>{
  const key=keyFor(userId,gameId);
  const previous=pending.get(key)??Promise.resolve();
  const current=previous.catch(()=>undefined).then(async()=>{
    const old=await readArcadeProgress(userId,gameId);
    const next=clearArcadeStage(old,gameId,stage,score,receipt,new Date().toISOString());
    if(JSON.stringify(old)!==JSON.stringify(next)){
      await AsyncStorage.setItem(key,JSON.stringify(next));
    }
    return next;
  });
  pending.set(key,current);
  void current.finally(()=>{if(pending.get(key)===current)pending.delete(key);}).catch(()=>undefined);
  return current;
}
