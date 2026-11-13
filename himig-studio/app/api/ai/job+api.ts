import {authorize,provider,safeUpstream,json,isQueueUrl,isUuid} from '../../../src/server/audioAi';
export async function GET(req:Request):Promise<Response>{
 const denial=await authorize(req);if(denial)return denial;
 const u=new URL(req.url),id=u.searchParams.get('id'),statusUrl=u.searchParams.get('status_url'),
  resultUrl=u.searchParams.get('response_url');
 if(!isUuid(id)||!isQueueUrl(statusUrl,id)||!isQueueUrl(resultUrl,id))return json({error:'INVALID_JOB'},422);
 const response=await provider(statusUrl!);
 const status=await safeUpstream(response) as Record<string,unknown>;
 if(!response.ok)return json({error:'STATUS_UNAVAILABLE',upstream_status:response.status},502);
 if(status.status!=='COMPLETED')return json({request_id:id,status:status.status,done:false,
    result:null,quality:'NOT_MEASURED',fallback:'untouched original recording'});
 if(status.error)return json({request_id:id,status:'FAILED',error:'PROVIDER_PROCESSING_FAILED',
   quality:'FAIL',fallback:'untouched original recording'});
 const resultResponse=await provider(resultUrl!);
 const result=await safeUpstream(resultResponse) as Record<string,unknown>;
 if(!resultResponse.ok)return json({request_id:id,status:'FAILED',error:'RESULT_UNAVAILABLE',
   fallback:'untouched original recording'},502);
 const target=result.target as {url?:unknown}|undefined;
 const residual=result.residual as {url?:unknown}|undefined;
 // No content quality guarantee: actual listening and artifact checks required.
 const files={
  vocalStem:target?.url,
  accompanimentResidual:residual?.url
 };
 if(!Object.values(files).every(x=>typeof x==='string'&&x.startsWith('https://')))return json({
  request_id:id,status:'FAILED',error:'BAD_STEM_OUTPUT',fallback:'untouched original recording'
 },502);
 return json({request_id:id,status:'REVIEW_REQUIRED',done:false,model_completed:true,
   artifacts:files,qualityGates:{stemArtifacts:'NOT_MEASURED',pitchDrift:'NOT_MEASURED',
     whisperLyricMatch:'NOT_MEASURED',ownerListening:'REQUIRED'},
   sourceVocalRegenerated:false,canBeStudioMaster:false,
   fallback:'untouched original recording'});
}
