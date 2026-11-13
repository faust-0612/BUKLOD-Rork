import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import {
  inspectNavV2Checklist, inspectNavV2Prepublish,
} from '../scripts/navigation-v2-staging-gate.mjs';
import { resolveBuklodWallMaritesVideoPriority } from '../src/lib/buklodMaritesViewportMeasure.ts';

const checklist=JSON.parse(fs.readFileSync(new URL('../docs/navigation-v2-completion.json',import.meta.url),'utf8'));
const evidence=JSON.parse(fs.readFileSync(new URL('../release/navigation-v2-staging-evidence.json',import.meta.url),'utf8'));

test('combined candidate preserves exact 21-item staging gate and rejects missing installed attestation', () => {
  const status=inspectNavV2Checklist(checklist);
  assert.equal(status.total,21);
  assert.equal(status.failures.length,0);
  assert.equal(status.ready,false,'this frozen DEV candidate has not passed installed staging acceptance');
  const published=inspectNavV2Prepublish(checklist,evidence,'73c473caa4ebc139be4b231d3097760fe5c246e5');
  assert.equal(published.ready,false);
  assert.ok(published.failures.some(x=>/staging|prepublish|unverified/i.test(x)));
});

test('Marites fullscreen wins exclusive media priority over active Wall video, and closing restores it', () => {
  const opts={wallFocused:true,wallVideoVisible:true,wallFullscreenOpen:false,
    commentOpen:false,maritesViewerOpen:false};
  assert.deepEqual(resolveBuklodWallMaritesVideoPriority(opts),{wallVideoEligible:true,maritesBlocked:true});
  assert.deepEqual(resolveBuklodWallMaritesVideoPriority({...opts,maritesViewerOpen:true}),
    {wallVideoEligible:false,maritesBlocked:false});
  assert.deepEqual(resolveBuklodWallMaritesVideoPriority({...opts,wallFocused:false,maritesViewerOpen:true}),
    {wallVideoEligible:false,maritesBlocked:true});
  assert.deepEqual(resolveBuklodWallMaritesVideoPriority(opts),{wallVideoEligible:true,maritesBlocked:true});
});

test('combined UI retains canonical navigation, accessibility and native ads without overlapping player hooks', () => {
  const wall=fs.readFileSync(new URL('../src/app/(tabs)/buklod.tsx',import.meta.url),'utf8');
  const marites=fs.readFileSync(new URL('../src/components/BuklodMaritesBoard.tsx',import.meta.url),'utf8');
  const bottom=fs.readFileSync(new URL('../src/components/BuklodPersistentBottomNav.tsx',import.meta.url),'utf8');
  const profile=fs.readFileSync(new URL('../src/app/(tabs)/me.tsx',import.meta.url),'utf8');
  const finder=fs.readFileSync(new URL('../src/components/BuklodFeatureFinder.tsx',import.meta.url),'utf8');
  assert.match(bottom,/fontScale|getBuklodNavTypographyExtraHeight/);
  assert.match(profile,/settings|Settings/);
  assert.match(finder,/Search|search/);
  assert.match(wall,/onViewerVisibilityChange=\{setMaritesViewerOpen\}/);
  assert.match(wall,/<BuklodCommunityInlineAd/);
  assert.match(marites,/createMaritesVisibilityScheduler/);
  assert.match(marites,/autoPlayVideo=\{canPlayInline && index === visibleVideoIndex\}/);
});
