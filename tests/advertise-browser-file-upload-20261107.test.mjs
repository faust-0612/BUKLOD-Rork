import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';

const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const upload=await import('data:text/javascript,'+encodeURIComponent(
  stripTypeScriptTypes(read('src/lib/advertise/readAdvertiseUploadBody.ts'))
));
const body=upload.readAdvertiseUploadBody;
const form=read('src/app/advertise/index.tsx');

test('browser Expo ImagePicker File uploads bytes without calling native expo-file-system',async()=>{
  const file=new Blob(['valid-photo-data'],{type:'image/jpeg'});
  let nativeCalls=0;
  let browserFetchCalls=0;
  const result=await body({uri:'blob:https://buklod.expo.app/mock',file},true,
    async()=>{nativeCalls++;throw Error('expo-file-system unsupported on web');},
    async()=>{browserFetchCalls++;throw Error('unexpected fallback fetch');});
  assert.strictEqual(result,file);
  assert.equal(nativeCalls,0);
  assert.equal(browserFetchCalls,0);
  assert.equal(result.size,16);
});

test('web picker blob URI fallback handles older Expo browsers without File property',async()=>{
  const wanted=new Blob(['abc-video'],{type:'video/mp4'});
  let url='';
  const result=await body({uri:'blob:https://buklod.expo.app/older'},true,
    async()=>{throw Error('must not use native reader');},
    async(uri)=>{url=uri;return wanted;});
  assert.strictEqual(result,wanted);
  assert.equal(url,'blob:https://buklod.expo.app/older');
});

test('web rejects empty files and broken blob URIs with actionable errors',async()=>{
  await assert.rejects(
    body({uri:'blob:empty',file:new Blob([])},true,async()=>{throw Error('no native');}),
    /selected browser file is empty/i
  );
  await assert.rejects(
    body({uri:'blob:lost'},true,async()=>{throw Error('no native');},
      async()=>{throw Error('Cannot read selected browser media. Please select the file again.');}),
    /select the file again/i
  );
});

test('native photo/video/proof uses original decoded ArrayBuffer and never browser fetch',async()=>{
  const expected=new Uint8Array([0,255,20,10]).buffer;
  let calls=0;
  const actual=await body({uri:'file:///private/photo.jpg'},false,
    async()=>{calls++;return expected;},
    async()=>{throw Error('web fetch attempted on Android');});
  assert.strictEqual(actual,expected);
  assert.equal(calls,1);
  await assert.rejects(
    body({uri:'file:///empty'},false,async()=>new ArrayBuffer(0)),
    /selected file is empty/i
  );
});

test('form wires same platform-aware upload into photo/video and payment proof buckets',()=>{
  assert.match(form,/import \{readAdvertiseUploadBody\} from '@\/lib\/advertise\/readAdvertiseUploadBody'/);
  assert.match(form,/const fileBody=await readAdvertiseUploadBody\(/);
  assert.match(form,/Platform\.OS==='web'/);
  assert.match(form,/file:a\.file/);
  assert.match(form,/decode\(await FileSystem\.readAsStringAsync\(a\.uri/);
  assert.match(form,/\.upload\(path,fileBody,\{contentType:mime\(a,c\),upsert:false\}\)/);
  assert.match(form,/uploadAsset\(asset,'paid-ad-media','creative',creative\)/);
  assert.match(form,/uploadAsset\(proof,'paid-ad-payment','payment','proof'\)/);
  assert.match(form,/maxBytes=bucket==='paid-ad-payment'\?10\*1024\*1024:50\*1024\*1024/);
  assert.match(form,/payment_status:'pending'/);
  assert.match(form,/status:'pending'/);
  assert.match(form,/testID="advertise-submit"/);
  assert.doesNotMatch(form,/status:'approved'|payment_status:'paid'/);
});
