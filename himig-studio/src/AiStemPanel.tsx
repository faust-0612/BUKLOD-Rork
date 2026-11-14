import {useEffect,useRef,useState} from 'react';

type Capabilities={
  ready:boolean; provider:string; stages:Record<string,string>;
  privacy:string; billing:string;
};
type Job={request_id:string;status_url?:string;response_url?:string;cancel_url?:string};
type Result={status:string;artifacts?:{vocalStem:string;accompanimentResidual:string};
  error?:string;qualityGates?:Record<string,string>};

function mime(file:File):string{
 const ext=file.name.split('.').pop()?.toLowerCase();
 if(ext==='wav')return 'audio/wav';
 if(ext==='flac')return 'audio/flac';
 if(ext==='mp3')return 'audio/mpeg';
 return file.type;
}
const URL_BASE='/api/ai';
function putFile(signedUrl:string,file:File,contentType:string,progress:(p:number)=>void,
  attach:(x:XMLHttpRequest)=>void,extraHeaders:Record<string,string>={}):Promise<void>{
 return new Promise((resolve,reject)=>{
  const xhr=new XMLHttpRequest();attach(xhr);
  xhr.open('PUT',signedUrl);
  xhr.timeout=180000;
  const signedType=Object.entries(extraHeaders).find(([key])=>key.toLowerCase()==='content-type')?.[1];
  xhr.setRequestHeader('Content-Type',signedType||contentType);
  for(const [name,value] of Object.entries(extraHeaders)){
    if(name.toLowerCase()!=='content-type')xhr.setRequestHeader(name,value);
  }
  xhr.upload.onprogress=e=>{if(e.lengthComputable)progress(Math.round(e.loaded/e.total*100));};
  xhr.onload=()=>xhr.status>=200&&xhr.status<300?resolve():reject(new Error('Vendor upload HTTP '+xhr.status));
  xhr.onerror=()=>reject(new Error('Upload connection failed'));
  xhr.ontimeout=()=>reject(new Error('Upload timed out; retry with the same original file'));
  xhr.onabort=()=>reject(new Error('Upload cancelled'));
  xhr.send(file);
 });
}

