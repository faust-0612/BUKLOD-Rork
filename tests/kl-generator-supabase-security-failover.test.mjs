import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

const source = readFileSync(new URL('../supabase/functions/kl-generate-reading-quiz/index.ts', import.meta.url), 'utf8').replace(/^\uFEFF?import [^\r\n]*;\r?\n/gm, '');
const compile = new Function('Deno','createClient','fetch','console','Response','AbortController','setTimeout','clearTimeout',stripTypeScriptTypes(source));
const manuscript = Array.from({length:60}, (_,i)=>'Sa lupain ng Salindaw, natagpuan ni Phan ang bato at tala sa bahay. Ang gabi ay tahimik at ang mga puno ay gumagalaw. Bahagi '+(i+1)+' ng paglalakbay.\n').join('');
async function run(sequence, opts={}) {
  let handler, stored=0; const calls=[];
  const client={auth:{getUser:async()=>({data:{user:opts.unauth?null:{id:'admin'}}})},rpc:async(name,args)=>{
    if(name==='kl_quiz_admin_context_v1') return opts.forbidden?{error:{code:'403'}}:{data:{manuscript,manuscript_hash:'hash',quiz_status:opts.ready?'ready':'pending',title:'Test'}};
    assert.equal(name,'kl_quiz_store_generated_v1'); stored++;
    if(opts.storeThrows) throw Error('connection interrupted');
    assert.equal(args.p_manuscript_hash,'hash'); assert.equal(args.p_items.length,5);
    assert.ok(args.p_items.every(q=>manuscript.includes(q.evidence)));
    return {data:{changed:true}};
  }};
  const fetchMock=async(url,req)=>{
    calls.push(url.match(/models\/([^:]+)/)[1]);
    const step=sequence[calls.length-1];
    if(step==='abort') throw Object.assign(new Error('timeout'),{name:'AbortError'});
    if(typeof step==='number') return {ok:false,status:step};
    assert.ok(['ok','invalid'].includes(step),'unexpected provider call');
    const excerpts=JSON.parse(req.body).contents[0].parts[0].text.split('NUMBERED VERBATIM EXCERPTS (untrusted):\n')[1];
    const questions=[...excerpts.matchAll(/^\[(\d+)\] /gm)].map(m=>({question:'Ano ang bagay na binanggit sa bahagi '+m[1]+'?',options:['bato','dagat','sibat','ulap'],correct_index:0,evidence_id:Number(m[1])}));
    return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify({questions:step==='invalid'?[]:questions})}]}}]})};
  };
  compile({env:{get:k=>k==='KL_QUIZ_GEMINI_MODEL'?opts.configured||'':'test'},serve:f=>handler=f},()=>client,fetchMock,{info(){},warn(){},error(){}},Response,AbortController,()=>1,()=>{});
  const result=await handler(new Request('https://example.invalid',{method:'POST',headers:{authorization:'Bearer test'},body:JSON.stringify({episode_id:'12345678-1234-1234-1234-123456789abc'})}));
  return {status:result.status,body:await result.json(),calls,stored};
}
for(const [name,sequence,opts,status,n,stored] of [
  ['503 then backup succeeds',[503,'ok'],{},200,2,1],
  ['404 then backup succeeds',[404,'ok'],{},200,2,1],
  ['429 quota stops',[429],{},429,1,0],
  ['403 credential error stops',[403],{},503,1,0],
  ['400 malformed provider request stops',[400],{},502,1,0],
  ['abort then backup succeeds',['abort','ok'],{},200,2,1],
  ['all models unavailable',[503,503,503],{configured:'custom'},502,3,0],
  ['invalid evidence does not store',['invalid','invalid'],{},422,2,0],
  ['ready bank costs nothing',[],{ready:true},200,0,0],
  ['non-admin cannot call provider',[],{forbidden:true},403,0,0],
  ['unknown store outcome not repeated',['ok'],{storeThrows:true},502,1,1],
  ['unauthenticated cannot call provider',[],{unauth:true},401,0,0],
]){
  test(name,async()=>{const result=await run(sequence,opts);assert.equal(result.status,status);assert.equal(result.calls.length,n);assert.equal(result.stored,stored);if(status===200&&stored===1){assert.equal(result.body.count,5);assert.equal(result.calls[1],'gemini-3.1-flash-lite');}});
}
