import {authorize,provider,safeUpstream,json,readJson,rejectInvalid,isFalAudioUrl,isFalUploadUrl} from '../../../src/server/audioAi';
export async function POST(req:Request):Promise<Response>{
 const denial=await authorize(req);if(denial)return denial;
 try{
  const body=await readJson(req);
  if(body.consent!==true)return json({error:'CONSENT_REQUIRED'},422);
  const mime=String(body.content_type||'');
  if(!['audio/wav','audio/x-wav','audio/mpeg','audio/mp3','audio/flac','audio/x-flac'].includes(mime))
    return json({error:'UNSUPPORTED_TYPE',supported:'WAV, MP3, FLAC'},415);
  const bytes=Number(body.size_bytes);
  if(!Number.isSafeInteger(bytes)||bytes<1000||bytes>60*1024*1024)return json({error:'INVALID_SIZE',limit_bytes:62914560},413);
  const file_name=String(body.file_name||'recording.wav').replace(/[^A-Za-z0-9._-]/g,'_').slice(0,90);
  const response=await provider('https://rest.alpha.fal.ai/storage/upload/initiate',{
    method:'POST',body:JSON.stringify({file_name,content_type:mime})});
  const result=await safeUpstream(response) as Record<string,unknown>;
  if(!response.ok)return json({error:'UPLOAD_INITIALIZATION_FAILED',upstream_status:response.status},502);
  if(!isFalUploadUrl(result.upload_url)||!isFalAudioUrl(result.file_url))
    return json({error:'INVALID_VENDOR_UPLOAD_RESPONSE'},502);
  return json({upload_url:result.upload_url,file_url:result.file_url,max_bytes:62914560,
    note:'Signed upload URL. Upload sends original directly to external fal media CDN; only proceed with consent.'});
 }catch(e){return rejectInvalid(e);}
}
