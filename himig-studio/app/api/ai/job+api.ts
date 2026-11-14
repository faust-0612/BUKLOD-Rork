import {authorize,provider,safeUpstream,json,queueUrl,isUuid,isProviderArtifactUrl} from '../../../src/server/audioAi';
export async function GET(req:Request):Promise<Response>{
 const denial=await authorize(req);if(denial)return denial;
 const u=new URL(req.url),id=u.searchParams.get('id');
 if(!isUuid(id))return json({error:'INVALID_JOB'},422);
 // Caller never chooses URLs. Reconstruct the exact fal queue endpoints from the request ID.
 const response=await provider(queueUrl(id,'status'));
 const status=await safeUpstream(response) as Record<string,unknown>;
 if(!response.ok)return json({error:'STATUS_UNAVAILABLE',upstream_status:response.status},502);
 if(status.status!=='COMPLETED')return json({request_id:id,status:status.status,done:false,
    result:null,quality:'NOT_MEASURED',fallback:'untouched original recording'});
 if(status.error)return json({request_id:id,status:'FAILED',error:'PROVIDER_PROCESSING_FAILED',
   quality:'FAIL',fallback:'untouched original recording'});
 const resultResponse=await provider(queueUrl(id,'response'));
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
 if(!Object.values(files).every(isProviderArtifactUrl))return json({
  request_id:id,status:'FAILED',error:'BAD_STEM_OUTPUT',fallback:'untouched original recording'
 },502);
 return json({request_id:id,status:'REVIEW_REQUIRED',done:false,model_completed:true,
   artifacts:files,qualityGates:{stemArtifacts:'NOT_MEASURED',pitchDrift:'NOT_MEASURED',
     whisperLyricMatch:'NOT_MEASURED',ownerListening:'REQUIRED'},
   sourceVocalRegenerated:false,canBeStudioMaster:false,
   fallback:'untouched original recording'});
}
