import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCommunityWallSharpGate } from '../src/lib/communityWallSharpUpgrade.ts';
import { shouldRevealWallOriginal, releaseWallOriginalTransferOnDecode, isCurrentWallOriginalEvent } from '../src/lib/communityWallPhotoDisplayGate.ts';
import { createWallOriginalReadyChannel } from '../src/lib/communityWallOriginalReady.ts';
const decoded = { expectedUrl:'original', decodedUrl:'original', width:2048, height:1536, activeRenderer:'expo', renderedBy:'expo', displayed:false };
test('downloaded original frees next photo while paint still requires display acknowledgement', async () => {
  const gate = createCommunityWallSharpGate(1);
  const release = await gate.request().granted;
  const next = gate.request();
  assert.equal(shouldRevealWallOriginal(decoded), false);
  assert.equal(releaseWallOriginalTransferOnDecode(decoded, release), true);
  const releaseNext = await next.granted;
  assert.deepEqual(gate.stats(), {active:1, queued:0});
  releaseWallOriginalTransferOnDecode(decoded, release);
  assert.equal(gate.stats().active, 1);
  assert.equal(shouldRevealWallOriginal({...decoded, displayed:true}), true);
  releaseNext();
});
test('stale URLs, renderer callbacks and invalid dimensions cannot release another transfer', () => {
  let releases=0;
  for (const delta of [{decodedUrl:'old'}, {renderedBy:'native'}, {width:0}, {height:NaN}, {expectedUrl:''}]) {
    assert.equal(releaseWallOriginalTransferOnDecode({...decoded,...delta}, () => releases++), false);
  }
  assert.equal(releases, 0);
  assert.equal(isCurrentWallOriginalEvent('new','old','expo','expo'), false);
  assert.equal(isCurrentWallOriginalEvent('new','new','native','expo'), false);
  assert.equal(isCurrentWallOriginalEvent('new','new','expo','expo'), true);
});
test('fullscreen completion wakes only mounted Wall tiles for the same original', () => {
  const channel = createWallOriginalReadyChannel();
  const seen=[];
  const stop=channel.subscribe('photo-a', url=>seen.push(url));
  const stopOther=channel.subscribe('photo-b', ()=>assert.fail('different photo'));
  channel.publish('photo-bogus','url');
  channel.publish('photo-a','cached-original');
  assert.deepEqual(seen,['cached-original']);
  stop(); stopOther();
  channel.publish('photo-a','later');
  channel.subscribe('photo-a', url=>seen.push(url));
  assert.deepEqual(seen,['cached-original']); // No replay of old account/session URLs.
});
test('fullscreen cached original bypasses an occupied download gate without admitting network work', async () => {
  const gate=createCommunityWallSharpGate(1);
  const release=await gate.request().granted;
  const queued=gate.request();
  const channel=createWallOriginalReadyChannel();
  let source=null;
  const stop=channel.subscribe('photo', url=>{ queued.cancel(); source=url; });
  channel.publish('photo','warm-cache-url');
  assert.equal(await queued.granted,null);
  assert.equal(source,'warm-cache-url');
  assert.deepEqual(gate.stats(),{active:1,queued:0});
  stop(); release();
});
test('Android integration publishes only original Expo paint and consumes before download admission', () => {
  const source=readFileSync('src/components/BuklodCachedMediaImage.android.tsx','utf8');
  assert.match(source,/!usingPreview && !actual.painted && originalPath && actual.url/);
  assert.match(source,/wallOriginalReady.publish\(originalPath, actual.url\)/);
  assert.ok(source.indexOf('const available = availableOriginalRef.current') < source.indexOf('communityWallSharpGate.request()'));
  assert.match(source,/releaseDecodedTransfer\(decoded.width, decoded.height, 'expo'\)/);
  assert.match(source,/refreshOriginalUrlRef.current\s*\? resignCommunityMediaUrl\(mediaPath\)/);
  assert.equal((source.match(/if \(!accepts\('expo'\)\) return/g)||[]).length,3);
});