export function AiStemPanel({sourceFile}:{sourceFile:File|null}){
 const [cap,setCap]=useState<Capabilities|null>(null);
 const [ownerToken,setOwnerToken]=useState('');
 const [consent,setConsent]=useState(false);
 const [busy,setBusy]=useState(false);
 const [progress,setProgress]=useState(0);
 const [message,setMessage]=useState('');
 const [error,setError]=useState('');
 const [job,setJob]=useState<Job|null>(null);
 const [recoverId,setRecoverId]=useState('');
 const [submitStarted,setSubmitStarted]=useState(false);
 const [result,setResult]=useState<Result|null>(null);
 const xhr=useRef<XMLHttpRequest|null>(null);
 const busyLock=useRef(false);
 const runId=useRef(0);
 useEffect(()=>{
   let alive=true;
   fetch(URL_BASE+'/status',{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject(new Error('Server routes unavailable')))
    .then((data:Capabilities)=>{if(alive)setCap(data);})
    .catch(()=>{if(alive)setCap({ready:false,provider:'not connected',stages:{},privacy:'No original is uploaded by this panel without consent.',billing:'No model calls.'});});
   return()=>{alive=false;runId.current++;xhr.current?.abort();};
 },[]);
 useEffect(()=>{setJob(null);setResult(null);setConsent(false);setMessage('');setError('');},[sourceFile]);
 async function call(path:string,method:'POST'|'GET',body?:unknown){
  const res=await fetch(URL_BASE+path,{
   method,headers:{'Authorization':'Bearer '+ownerToken,...(body?{'Content-Type':'application/json'}:{})},
   ...(body?{body:JSON.stringify(body)}:{}),
   cache:'no-store',signal:AbortSignal.timeout(35000)
  });
  const data=await res.json().catch(()=>({error:'NON_JSON_BACKEND'}));
  if(!res.ok)throw new Error(data.message||data.error||'Server HTTP '+res.status);
  return data;
 }
 async function start(){
  if(!sourceFile||!cap?.ready||!consent||busyLock.current||ownerToken.length<32)return;
  const type=mime(sourceFile);
  if(!['audio/wav','audio/mpeg','audio/flac'].includes(type)){setError('For real separation, upload WAV, FLAC or MP3. M4A is not yet supported.');return;}
  if(sourceFile.size>60*1024*1024){setError('60 MB size limit for this provider adapter.');return;}
  busyLock.current=true;
  const id=++runId.current;setError('');setJob(null);setResult(null);setBusy(true);setProgress(0);setSubmitStarted(false);
  try{
   setMessage('Requesting temporary signed upload URL');
   const upload=await call('/upload','POST',{file_name:sourceFile.name,content_type:type,
     size_bytes:sourceFile.size,consent:true});
   const url=new URL(upload.upload_url);
   if(url.protocol!=='https:'||!['v3-uploads.fal.media','v3.fal.media','v3b.fal.media'].includes(url.hostname))
     throw new Error('Invalid upload destination');
   if(id!==runId.current)return;
   setMessage('Uploading to provider. The original recording remains unchanged.');
   await putFile(upload.upload_url,sourceFile,type,setProgress,x=>{xhr.current=x;},upload.upload_headers ?? {});
   xhr.current=null;if(id!==runId.current)return;
   // An HTTP timeout here may mean the paid job already exists. Never let the Cancel-upload
   // button discard an in-flight paid submission before the provider request id is known.
   setSubmitStarted(true);
   setMessage('Submitting paid voice separation job; do not close until the request ID appears.');
   const next=await call('/separate','POST',{audio_url:upload.file_url,consent:true});
   if(id!==runId.current)return;
   setJob(next as Job);setMessage('Submitted. Use Refresh job status to check progress. Do not treat the separated stem as a master.');
  }catch(e){if(id===runId.current)setError(e instanceof Error?e.message:'Processing failed');}
  finally{busyLock.current=false;setSubmitStarted(false);if(id===runId.current)setBusy(false);}
 }
 async function refresh(){
  if(!job||busyLock.current)return;busyLock.current=true;setBusy(true);setError('');
  try{
   const params=new URLSearchParams({id:job.request_id});
   const result=await call('/job?'+params.toString(),'GET');
   setResult(result);setMessage(result.status==='REVIEW_REQUIRED'?'Provider completed. Download stems and listen for separation artifacts.':String(result.status));
  }catch(e){setError(e instanceof Error?e.message:'Could not check job');}
  finally{busyLock.current=false;setBusy(false);}
 }
 async function cancel(){
  if(!job||busyLock.current)return;busyLock.current=true;setBusy(true);
  try{
    const r=await call('/cancel','POST',{request_id:job.request_id});
    setMessage(r.status+' (provider charges may still apply)');
  }catch(e){setError(e instanceof Error?e.message:'Cancellation failed');}
  finally{busyLock.current=false;setBusy(false);}
 }
 return <section className="ai-separator">
   <div className="heading"><span className="step">AI</span><h2>Real stem separation (experimental)</h2></div>
   <p><strong>Not a music generator.</strong> This optional server step separates your source's existing singing voice from other sounds. It does not replace vocals, change lyrics or make a studio-quality master.</p>
   {cap?.ready ? <p className="success">Owner-only server-side AI adapter configured.</p>
     : <p className="error">AI backend is NOT CONFIGURED. The Expo interface and diagnostic engine are available, but external voice separation cannot run until the server has private model credentials, owner authorization and explicit billing enablement. No paid job has been started.</p>}
   {cap && <p className="help">Provider: {cap.provider}. {cap.privacy} {cap.billing}</p>}
   <label className="field-label" htmlFor="ai-owner-access">Owner access token (server-validated; never stored)</label>
   <input id="ai-owner-access" type="password" autoComplete="off" placeholder="Private owner access token" value={ownerToken} onChange={e=>setOwnerToken(e.target.value)} />
   <label className="music-approval"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>
     <span>I own or am allowed to process this recording, consent to transfer it to an external audio provider, accept the provider's retention/privacy terms and possible billed usage.</span>
   </label>
   <button type="button" className="primary" disabled={!sourceFile||!cap?.ready||!consent||ownerToken.length<32||busy}
     onClick={()=>void start()}>{busy?'Working…':'Separate actual singing voice using AI'}</button>
   {busy && <button type="button" className="link-button" disabled={submitStarted} onClick={()=>{
      runId.current++;xhr.current?.abort();busyLock.current=false;setBusy(false);
      setMessage('Local upload cancelled. No completed provider job has been confirmed.');
   }}>{submitStarted?'Submitting paid job — cannot safely cancel now':'Cancel upload'}</button>}
   {progress>0&&<p className="help">Provider upload: {progress}%</p>}
   {message&&<p role="status">{message}</p>}
   {error&&<p className="error" role="alert">{error}</p>}
   <div className="ai-job" aria-label="Recover existing paid model job">
     <label htmlFor="ai-recover-job">Recover previous job by request ID (after reload or poor signal)</label>
     <input id="ai-recover-job" autoComplete="off" spellCheck={false} inputMode="text"
       placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" value={recoverId}
       onChange={e=>setRecoverId(e.target.value.trim().slice(0,36))}/>
     <button type="button" className="export"
       disabled={!cap?.ready||busy||ownerToken.length<32||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(recoverId)}
       onClick={()=>{setJob({request_id:recoverId});setResult(null);setMessage('Recovered job ID locally. Select Refresh job status to query the provider.');}}>
       Load existing job
     </button>
     <p className="help">Copy and keep the request ID when a job is submitted. It lets you check the same paid job again without paying to submit a duplicate.</p>
   </div>
   {job&&<div className="ai-job">
     <p>Provider request: {job.request_id} · Output quality not yet certified</p>
     <button type="button" className="export" disabled={busy} onClick={()=>void refresh()}>Refresh job status</button>
     <button type="button" className="link-button" disabled={busy} onClick={()=>void cancel()}>Cancel provider job</button>
   </div>}
   {result?.artifacts&&<div className="ai-job">
     <p><strong>Real model output — review before mixing</strong></p>
     <div><strong>Isolated singing voice (may contain artifacts)</strong>
       <audio controls src={result.artifacts.vocalStem}/>
       <a href={result.artifacts.vocalStem} rel="noreferrer" target="_blank">Open isolated voice</a>
     </div>
     <div><strong>Accompaniment residual (may contain vocal bleed)</strong>
       <audio controls src={result.artifacts.accompanimentResidual}/>
       <a href={result.artifacts.accompanimentResidual} rel="noreferrer" target="_blank">Open other instruments</a>
     </div>
     <p>Whisper lyric match, melody locking, pitch drift and artifact checks remain NOT_MEASURED. The original file is preserved.</p>
   </div>}
 </section>;
}
