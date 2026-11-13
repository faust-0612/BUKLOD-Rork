import {authorize,provider,safeUpstream,json,readJson,rejectInvalid,isFalAudioUrl,isQueueUrl,isUuid,MODEL} from '../../../src/server/audioAi';
export async function POST(req:Request):Promise<Response>{
 const denial=await authorize(req);if(denial)return denial;
 try{
  const body=await readJson(req);
  if(body.consent!==true)return json({error:'CONSENT_REQUIRED'},422);
  if(!isFalAudioUrl(body.audio_url))return json({error:'FILE_NOT_APPROVED',message:'Only fal-uploaded HTTPS media URLs accepted.'},422);
  const response=await provider('https://queue.fal.run/'+MODEL,{
   method:'POST',headers:{'X-Fal-No-Retry':'1'},
   body:JSON.stringify({audio_url:body.audio_url,prompt:'singing voice',acceleration:'balanced',
     reranking_candidates:1,predict_spans:false,output_format:'wav',max_chunk_duration:60,chunk_overlap:5})});
  const result=await safeUpstream(response) as Record<string,unknown>;
  if(!response.ok)return json({error:'MODEL_REQUEST_FAILED',upstream_status:response.status},502);
  const id=result.request_id;
  if(!isUuid(id)||!isQueueUrl(result.status_url,id)||!isQueueUrl(result.response_url,id)||
     !isQueueUrl(result.cancel_url,id))return json({error:'INVALID_VENDOR_JOB_RESPONSE'},502);
  return json({request_id:id,status_url:result.status_url,response_url:result.response_url,cancel_url:result.cancel_url,
    provider:MODEL,state:'QUEUED',paid_request_created:true,
    quality:'NOT_MEASURED',fallback:'untouched original recording'});
 }catch(e){return rejectInvalid(e);}
}
