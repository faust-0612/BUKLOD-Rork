const test=require('node:test');
const assert=require('node:assert/strict');
const {parseManifest,getSnapshot,PROJECT,RUNTIME,CHANNEL}=require('../scripts/buklod-production-expo-snapshot-20261122.cjs');
const fake={id:'11111111-2222-4333-8444-555555555555',runtimeVersion:'1.3.2',
  launchAsset:{hash:'a'.repeat(44)}};
test('valid production Expo update is fingerprinted read-only without proving source SHA',()=>{
  const result=parseManifest(JSON.stringify(fake),'branchname="production"',200);
  assert.equal(result.runtimeVersion,RUNTIME);
  assert.equal(result.channel,CHANNEL);
  assert.equal(result.bundleHash,'a'.repeat(44));
  assert.equal(result.sourceShaNotProven,true);
  assert.equal(result.productionMutation,false);
});
test('bad runtime, missing launch hash, wrong branch or status fails closed',()=>{
  assert.throws(()=>parseManifest(JSON.stringify({...fake,runtimeVersion:'2.0.3'}),'branchname="production"',200),/runtime/);
  assert.throws(()=>parseManifest(JSON.stringify({...fake,launchAsset:null}),'branchname="production"',200),/hash/);
  assert.throws(()=>parseManifest(JSON.stringify(fake),'branchname="staging"',200),/production/);
  assert.throws(()=>parseManifest(JSON.stringify(fake),'branchname="production"',429),/HTTP/);
});
test('proxy fetch uses correct Android runtime/channel and has no write method',async()=>{
  let checked=false;
  const result=await getSnapshot(async(url,opt)=>{
    assert.equal(url,'https://u.expo.dev/'+PROJECT);
    assert.equal(opt.headers['expo-platform'],'android');
    assert.equal(opt.headers['expo-channel-name'],'production');
    assert.equal(opt.headers['expo-runtime-version'],'1.3.2');
    assert.equal(opt.method,undefined);
    checked=true;
    return {status:200,headers:{get:()=> 'branchname="production"'},text:async()=>JSON.stringify(fake)};
  });
  assert.ok(checked);assert.equal(result.updateId,fake.id);
});
