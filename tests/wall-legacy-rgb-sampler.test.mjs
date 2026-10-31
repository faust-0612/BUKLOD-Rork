import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sampleLegacyRgbPreview as convert} from '../supabase/functions/buklod-wall-preview-backfill/legacyRgbSampler.ts';

test('RGB camera bytes convert to RGBA with intact channels and opaque alpha',()=>{
  const image=convert({width:2,height:1,data:new Uint8Array([12,23,34,45,56,67])});
  assert.equal(image.width,2);assert.equal(image.height,1);
  assert.deepEqual([...image.data],[12,23,34,255,45,56,67,255]);
});
test('large image is sampled to a 384px bounding dimension',()=>{
  const result=convert({width:768,height:384,data:new Uint8Array(768*384*3)});
  assert.equal(result.width,384);assert.equal(result.height,192);
  assert.equal(result.data.length,384*192*4);
});
test('invalid stride, dimensions and oversized allocations fail closed',()=>{
  assert.throws(()=>convert({width:2,height:2,data:new Uint8Array(5)}));
  assert.throws(()=>convert({width:0,height:2,data:new Uint8Array()}));
  assert.throws(()=>convert({width:50000,height:50000,data:new Uint8Array()}));
});
test('worker decodes RGB within capped memory and retains private preview auth',()=>{
 const worker=readFileSync('supabase/functions/buklod-wall-preview-backfill/index.ts','utf8');
 assert.match(worker,/formatAsRGBA: false,\s*maxResolutionInMP: 24, maxMemoryUsageInMB: 168/);
 assert.match(worker,/sampleLegacyRgbPreview\(rgb\)/);
 assert.match(worker,/if \(!thumbnail\) thumbnail = compactJpeg\(bytes\)/);
 assert.match(worker,/buklod_legacy_preview_worker_auth_v1/);
 assert.doesNotMatch(worker,/getPublicUrl|\.remove\(/);
});

test('legacy fallback does not allow large-resolution decoding or public Storage bypass', () => {
 const worker=readFileSync('supabase/functions/buklod-wall-preview-backfill/index.ts','utf8');
 assert.match(worker,/maxResolutionInMP: 24, maxMemoryUsageInMB: 168/);
 assert.doesNotMatch(worker,/maxResolutionInMP: (?:3[0-9]|[4-9][0-9])/);
 assert.match(worker,/findEmbeddedLegacyJpegPreview\(bytes\)/);
 assert.match(worker,/buklod_legacy_preview_worker_auth_v1/);
 assert.match(worker,/thumbnail.length > 125000/);
 assert.doesNotMatch(worker,/getPublicUrl|\.remove\(/);
});
