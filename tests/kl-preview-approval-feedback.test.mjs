import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  klServerApprovedCount,
  klSceneEffectSaved,
  klPreviewReadyForEpisode,
} from '../src/lib/kabihasnang-ligaw/mediaApprovalState.ts';

test('server media approval is not inferred from visual or chapter approval', () => {
  const media = [
    { approved: false, kind: 'illustration', placement: 1 },
    { approved: false, kind: 'illustration', placement: 2 },
    { approved: false, kind: 'illustration', placement: 3 },
    { approved: false, kind: 'music', placement: 0 },
  ];
  assert.equal(klServerApprovedCount(media), 0);
  assert.equal(klServerApprovedCount([{ approved: true }, ...media]), 1);
  assert.equal(klServerApprovedCount([{ approved: null }, { approved: undefined }]), 0);
});

test('prepared private preview is scoped to exact chapter and server confirmation', () => {
  const episodes = [{ id: 'ch2', preview_ready: true }, { id: 'ch3', preview_ready: false }];
  assert.equal(klPreviewReadyForEpisode(episodes, 'ch2', ''), true);
  assert.equal(klPreviewReadyForEpisode(episodes, 'ch3', ''), false);
  assert.equal(klPreviewReadyForEpisode(episodes, 'ch3', 'ch3'), true);
  assert.equal(klPreviewReadyForEpisode(episodes, 'ch2', 'ch3'), true);
  assert.equal(klPreviewReadyForEpisode([{ id: 'ch2', preview_ready: false }], 'ch2', ''), false);
  assert.equal(klPreviewReadyForEpisode(episodes, '', ''), false);
});

test('scene effect save badge follows server values, not an unsaved edit', () => {
  const saved = { effect: 'fog', intensity: 60 };
  assert.equal(klSceneEffectSaved(saved, 'fog', 60), true);
  assert.equal(klSceneEffectSaved(saved, 'rain', 60), false);
  assert.equal(klSceneEffectSaved(saved, 'fog', 20), false);
  assert.equal(klSceneEffectSaved({ effect: 'none', intensity: 0 }, 'none', 0), true);
  assert.equal(klSceneEffectSaved({ effect: null, intensity: null }, 'none', 30), true);
  assert.equal(klSceneEffectSaved(undefined, 'none', 30), false);
});

test('Profile KL displays media approval controls and synchronizes after server approval', () => {
  const studio = readFileSync('src/components/kabihasnang-ligaw/KlPublishingStudio.tsx', 'utf8');
  const media = readFileSync('src/components/kabihasnang-ligaw/KlAdminMediaUpload.tsx', 'utf8');
  const preview = readFileSync('src/components/kabihasnang-ligaw/KlAdminPreview.tsx', 'utf8');
  assert.match(studio, /klPreviewReadyForEpisode\(episodes, id, confirmedPreviewId\)/);
  assert.match(studio, /Open Private Preview & Media Approvals/);
  assert.match(studio, /onApproved=\{\(\) => setApprovalRefreshToken/);
  assert.match(media, /\[approvalRefreshToken\]/);
  assert.match(media, /void refreshMedia\(\)/);
  assert.match(preview, /supabase.rpc\('kl_admin_media_approve_v1'/);
  assert.match(preview, /onApproved\?\.\(\)/);
});

test('real saves preserve preview on no-op but invalidate it on changed scene data', () => {
  const studio = readFileSync('src/components/kabihasnang-ligaw/KlPublishingStudio.tsx', 'utf8');
  const media = readFileSync('src/components/kabihasnang-ligaw/KlAdminMediaUpload.tsx', 'utf8');
  assert.match(studio, /\.changed !== false/);
  assert.equal(media.match(/if \(changed\) onPreviewInvalidated\?\.\(\);/g)?.length, 2);
  assert.match(media, /placementSaved \? <Text/);
  assert.match(media, /effectSaved \? '✓ Scene '/);
});
