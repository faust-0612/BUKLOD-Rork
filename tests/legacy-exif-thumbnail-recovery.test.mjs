import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {findEmbeddedLegacyJpegPreview as get} from '../supabase/functions/buklod-wall-preview-backfill/legacyThumbnail.ts';

function fixture(size=1100, badOffset=false){
  const t=new Uint8Array(44+size);
  t.set([73,73,42,0,8,0,0,0,0,0,14,0,0,0,0,0,2,0],0);
  // IFD1 at offset 14: two LONG entries (offset, length).
  t.set([1,2,4,0,1,0,0,0],16);
  const off=badOffset?0xffffff:44;
  t.set([off&255,(off>>>8)&255,(off>>>16)&255,(off>>>24)&255],24);
  t.set([2,2,4,0,1,0,0,0],28);
  t.set([size&255,(size>>>8)&255,(size>>>16)&255,(size>>>24)&255],36);
  t[44]=255;t[45]=216;t[t.length-2]=255;t[t.length-1]=217;
  const x=new Uint8Array(6+t.length);
  x.set([69,120,105,102,0,0],0);x.set(t,6);
  const len=x.length+2, output=new Uint8Array(6+x.length+2);
  output.set([255,216,255,225,(len>>>8)&255,len&255],0);
  output.set(x,6);output.set([255,217],output.length-2);
  return {output,expected:t.slice(44)};
}
test('extracts EXIF IFD1 JPEG without full original decode',()=>{
  const {output,expected}=fixture();
  assert.deepEqual(get(output),expected);
});
test('rejects forged out-of-segment offsets and tiny thumbnails',()=>{
  assert.equal(get(fixture(1100,true).output),null);
  assert.equal(get(fixture(500).output),null);
});
test('no EXIF, non-JPEG and truncated data do not fabricate a preview',()=>{
  assert.equal(get(new Uint8Array([255,216,255,217])),null);
  assert.equal(get(new Uint8Array([137,80,78,71])),null);
  assert.equal(get(fixture().output.slice(0,35)),null);
});
test('worker verifies thumbnail with bounded decoder and retains secure fallback',()=>{
  const source=readFileSync('supabase/functions/buklod-wall-preview-backfill/index.ts','utf8');
  assert.match(source,/findEmbeddedLegacyJpegPreview\(bytes\)/);
  assert.match(source,/maxResolutionInMP: 1, maxMemoryUsageInMB: 16/);
  assert.match(source,/if \(!thumbnail\) thumbnail = compactJpeg\(bytes\)/);
  assert.ok(source.indexOf('buklod_legacy_preview_worker_auth_v1') < source.indexOf('findEmbeddedLegacyJpegPreview(bytes)'));
  assert.doesNotMatch(source,/getPublicUrl|upsert: true|\.remove\(/);
});
