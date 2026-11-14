import {authorize,provider,json,readJson,rejectInvalid,queueUrl,isUuid} from '../../../src/server/audioAi';
export async function POST(req:Request):Promise<Response>{
 const denial=await authorize(req);if(denial)return denial;
 try{
  const body=await readJson(req),id=body.request_id;
  if(!isUuid(id))return json({error:'INVALID_JOB'},422);
  const response=await provider(queueUrl(id,'cancel'),{method:'PUT'});
  if(!response.ok)return json({error:'CANCEL_FAILED',upstream_status:response.status},502);
  return json({request_id:id,status:'CANCEL_REQUESTED',charged_amount_refund:'NOT_GUARANTEED'});
 }catch(e){return rejectInvalid(e);}
}
