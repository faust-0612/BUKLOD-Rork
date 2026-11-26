import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { withBuklodTimeout } from '@/lib/buklodAsyncTimeout';
import { LEARNING_EVIDENCE_VERSION } from '@/data/faith/learningEvidenceVersion';
import { draftResult, sameDraft } from './learningEvidenceDraftState.mjs';

export const learningEvidencePilot = process.env.EXPO_PUBLIC_BUKLOD_LEARNING_EVIDENCE_PILOT === 'true';
export type EvidenceModule = 'abaka'|'children_story'|'bible_reading';
type Base = {subject_id:string; catalog_version?:string};
export type EvidencePayload = Base & (
 {module:'abaka';answers:Record<string,string>;language:'tl'|'en'} |
 {module:'children_story';edition:'bundled'|'published';version:number;answers:number[]} |
 {module:'bible_reading';reflection:string}
);
export type EvidenceResult = NonNullable<ReturnType<typeof draftResult>>;
export type EvidenceDraft = {payload:EvidencePayload;result:EvidenceResult|null;updatedAt:number;lastAttemptAt:number};
const locks=new Map<string,Promise<unknown>>();
const key=(account:string,module:EvidenceModule,subject:string)=>{
 if(!/^[0-9a-f-]{36}$/i.test(account)||!/^[-a-zA-Z0-9]{1,100}$/.test(subject))throw Error('Invalid assessment identity');
 return '@buklod/learning-evidence/v1/'+account+'/'+module+'/'+subject;
};
async function serial<T>(k:string,fn:()=>Promise<T>):Promise<T>{
 const p=(locks.get(k)??Promise.resolve()).catch(()=>undefined).then(fn);
 locks.set(k,p);
 try{return await p;}finally{if(locks.get(k)===p)locks.delete(k);}
}
async function read(k:string):Promise<EvidenceDraft|null>{
 const raw=await AsyncStorage.getItem(k);if(!raw)return null;
 const v=JSON.parse(raw);
 if(!v?.payload||typeof v.updatedAt!=='number'||typeof v.lastAttemptAt!=='number')throw Error('Saved assessment cannot be read');
 return v;
}
export async function readEvidenceDraft(account:string,module:EvidenceModule,subject:string){
 return read(key(account,module,subject));
}
export async function saveEvidenceDraft(account:string,payload:EvidencePayload){
 if(!learningEvidencePilot)throw Error('Assessment pilot disabled');
 const normalized:EvidencePayload={...payload,catalog_version:LEARNING_EVIDENCE_VERSION};
 if(JSON.stringify(normalized).length>14000)throw Error('Assessment is too long');
 const k=key(account,payload.module,payload.subject_id);
 return serial(k,async()=>{
  const prior=await read(k);
  if(sameDraft(prior,{payload:normalized}))return prior!;
  const next:EvidenceDraft={payload:normalized,result:null,updatedAt:Date.now(),lastAttemptAt:0};
  await AsyncStorage.setItem(k,JSON.stringify(next));return next;
 });
}
export async function submitEvidenceDraft(account:string,module:EvidenceModule,subject:string){
 if(!learningEvidencePilot)throw Error('Assessment pilot disabled');
 const k=key(account,module,subject);
 return serial(k,async()=>{
  const draft=await read(k);if(!draft)throw Error('No saved assessment');
  if(draft.payload.module!==module||draft.payload.subject_id!==subject)throw Error('Saved assessment mismatch');
  if(draft.result)return draft;
  // A timeout cannot cancel an already accepted request. Prevent immediate replay.
  if(Date.now()-draft.lastAttemptAt<60000)return draft;
  const {data,error}=await supabase.auth.getSession();
  const session=data?.session;
  if(error||!session||session.user.id!==account)throw Error('Sign in to the original account');
  const pending={...draft,lastAttemptAt:Date.now()};
  await AsyncStorage.setItem(k,JSON.stringify(pending));
  const outcome=await withBuklodTimeout(
   supabase.functions.invoke('buklod-learning-evidence-v1',{body:pending.payload,headers:{Authorization:'Bearer '+session.access_token}}),
   45000,'Learning assessment'
  ).catch(()=>null);
  if(!outcome||outcome.error)return pending;
  const result=draftResult(module,outcome.data);
  if(!result)return pending;
  const next={...pending,result};
  await AsyncStorage.setItem(k,JSON.stringify(next));return next;
 });
}
