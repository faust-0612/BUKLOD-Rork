/**
 * Route-level integration tests: real route modules, simulated fal HTTP responses only.
 * These tests NEVER invoke the paid fal API and cannot prove audio separation quality.
 */
const fs=require('node:fs');
const ts=require('typescript');
const assert=require('node:assert/strict');
const {test,before,after}=require('node:test');
const webcrypto=require('node:crypto').webcrypto;
const owner='12345678901234567890123456789012';
const uuid='019a1b2c-3d4e-7f80-9a1b-2c3d4e5f6a7b';
const saved={};
for(const k of ['FAL_KEY','HIMIG_OWNER_TOKEN','HIMIG_ENABLE_PAID_AI'])saved[k]=process.env[k];
before(()=>{process.env.FAL_KEY='SIMULATED_TEST_ONLY';process.env.HIMIG_OWNER_TOKEN=owner;process.env.HIMIG_ENABLE_PAID_AI='true';});
after(()=>{for(const [k,v] of Object.entries(saved))v===undefined?delete process.env[k]:process.env[k]=v;});
const requested=[];
let upstream=()=>{throw Error('Unexpected network request; no paid API calls permitted')};
function fakeFetch(url,opts){
 requested.push({url:String(url),opts});
 return upstream(String(url),opts||{});
}
function load(path,imports={}){
 const source=fs.readFileSync(path,'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const module={exports:{}};
 const importFn=specifier=>{
  if(specifier in imports)return imports[specifier];
  throw Error('Unmocked import '+specifier);
 };
 new Function('require','module','exports','process','crypto','fetch','Request','Response','AbortController','setTimeout','clearTimeout','TextEncoder',compiled)(
  importFn,module,module.exports,process,webcrypto,fakeFetch,Request,Response,AbortController,setTimeout,clearTimeout,TextEncoder);
 return module.exports;
}
const policy=load('src/server/audioAi.ts');
const deps={'../../../src/server/audioAi':policy};
const upload=load('app/api/ai/upload+api.ts',deps);
const separate=load('app/api/ai/separate+api.ts',deps);
const job=load('app/api/ai/job+api.ts',deps);
const cancel=load('app/api/ai/cancel+api.ts',deps);
const signed={Authorization:'Bearer '+owner,'Content-Type':'application/json'};
const request=(path,body)=>new Request('https://himig-studio.expo.app'+path,{method:'POST',headers:signed,body:JSON.stringify(body)});
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}});
test('upload uses stable fal CDN initiation and accepts v3b media with provider-required headers',async()=>{
 requested.length=0;
 upstream=async()=>json({
  upload_url:'https://v3-uploads.fal.media/upload-test?signature=private',
  file_url:'https://v3b.fal.media/files/b/example/source.wav',
  upload_headers:{'x-amz-meta-test':'1'}
 });
 const r=await upload.POST(request('/api/ai/upload',{consent:true,content_type:'audio/wav',size_bytes:400000,file_name:'demo.wav'}));
 assert.equal(r.status,200);
 const body=await r.json();
 assert.equal(body.upload_headers['x-amz-meta-test'],'1');
 assert.ok(body.file_url.includes('v3b.fal.media'));
 assert.equal(requested.length,1);
 assert.equal(requested[0].url,'https://rest.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3');
 assert.equal(requested[0].opts.headers.Authorization,'Key SIMULATED_TEST_ONLY');
});
test('upload rejects vendor injecting credential header; no signed leak',async()=>{
 upstream=async()=>json({
  upload_url:'https://v3-uploads.fal.media/u?sig=secret',
  file_url:'https://v3b.fal.media/files/b/example/source.wav',
  upload_headers:{Authorization:'Bearer injected'}
 });
 const r=await upload.POST(request('/api/ai/upload',{consent:true,content_type:'audio/wav',size_bytes:400000,file_name:'demo.wav'}));
 assert.equal(r.status,502);
 assert.equal((await r.json()).error,'VENDOR_UPLOAD_CREDENTIAL_LEAK_BLOCKED');
});
test('separation rejects absent consent or unapproved CDN URLs without provider calls',async()=>{
 requested.length=0;
 const noConsent=await separate.POST(request('/api/ai/separate',{audio_url:'https://v3b.fal.media/files/b/example/song.wav'}));
 assert.equal(noConsent.status,422);
 const urlRejected=await separate.POST(request('/api/ai/separate',{consent:true,audio_url:'https://attacker.example/raw.wav'}));
 assert.equal(urlRejected.status,422);
 assert.equal(requested.length,0);
});
test('separation queues a real model job contract without sending unrelated words',async()=>{
 requested.length=0;
 upstream=async()=>json({
  request_id:uuid,
  status_url:'https://queue.fal.run/fal-ai/sam-audio/requests/'+uuid+'/status',
  response_url:'https://queue.fal.run/fal-ai/sam-audio/requests/'+uuid,
  cancel_url:'https://queue.fal.run/fal-ai/sam-audio/requests/'+uuid+'/cancel'
 });
 const r=await separate.POST(request('/api/ai/separate',{consent:true,audio_url:'https://v3b.fal.media/files/b/example/source.wav'}));
 assert.equal(r.status,200);
 assert.equal((await r.json()).state,'QUEUED');
 assert.equal(requested.length,1);
 assert.equal(requested[0].url,'https://queue.fal.run/fal-ai/sam-audio/separate');
 const args=JSON.parse(requested[0].opts.body);
 assert.equal(args.prompt,'singing voice');
 assert.equal(args.audio_url,'https://v3b.fal.media/files/b/example/source.wav');
 assert.ok(!('lyrics' in args));
});
test('job status and results reconstruct exact queue URLs from id; never accept client URL choice',async()=>{
 requested.length=0;
 upstream=async url=>url.endsWith('/status')?json({status:'COMPLETED',request_id:uuid}):json({
  target:{url:'https://v3b.fal.media/files/b/example/voice.wav'},
  residual:{url:'https://v3.fal.media/files/b/example/other.wav'},
  duration:32,sample_rate:48000
 });
 const r=await job.GET(new Request('https://himig-studio.expo.app/api/ai/job?id='+uuid+'&response_url=https://evil.example/&status_url=https://evil.example/',{headers:signed}));
 assert.equal(r.status,200);
 const data=await r.json();
 assert.equal(data.status,'REVIEW_REQUIRED');
 assert.equal(data.canBeStudioMaster,false);
 assert.equal(data.artifacts.vocalStem,'https://v3b.fal.media/files/b/example/voice.wav');
 assert.deepEqual(requested.map(x=>x.url),[
  'https://queue.fal.run/fal-ai/sam-audio/requests/'+uuid+'/status',
  'https://queue.fal.run/fal-ai/sam-audio/requests/'+uuid
 ]);
});
test('rejects unexpected model output URL without exposing unsafe audio link',async()=>{
 upstream=async url=>url.endsWith('/status')?json({status:'COMPLETED',request_id:uuid}):json({
  target:{url:'https://attacker.example/voice.wav'},
  residual:{url:'https://v3b.fal.media/files/b/example/other.wav'}
 });
 const r=await job.GET(new Request('https://himig-studio.expo.app/api/ai/job?id='+uuid,{headers:signed}));
 assert.equal(r.status,502);
 assert.equal((await r.json()).error,'BAD_STEM_OUTPUT');
});
test('cancel request uses canonical server URL even if user supplies a fake destination',async()=>{
 requested.length=0;
 upstream=async()=>json({status:'CANCELLATION_REQUESTED'},202);
 const r=await cancel.POST(request('/api/ai/cancel',{request_id:uuid,cancel_url:'https://evil.example/delete-everything'}));
 assert.equal(r.status,200);
 assert.equal((await r.json()).status,'CANCEL_REQUESTED');
 assert.equal(requested.length,1);
 assert.equal(requested[0].url,'https://queue.fal.run/fal-ai/sam-audio/requests/'+uuid+'/cancel');
 assert.equal(requested[0].opts.method,'PUT');
});
