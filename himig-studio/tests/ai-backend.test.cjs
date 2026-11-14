const fs=require('node:fs'), assert=require('node:assert/strict'),{test}=require('node:test'),ts=require('typescript');
const raw=fs.readFileSync('src/server/audioAi.ts','utf8');
const js=ts.transpileModule(raw,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const holder={exports:{}};
new Function('module','exports','require','process','crypto','fetch',js)(holder,holder.exports,require,process,require('node:crypto').webcrypto,fetch);
const mod=holder.exports;
const uuid='019a1b2c-3d4e-7f80-9a1b-2c3d4e5f6a7b';
test('external AI is disabled without explicit billing and server secrets',async()=>{
 const vals=['FAL_KEY','HIMIG_OWNER_TOKEN','HIMIG_ENABLE_PAID_AI'].map(x=>process.env[x]);
 delete process.env.FAL_KEY;delete process.env.HIMIG_OWNER_TOKEN;delete process.env.HIMIG_ENABLE_PAID_AI;
 try{
  assert.equal(mod.configured(),false);
  const resp=await mod.authorize(new Request('https://himig-studio.expo.app/api/ai/separate',{method:'POST'}));
  assert.equal(resp.status,503);
  assert.equal((await resp.json()).error,'AI_BACKEND_DISABLED');
 }finally{['FAL_KEY','HIMIG_OWNER_TOKEN','HIMIG_ENABLE_PAID_AI'].forEach((k,i)=>vals[i]===undefined?delete process.env[k]:process.env[k]=vals[i]);}
});
test('only one fixed model and strict fal media/queue URL allowlist',()=>{
 assert.equal(mod.MODEL,'fal-ai/sam-audio/separate');
 assert.ok(mod.isFalAudioUrl('https://v3.fal.media/files/b/demo.wav'));
 assert.ok(!mod.isFalAudioUrl('http://v3.fal.media/files/a.wav'));
 assert.ok(!mod.isFalAudioUrl('https://v3.fal.media.evil.com/files/a.wav'));
 assert.ok(!mod.isFalAudioUrl('https://evil.com'));
 assert.ok(!mod.isFalUploadUrl('https://v3-uploads.fal.media.evil.example/files/u'));
 assert.ok(mod.isQueueUrl('https://queue.fal.run/fal-ai/sam-audio/requests/'+uuid+'/status',uuid));
 assert.ok(!mod.isQueueUrl('https://queue.fal.run.evil.com/fal-ai/sam-audio/requests/'+uuid+'/status',uuid));
 assert.ok(!mod.isQueueUrl('http://queue.fal.run/fal-ai/sam-audio/requests/'+uuid+'/status',uuid));
 assert.ok(!mod.isQueueUrl('https://queue.fal.run/other/model/requests/'+uuid+'/status',uuid));
 assert.ok(!mod.isQueueUrl('https://queue.fal.run/fal-ai/sam-audio/requests/'+uuid+'/status','definitely-not-id'));
});
test('authorized bearer token must match exactly and only when explicitly enabled',async()=>{
 const old={FAL_KEY:process.env.FAL_KEY,HIMIG_OWNER_TOKEN:process.env.HIMIG_OWNER_TOKEN,HIMIG_ENABLE_PAID_AI:process.env.HIMIG_ENABLE_PAID_AI};
 process.env.FAL_KEY='test-token-not-real';
 process.env.HIMIG_OWNER_TOKEN='12345678901234567890123456789012';
 process.env.HIMIG_ENABLE_PAID_AI='true';
 try{
  const denied=await mod.authorize(new Request('https://example.com',{headers:{Authorization:'Bearer wrong'}}));
  assert.equal(denied.status,401);
  const allowed=await mod.authorize(new Request('https://example.com',{headers:{Authorization:'Bearer 12345678901234567890123456789012'}}));
  assert.equal(allowed,null);
 }finally{for(const [k,v] of Object.entries(old))v===undefined?delete process.env[k]:process.env[k]=v;}
});
test('server routes are configured only for explicit-consent media, not public browser model keys',()=>{
 const files=['app/api/ai/upload+api.ts','app/api/ai/separate+api.ts','app/api/ai/job+api.ts','app/api/ai/cancel+api.ts'];
 for(const file of files){
   const content=fs.readFileSync(file,'utf8');
   assert.match(content,/authorize\(req\)/,file);
 }
 const start=fs.readFileSync(files[1],'utf8');
 assert.ok(start.includes('body.consent!==true'));
 const ui=fs.readFileSync('src/AiStemPanel.tsx','utf8');
 assert.ok(ui.includes('I own or am allowed to process this recording'));
 assert.ok(!ui.includes('process.env.FAL_KEY'));
 assert.ok(ui.includes('Provider upload'));
 assert.ok(ui.includes('Recover previous job by request ID'));
 assert.ok(ui.includes('const busyLock=useRef(false)'));
 assert.ok(ui.includes('if(!job||busyLock.current)return;'));
 assert.ok(ui.includes('disabled={submitStarted}'));
 const config=JSON.parse(fs.readFileSync('app.json','utf8')).expo;
 assert.equal(config.web.output,'server');
 assert.equal(config.extra.eas.projectId,'05e7dab7-a7fd-490c-af52-a54a3609ec35');
});
