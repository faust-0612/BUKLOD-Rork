const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
function mod(file,deps={}) {
 let src=stripTypeScriptTypes(fs.readFileSync(path.join(root,file),'utf8'));
 src=src.replace(/import[\s\S]*?from\s+['"][^'"]+['"];?/g,'').replace(/export\s+(?=(async\s+)?function|class|const)/g,'');
 const names=[...src.matchAll(/^(?:async\s+)?function\s+(\w+)|^class\s+(\w+)/gm)].map(m=>m[1]||m[2]);
 const ctx={console,Promise,Date,Map,Set,Error,process,Response,Headers,URL,AbortController,setTimeout,clearTimeout,setInterval,clearInterval,...deps};
 vm.createContext(ctx);vm.runInContext(src+'\nthis.exports={'+names.join(',')+'}',ctx);return ctx.exports;
}
const timeout=mod('src/lib/buklodAsyncTimeout.ts');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}};
const tick=()=>new Promise(r=>setImmediate(r));
test('timeout bounds UI wait and does not cancel late task',async()=>{
 const d=deferred();await assert.rejects(timeout.withBuklodTimeout(d.promise,5,'test'),/timed out/);d.resolve(7);assert.equal(await d.promise,7);
});
test('concurrent login never inherits previous credentials session; lock releases',async()=>{
 const d=deferred();let calls=0;
 const api=mod('src/lib/buklodAuthResilience.ts',{supabase:{auth:{signInWithPassword:()=>{calls++;return calls===1?d.promise:Promise.resolve({data:{user:{id:'B'}},error:null})}}},...timeout});
 const first=api.signInWithPasswordResilient({email:'A',password:'a'});
 const second=await api.signInWithPasswordResilient({email:'B',password:'b'});
 assert.equal(second.data.session,null);assert.equal(second.error.code,'auth_in_progress');assert.equal(calls,1);
 d.resolve({data:{user:{id:'A'}},error:null});assert.equal((await first).data.user.id,'A');await tick();
 assert.equal((await api.signInWithPasswordResilient({email:'B',password:'b'})).data.user.id,'B');
});
test('auth invalid credentials stay distinct from transient network failures',()=>{
 const api=mod('src/lib/buklodAuthResilience.ts',{supabase:{},...timeout});
 assert.equal(api.isBuklodTransientAuthError({code:'invalid_credentials'}),false);
 assert.equal(api.isBuklodTransientAuthError({status:503}),true);
});
test('selected referral calls authoritative attach without redundant lookup',async()=>{
 const calls=[];const api=mod('src/lib/buklodRewards.ts',{supabase:{rpc:async(n,a)=>{calls.push([n,a]);return {error:null}}}});
 await api.recordReferral(' CODE ',{alreadyResolved:true});assert.equal(calls.length,1);assert.equal(calls[0][0],'buklod_record_referral_v1');assert.equal(calls[0][1].p_referrer_code,'CODE');
});
test('unresolved referral and attach failure do not claim success',async()=>{
 const api=mod('src/lib/buklodRewards.ts',{supabase:{rpc:async(n)=>n==='resolve_buklod_referral_target_v1'?{data:{found:false,message:'No match'}}:{error:new Error('Not authenticated')}}});
 await assert.rejects(api.recordReferral('unknown'),/No match/);
 await assert.rejects(api.recordReferral('CODE',{alreadyResolved:true}),/Not authenticated/);
});
function hookHarness(fetcher,cache=null,timeoutFn=timeout.withBuklodTimeout){
 let slots=[],i=0,effects=[],deps=[],options={cacheKey:'A',fetcher},reports=[];
 const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,j)=>Object.is(v,b[j]));
 const api=mod('src/hooks/useBuklodOfflineCache.ts',{
 useState:v=>{const n=i++;if(!(n in slots))slots[n]=v;return [slots[n],v=>slots[n]=typeof v==='function'?v(slots[n]):v]},
 useRef:v=>{const n=i++;return slots[n]??(slots[n]={current:v})},
 useEffect:(f,d)=>{const n=i++;if(!same(deps[n],d)){deps[n]=d;effects.push(f)}},useCallback:(f,d)=>{i++;return f},
 useNetwork:()=>({isConnected:true,isInternetReachable:true}),readOfflineCacheSync:()=>cache,readOfflineCache:async()=>cache,writeOfflineCache:async()=>{},withBuklodTimeout:timeoutFn,
 reportBuklodMainHealthIssue:async x=>reports.push(x),
 });
 return {render:next=>{options={...options,...next};i=0;const value=api.useBuklodOfflineCache(options);for(const f of effects.splice(0))f();return value},reports};
}
test('cache visible immediately; overlapping refreshes use one underlying request',async()=>{
 const d=deferred();let calls=0;const h=hookHarness(()=>{calls++;return d.promise},'saved');let out=h.render();assert.equal(out.data,'saved');assert.equal(out.loading,false);
 const a=out.refresh(),b=out.refresh();await tick();assert.equal(calls,1);d.resolve('fresh');await Promise.all([a,b]);out=h.render();assert.equal(out.data,'fresh');
});
test('late old account response cannot overwrite new cache scope',async()=>{
 const a=deferred(),b=deferred();const h=hookHarness(()=>a.promise);h.render();await tick();h.render({cacheKey:'B',fetcher:()=>b.promise});await tick();b.resolve('B');await tick();a.resolve('A');await tick();assert.equal(h.render().data,'B');
});
test('hung content stops loading, preserves cache and reports fixed operational label',async()=>{
 const h=hookHarness(()=>new Promise(()=>{}),'saved',(p,ms,label)=>timeout.withBuklodTimeout(p,5,label));h.render();await new Promise(r=>setTimeout(r,20));const out=h.render();assert.equal(out.loading,false);assert.equal(out.syncing,false);assert.equal(out.data,'saved');assert.ok(h.reports.length);assert.equal(h.reports[0].routeModule,'offline-cache');assert.equal(JSON.stringify(h.reports).includes('cacheKey'),false);
});

