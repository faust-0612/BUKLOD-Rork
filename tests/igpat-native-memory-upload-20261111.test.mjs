import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const feed = readFileSync('src/app/igpat/index.tsx', 'utf8');
const creator = readFileSync('src/app/igpat/create.tsx', 'utf8');

test('IGPAT native releases hidden feed players and does not preload hidden Reels ads', () => {
  assert.match(feed, /import \{ useScreenFocused \} from '@\/hooks\/useScreenFocused'/);
  assert.match(feed, /const screenFocused = useScreenFocused\(\)/);
  assert.match(feed, /const active=screenFocused && index===activeIndex/);
  assert.match(feed, /\{screenFocused \? \(\s*<BuklodReelsInlineAd/);
  assert.match(feed, /screenFocused && !!item\.media_url && \(index === activeIndex \|\| index === nextPlayableIndex\)/);
  assert.match(feed, /<IgpatVideo uri=\{item\.media_url\} active=\{index === activeIndex\}/);
});

test('IGPAT creator stops decoding its preview during heavy uploads', () => {
  assert.match(creator, /\{busy \? \(\s*<View style=\{\[styles\.preview, styles\.pausedPreview\]\}>/);
  assert.match(creator, /\) : \(\s*<Preview uri=\{draft\.uri\} \/>/);
  assert.match(creator, /setBusy\(true\)/);
  assert.match(creator, /finally \{\s*setBusy\(false\)/);
});

test('IGPAT waits to warm full-screen ad until upload is complete and never gates server publishing', () => {
  const upload = creator.indexOf('await uploadCommunityVideoFile({');
  const warm = creator.indexOf("warmBuklodAdOpportunity('igpat_video_published')");
  const rpc = creator.indexOf(".rpc('create_buklod_reel_v1'");
  const show = creator.indexOf("await showBuklodAdOpportunity('igpat_video_published')");
  assert.ok(upload >= 0 && upload < warm && warm < rpc && rpc < show);
  assert.equal(creator.match(/warmBuklodAdOpportunity\('igpat_video_published'\)/g)?.length, 1);
});
