import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';
import type { DocumentPickerAsset } from 'expo-document-picker';
import { supabase } from '@/lib/supabase';

export type SaliksikManuscriptDownload = { ok:true; kind:'complete_original'|'complete_study_manuscript'; name:string; download_url:string; };
export type SaliksikSource = {
 id: string; title: string; file_name: string; status: string;
 created_at: string; attempts: number; last_error: string|null;
 collection_id?: string|null; collection_status?: string|null;
 investigations?: number; content_sha256?: string; storage_path?: string;
};
export type SaliksikInvestigation = {
 id: string; collection_id: string; collection_title: string;
 title: string; summary: string; tier: 'discover'|'investigate';
 points: number; scripture_refs: string[]; completed: boolean;
};
export type SaliksikDetail = {
 id:string; title:string;summary:string; tier:string;
 lesson_text:string;scripture_refs:string[];author_disclosure:string;
};
export type SaliksikQuestion = {
 id:string;prompt:string;options:string[];competency:string;
};
export type SaliksikSession = {
 completed:boolean;attempt_id?:string;expires_at?:string;
 tier?:string;questions?:SaliksikQuestion[];
};
export type SaliksikResult = {
 ok:boolean;passed:boolean;score:number;points?:number;series_points?:number;
 competencies:Record<string,number>;reason:string;replayed?:boolean;
};
const BUCKET='saliksik-source-originals';
export const SALIKSIK_MAX_FILE_BYTES=10*1024*1024;
const FORMATS:Record<string,string>={
 pdf:'application/pdf',
 docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 txt:'text/plain',
};
function fail(error:unknown):string {
 return error instanceof Error?error.message:String((error as any)?.message??error);
}
async function assertAdmin(){
 const {data,error}=await supabase.rpc('is_system_admin');
 if(error||data!==true)throw new Error('System Admin access required');
}
function unpack<T>(res:{data:T|null,error:any}):T{
 if(res.error)throw new Error(fail(res.error));
 return res.data as T;
}
async function rpc<T>(name:string,args:Record<string,unknown>={}):Promise<T>{
 return unpack<T>(await (supabase as any).rpc(name,args));
}
export async function saliksikAdminList():Promise<SaliksikSource[]>{
 await assertAdmin();
 return rpc<SaliksikSource[]>('saliksik_admin_list_v1');
}
export async function saliksikAdminPreview(collectionId:string):Promise<any>{
 await assertAdmin();
 return rpc('saliksik_admin_preview_v1',{p_collection_id:collectionId});
}
export async function saliksikAdminPublish(collectionId:string):Promise<void>{
 await assertAdmin();
 const out=await rpc<{ok:boolean}>('saliksik_admin_publish_v1',{p_collection_id:collectionId});
 if(!out?.ok)throw new Error('Publication was not confirmed');
}
export function saliksikFormat(name:string):{ext:string;mime:string}{
 const ext=String(name||'').toLowerCase().split('.').pop()||'';
 if(!FORMATS[ext])throw new Error('Supported manuscripts: DOCX, PDF, TXT');
 return {ext,mime:FORMATS[ext]};
}
export async function saliksikUploadOriginal(asset:DocumentPickerAsset):Promise<{id:string;duplicate:boolean}>{
 await assertAdmin();
 const {ext,mime}=saliksikFormat(asset.name);
 const expected=Number(asset.size??asset.file?.size??0);
 if(expected<=0||expected>SALIKSIK_MAX_FILE_BYTES)
  throw new Error('Manuscript must be 1 byte to 10 MB.');
 const buffer=Platform.OS==='web'&&asset.file
  ? await asset.file.arrayBuffer()
  : await new File(asset.uri).arrayBuffer();
 const bytes=new Uint8Array(buffer);
 if(bytes.byteLength<1||bytes.byteLength>SALIKSIK_MAX_FILE_BYTES||bytes.byteLength!==expected)
  throw new Error('File size changed while reading. Re-select file.');
 const digest=new Uint8Array(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256,bytes));
 const hash=Array.from(digest).map(n=>n.toString(16).padStart(2,'0')).join('');
 const existing=await rpc<string|null>('saliksik_admin_find_hash_v1',{p_sha256:hash});
 if(existing)return {id:existing,duplicate:true};
 const path='originals/'+Crypto.randomUUID()+'.'+ext;
 const upload=await supabase.storage.from(BUCKET).upload(path,bytes,{
  contentType:mime,upsert:false,cacheControl:'0',
 });
 if(upload.error)throw new Error(fail(upload.error));
 try{
  const registered=await rpc<{id:string;duplicate:boolean}>('saliksik_admin_register_v1',{
   p_title:asset.name.replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ').slice(0,180),
   p_file_name:asset.name.slice(0,200),p_mime_type:mime,
   p_storage_path:path,p_size_bytes:bytes.byteLength,p_sha256:hash,
  });
  if(!registered?.id)throw new Error('Document metadata not saved');
  if(registered.duplicate){
   // Another admin upload raced this content hash; retain the already registered original.
   await supabase.storage.from(BUCKET).remove([path]);
  }
  return {id:registered.id,duplicate:registered.duplicate};
 }catch(error){
  // Ambiguous RPC/network failure may mean metadata already committed.
  // Never delete its original: preserve it for a safe reconciliation/retry.
  throw new Error('Private upload retained; verify metadata before retrying: '+fail(error));
 }
}
export async function saliksikGenerateDraft(sourceId:string):Promise<{ok:boolean;status:string}>{
 await assertAdmin();
 const {data,error}=await supabase.functions.invoke('saliksik-generate-v1',{body:{source_id:sourceId}});
 if(error)throw new Error(fail(error));
 if(!data?.ok)throw new Error(String(data?.reason||'AI draft generation failed'));
 return data;
}
export async function saliksikCatalog(scopeId:string):Promise<SaliksikInvestigation[]>{
 return rpc('saliksik_catalog_v1',{p_scope_id:scopeId});
}
export async function saliksikDetail(scopeId:string,investigationId:string):Promise<SaliksikDetail>{
 return rpc('saliksik_detail_v1',{p_scope_id:scopeId,p_investigation_id:investigationId});
}
export async function saliksikBegin(scopeId:string,investigationId:string):Promise<SaliksikSession>{
 return rpc('saliksik_begin_v1',{p_scope_id:scopeId,p_investigation_id:investigationId});
}
export async function saliksikSubmit(attemptId:string,answers:number[]):Promise<SaliksikResult>{
 return rpc('saliksik_submit_v1',{p_attempt_id:attemptId,p_answers:answers});
}
export async function saliksikSignedOriginalUrl(path:string):Promise<string|null>{
 await assertAdmin();
 if(!/^originals\/[0-9a-f-]{36}\.(?:docx|pdf|txt)$/i.test(path))return null;
 const {data,error}=await supabase.storage.from(BUCKET).createSignedUrl(path,300);
 if(error)throw error;
 return data?.signedUrl||null;
}