test('referral mutation is never cached/coalesced by root transport',async()=>{
 let calls=0;const api=mod('src/lib/buklodPerformanceFetch.ts');const f=api.createBuklodPerformanceFetch(async()=>{calls++;return new Response(null,{status:204})});
 const u='https://example.invalid/rest/v1/rpc/buklod_record_referral_v1';
 await Promise.all([f(u,{method:'POST',body:'{}'}),f(u,{method:'POST',body:'{}'})]);assert.equal(calls,2);
});
test('safe reads coalesce, stay isolated by authorization, and writes bypass',async()=>{
 let calls=0;const api=mod('src/lib/buklodPerformanceFetch.ts');const f=api.createBuklodPerformanceFetch(async()=>{calls++;await tick();return new Response('{}')});
 const u='https://example.invalid/rest/v1/profiles?select=id';
 await Promise.all([f(u,{headers:{authorization:'A'}}),f(u,{headers:{authorization:'A'}})]);assert.equal(calls,1);
 await f(u,{headers:{authorization:'B'}});assert.equal(calls,2);
 await f(u,{method:'PATCH',body:'{}'});assert.equal(calls,3);
});
test('hung safe response body times out and releases transport lock for retry',async()=>{
 let calls=0;const api=mod('src/lib/buklodPerformanceFetch.ts',{setTimeout:(f,ms)=>setTimeout(f,ms===12000?5:ms)});
 const f=api.createBuklodPerformanceFetch(async()=>{calls++;return {status:200,statusText:'OK',headers:new Headers(),text:()=>new Promise(()=>{})}});
 const u='https://example.invalid/rest/v1/profiles';
 await assert.rejects(f(u),/timed out/);assert.equal(api.getBuklodPerformanceFetchStats().inFlight,0);
 await assert.rejects(f(u),/timed out/);assert.equal(calls,2);
});

test('failed refresh retains saved data and surfaces retry feedback',async()=>{
 const h=hookHarness(async()=>{throw new Error('network unavailable')},'saved');h.render();await tick();const out=h.render();assert.equal(out.data,'saved');assert.equal(out.loading,false);assert.match(out.error,/network unavailable/);
});
test('disabled scope clears saved content and avoids network',async()=>{
 let calls=0;const h=hookHarness(async()=>{calls++;return 'fresh'},'saved');h.render({enabled:false});await tick();const out=h.render();assert.equal(out.data,null);assert.equal(out.loading,false);assert.equal(calls,0);
});
test('rejected login releases lock and permits a subsequent attempt',async()=>{
 let calls=0;const api=mod('src/lib/buklodAuthResilience.ts',{supabase:{auth:{signInWithPassword:()=>++calls===1?Promise.reject(new Error('network unavailable')):Promise.resolve({data:{user:{id:'B'}},error:null})}},...timeout});
 assert.match((await api.signInWithPasswordResilient({email:'A',password:'a'})).error.message,/network/);await tick();assert.equal((await api.signInWithPasswordResilient({email:'B',password:'b'})).data.user.id,'B');
});
