import { supabase } from '@/lib/supabase';
import { ARENA_STONE_IDS, type ArenaStoneId } from './buklodArenaStoneCatalog';
export type StoneRow = {hero_id:ArenaStoneId;balance:number;mastery_count:number;quest_awarded:boolean};
export type StoneTrade = {id:string;sender:string;recipient:string;offered:ArenaStoneId[];wanted:ArenaStoneId[]};
export type StoneRequest = {id:string;requester:string;donor:string;hero_id:ArenaStoneId};
export type StoneSnapshot = {version:1;enabled:true;owner:string;bp_exchange_enabled:boolean;discovery_enabled?:boolean;expedition_enabled?:boolean;spendable_bp:number;stones:StoneRow[];trades:StoneTrade[];requests:StoneRequest[]};
export type StoneAction = 'exchange'|'combine'|'convert'|'gift'|'offer'|'accept_trade'|'cancel_trade'|'request'|'accept_request'|'decline_request';
const validNumber=(n:unknown):n is number=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0;
const validId=(n:unknown):n is ArenaStoneId=>typeof n==='string'&&ARENA_STONE_IDS.has(n);
const validList=(v:unknown):v is ArenaStoneId[]=>Array.isArray(v)&&v.length>0&&v.every(validId);
async function account(uid:string){
 const {data,error}=await supabase.auth.getSession();
 if(error||data.session?.user.id!==uid)throw new Error('Account changed. Sign in again.');
}
function normalize(raw:unknown,uid:string):StoneSnapshot|null {
 const d=raw as StoneSnapshot|null;
 if(!d||d.version!==1||d.enabled!==true)return null;
 if(d.owner!==uid||!validNumber(d.spendable_bp)||typeof d.bp_exchange_enabled!=='boolean'||!Array.isArray(d.stones)||d.stones.length!==13||
 d.stones.some(r=>!r||!validId(r.hero_id)||!validNumber(r.balance)||!validNumber(r.mastery_count)||r.mastery_count>3||typeof r.quest_awarded!=='boolean')||
 new Set(d.stones.map(r=>r.hero_id)).size!==13||!Array.isArray(d.trades)||!Array.isArray(d.requests)||
 d.trades.some(t=>!t||typeof t.id!=='string'||(t.sender!==uid&&t.recipient!==uid)||!validList(t.offered)||!validList(t.wanted))||
 d.requests.some(t=>!t||typeof t.id!=='string'||(t.requester!==uid&&t.donor!==uid)||!validId(t.hero_id)))throw new Error('Invalid stone response');
 return d;
}
async function request(uid:string,name:string,args?:Record<string,unknown>){
 await account(uid);
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),10000);
 try{
  const result=await (supabase as any).rpc(name,args).abortSignal(controller.signal);
  if(result.error)throw new Error(result.error.message||'Stone service unavailable');
  await account(uid);
  return result.data;
 }finally{clearTimeout(timer);}
}
async function rpc(uid:string,name:string,args?:Record<string,unknown>){
 return normalize(await request(uid,name,args),uid);
}
export async function resolveArenaStoneRequest(uid:string,requestId:string){
 const result=await request(uid,'resolve_my_empire_stone_request_v1',{p_request_id:requestId});
 if(!result||result.owner!==uid||result.version!==1||!['completed','cancelled'].includes(result.request_state))throw new Error('Invalid resolution');
 const snapshot=normalize(result.snapshot,uid);
 if(!snapshot)throw new Error('Unavailable inventory');
 return {snapshot,state:result.request_state as 'completed'|'cancelled'};
}
// No local balance, no client mint. On ambiguous mutation result, retry the same request ID.
export const getArenaStones=(uid:string)=>rpc(uid,'get_my_empire_stones_v1');
export const actArenaStones=(uid:string,action:StoneAction,args:Record<string,unknown>,requestId:string)=>
 rpc(uid,'act_my_empire_stones_v1',{p_action:action,p_args:args,p_request_id:requestId});

export type DiscoveryTrial={enabled:boolean;status:'pending'|'daily_cap'|'attempt_cap'|'failed'|'expired'|'verified';id?:string;hero_id?:ArenaStoneId;expires_at?:string;questions?:{a:number;b:number;c:number}[];outcome?:'awarded'|'no_drop'|'daily_cap'|'roll_cap'};
export async function startArenaDiscovery(uid:string,hero:ArenaStoneId):Promise<DiscoveryTrial>{
 const d=await request(uid,'start_my_empire_discovery_v1',{p_hero_id:hero});
 if(d?.enabled===false)return d;
 if(d?.enabled!==true||!['pending','daily_cap','attempt_cap'].includes(d.status))throw new Error('Invalid trial');
 if(d.status==='pending'&&(!validId(d.hero_id)||typeof d.id!=='string'||!Array.isArray(d.questions)||d.questions.length!==3||
 d.questions.some((q:any)=>!q||![q.a,q.b,q.c].every(n=>validNumber(n)&&n>0&&n<=20))))throw new Error('Invalid trial questions');
 return d;
}
export async function finishArenaDiscovery(uid:string,id:string,answers:number[]):Promise<DiscoveryTrial>{
 const d=await request(uid,'finish_my_empire_discovery_v1',{p_id:id,p_answers:answers});
 if(d?.enabled!==true||d.id!==id||!validId(d.hero_id)||!['failed','expired','verified'].includes(d.status)||
 (d.status==='verified'&&!['awarded','no_drop','daily_cap','roll_cap'].includes(d.outcome)))throw new Error('Invalid trial result');
 return d;
}

export type ExpeditionAction='solve'|'strike'|'guard'|'finish';
export type Expedition={enabled:boolean;id:string;hero_id:ArenaStoneId;version:number;stage:number;state:'active'|'complete'|'failed'|'expired';health:number;monster_hp:number;monster_intent:'heavy'|'recovering'|null;question:{a:number;b:number;c:number}|null;results:{source:string;outcome:string}[];next_action_at:string;server_now:string;expires_at:string};
function normalizeExpedition(d:any):Expedition|null{
 if(d?.enabled===false)return null;
 if(d?.enabled!==true||typeof d.id!=='string'||!validId(d.hero_id)||!validNumber(d.version)||d.version>24||!validNumber(d.stage)||d.stage>5||!validNumber(d.health)||d.health>5||!validNumber(d.monster_hp)||d.monster_hp>3||!['active','complete','failed','expired'].includes(d.state)||!Array.isArray(d.results)||d.results.length>5||typeof d.next_action_at!=='string'||typeof d.server_now!=='string'||!Number.isFinite(Date.parse(d.next_action_at))||!Number.isFinite(Date.parse(d.server_now)))throw new Error('Invalid expedition state');
 if(d.state==='active'&&[0,2,3].includes(d.stage)&&(!d.question||![d.question.a,d.question.b,d.question.c].every(n=>validNumber(n)&&n>0&&n<=20)))throw new Error('Invalid expedition question');
 return d;
}
export async function startArenaExpedition(uid:string,hero:ArenaStoneId){return normalizeExpedition(await request(uid,'start_my_empire_expedition_v1',{p_hero_id:hero}));}
export async function stepArenaExpedition(uid:string,id:string,version:number,action:ExpeditionAction,answer:number|null,requestId:string){
 const d=normalizeExpedition(await request(uid,'step_my_empire_expedition_v1',{p_id:id,p_version:version,p_action:action,p_answer:answer,p_request_id:requestId}));
 if(!d||d.id!==id)throw new Error('Invalid expedition receipt');return d;
}