export type SaliksikMasterSubmission = {
 id:string;status:'pending'|'approved'|'rework';score:number|null;
 competencies:Record<string,number>|null;feedback:string|null;
 submitted_at:string;reviewed_at:string|null;
};
export type SaliksikMasterQueueItem = {
 id:string;user_id:string;submitted_at:string;investigation_title:string;
 answers:string[];scripture_refs:string[];source_excerpt:string;
};
export type SaliksikMasterReviewResult = {
 approved:boolean;score:number;core_pass:boolean;citations_verified:boolean;
 points:number;series_points:number;claim_state:string|null;
};
export async function saliksikMasterStatus(investigationId:string):Promise<SaliksikMasterSubmission|null>{
 const data=await rpc<SaliksikMasterSubmission>('saliksik_master_get_v1',{
  p_investigation_id:investigationId,
 });
 return data?.id?data:null;
}
export async function saliksikMasterSubmit(
 scopeId:string,investigationId:string,answers:string[]
):Promise<{pending?:boolean;completed?:boolean;submission_id?:string;points:number}>{
 if(answers.length!==3||answers.some(a=>a.trim().length<220||a.length>4000)
 ||new Set(answers.map(x=>x.trim().toLowerCase())).size!==3){
  throw new Error('Three distinct, independently written responses of at least 220 characters each are required.');
 }
 return rpc('saliksik_master_submit_v1',{
  p_scope_id:scopeId,p_investigation_id:investigationId,p_answers:answers,
 });
}
export async function saliksikAdminMasterQueue():Promise<SaliksikMasterQueueItem[]>{
 await assertAdmin();
 return rpc('saliksik_admin_master_queue_v1');
}
export async function saliksikAdminMasterReview(
 submissionId:string,scores:Record<string,number>,
 citationsVerified:boolean,feedback:string
):Promise<SaliksikMasterReviewResult>{
 await assertAdmin();
 const names=['understanding','evidence','context','reasoning','transfer'];
 if(names.some(n=>!Number.isInteger(scores[n])||scores[n]<0||scores[n]>100)
 ||Object.keys(scores).length!==5||feedback.trim().length<80||feedback.length>2000){
  throw new Error('Complete all five numeric competency scores (0–100) and a detailed feedback note.');
 }
 return rpc('saliksik_admin_master_review_v1',{
  p_submission_id:submissionId,p_scores:scores,p_citations_verified:citationsVerified,
  p_feedback:feedback.trim(),
 });
}

/**
 * The Edge server checks the live user's nine-part completion and manuscript rights;
 * the client never receives the permanent private storage path.
 * Claiming pending Points is NOT required to download an earned manuscript.
 */
