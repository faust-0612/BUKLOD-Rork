import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { applyCommunityWallMediaHydration } from '../src/lib/communityWallHydration.ts';

const scoped = fs.readFileSync('src/components/BuklodExclusiveScopeCommunity.tsx', 'utf8');
const android = fs.readFileSync('src/components/BuklodCachedMediaImage.android.tsx', 'utf8');

test('scoped Community paints first before independent names, comments and media finish', () => {
  const at = scoped.indexOf('const rows = (data ?? []) as SocialPost[];');
  const paint = scoped.indexOf('setPosts(previous =>', at);
  const media = scoped.indexOf('const mediaPromise =', at);
  const author = scoped.indexOf('const [namedRows, previewMap] = await Promise.all([', at);
  assert.ok(at > 0 && paint > at && paint < media && media < author);
  assert.match(scoped, /media_items: row\.media_path \|\| row\.media_url/);
  assert.match(scoped, /const scopeMediaLoadSeqRef = useRef\(0\)/);
  assert.match(scoped, /return \(\) => \{ scopeMediaLoadSeqRef\.current \+= 1; \}/);
});

test('scoped late media is applied by post ID and stale loads cannot override a new scope', () => {
  assert.match(scoped, /void mediaPromise\.then\(mediaMap =>/);
  assert.match(scoped, /applyCommunityWallMediaHydration\(previous, normalized\)/);
  assert.match(scoped, /scopeMediaLoadSeqRef\.current !== loadSeq/);
  const first = [{ id:'a',media_items:[{media_path:'a1'}] },{id:'b',media_items:[]}];
  const hydrated = applyCommunityWallMediaHydration(first, {b:[{media_path:'b2',media_position:2},{media_path:'b1',media_position:1}]});
  assert.deepEqual(hydrated[1].media_items.map(x=>x.media_path),['b1','b2']);
  assert.strictEqual(hydrated[0], first[0]);
});

test('slow metadata never overwrites media and Android never shows an unmarked empty tile', () => {
  const metadata = scoped.slice(scoped.indexOf('const [namedRows, previewMap] ='), scoped.indexOf("        }\n        catch (", scoped.indexOf('const [namedRows, previewMap] =')));
  assert.doesNotMatch(metadata, /media_items\s*:/);
  assert.match(android, /const pendingPaintIndicator = !actual\.painted/);
  assert.match(android, /\{pendingPaintIndicator\}/);
  assert.match(android, /backgroundColor: '#EEF3F0'/);
  assert.match(android, /onDisplay=\{\(\) => \{/);
  assert.match(android, /shouldMountWallOriginalUpgrade/);
  assert.doesNotMatch(android, /getPublicUrl|\/object\/public\//);
});

test('offline and error caches are generation-guarded after asynchronous reads', () => {
  assert.match(scoped, /if \(scopeMediaLoadSeqRef\.current !== loadSeq\) return;\s*if \(cached\?\.data\?\.length\)/);
});