export async function saliksikRequestCompleteManuscript(
 collectionId:string
):Promise<SaliksikManuscriptDownload>{
 if(!/^[0-9a-f-]{36}$/i.test(collectionId))throw new Error('Invalid manuscript collection');
 const {data,error}=await supabase.functions.invoke('saliksik-manuscript-v1',{
  body:{collection_id:collectionId},
 });
 if(error)throw new Error(fail(error));
 if(!data?.ok||typeof data.download_url!=='string'||
    !/^https:\/\//i.test(data.download_url) ||
    !['complete_original','complete_study_manuscript'].includes(data.kind)){
  throw new Error(String(data?.reason||'Manuscript is unavailable until verified completion'));
 }
 return data as SaliksikManuscriptDownload;
}

export async function saliksikAdminOriginalDownloadRights():Promise<Record<string,boolean>>{
 await assertAdmin();
 return rpc('saliksik_admin_original_rights_v1');
}
export async function saliksikAdminSetOriginalDownloadRights(
 sourceId:string, allowed:boolean
):Promise<void>{
 await assertAdmin();
 const statement=allowed
  ? 'Source owner confirms redistribution rights for verified-completion member manuscript download.'
  : 'Original manuscript redistribution rights revoked; compiled study manuscript remains accessible.';
 const out=await rpc<{ok:boolean}>('saliksik_admin_set_original_rights_v1',{
  p_source_id:sourceId,p_allowed:allowed,p_basis:statement,
 });
 if(!out?.ok)throw new Error('Original manuscript rights change was not confirmed');
}


export type SaliksikResearchMethod =
 |'exegetical'|'biblical_theology'|'systematic'|'historical'
 |'comparative'|'practical'|'education'|'mission_leadership';
export type SaliksikAutoResearchReceipt = {
 ok:boolean;status:'queued'|'processing'|'ready'|'held';request_id?:string;
 question?:string;scripture_anchor?:string;progress?:number;
 collection_id?:string|null;error?:string|null;created_at?:string;
};
const SALIKSIK_UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Research generation is requested by members; only the server may publish. */
export async function saliksikRequestResearch(
 scopeId:string,question:string,reference:string,method:SaliksikResearchMethod
):Promise<SaliksikAutoResearchReceipt>{
 const result=await rpc<SaliksikAutoResearchReceipt>('saliksik_research_request_r4',{
  p_scope_id:scopeId,p_question:question.trim(),p_reference:reference.trim(),p_method:method,
 });
 if(!result?.ok)throw new Error('Automatic SALIKSIK request could not be saved');
 return result;
}
export async function saliksikMyResearch(scopeId:string):Promise<SaliksikAutoResearchReceipt[]>{
 return rpc<SaliksikAutoResearchReceipt[]>('saliksik_my_research_r4',{p_scope_id:scopeId});
}
export async function saliksikResearchStatus(requestId:string):Promise<SaliksikAutoResearchReceipt>{
 if(!SALIKSIK_UUID.test(requestId))throw new Error('Invalid research request');
 return rpc<SaliksikAutoResearchReceipt>('saliksik_research_status_r4',{p_request_id:requestId});
}
export async function saliksikAutoAdvance(requestId:string):Promise<SaliksikAutoResearchReceipt>{
 if(!SALIKSIK_UUID.test(requestId))throw new Error('Invalid research request');
 const {data,error}=await supabase.functions.invoke('saliksik-auto-v1',{
  body:{action:'advance',request_id:requestId},
 });
 if(error)throw new Error(fail(error));
 if(!data?.ok)throw new Error(String(data?.reason??'Automated research temporarily unavailable'));
 return data as SaliksikAutoResearchReceipt;
}
export async function saliksikAutoAssessMaster(submissionId:string):Promise<{
 ok:boolean;automatic?:boolean;receipt?:Record<string,unknown>;completed?:boolean;busy?:boolean;
}>{
 if(!SALIKSIK_UUID.test(submissionId))throw new Error('Invalid research submission');
 const {data,error}=await supabase.functions.invoke('saliksik-auto-v1',{
  body:{action:'assess',submission_id:submissionId},
 });
 if(error)throw new Error(fail(error));
 if(!data?.ok)throw new Error(String(data?.reason??'Independent verifier temporarily unavailable'));
 return data;
}
/** Records actual verified research only; this is NOT a University Credits award. */
export async function saliksikResearchEvidenceReceipt(collectionId:string):Promise<{
 academic_evidence_verified?:boolean;research_method?:string;scripture_anchor?:string;
 verified_at?:string;university_credits?:string;
}>{
 if(!SALIKSIK_UUID.test(collectionId))throw new Error('Invalid research collection');
 return rpc('saliksik_academic_evidence_receipt_r4',{p_collection_id:collectionId});
}
