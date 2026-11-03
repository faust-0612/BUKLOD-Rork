import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const cluster = readFileSync('src/components/BuklodClusterHomeCommandCenterImpl.tsx', 'utf8');
const member = readFileSync('src/app/member/[id].tsx', 'utf8');

test('Cluster Home community posts use the common source-aware photo collage', () => {
  assert.match(cluster, /BuklodCommunityPhotoCollage/);
  assert.match(cluster, /communityPhotoCollageItems\(null,/);
  assert.doesNotMatch(cluster, /<Image source=\{\{uri:x\.media_url\}\}/);
});

test('Cluster Home video previews do not eagerly mount offscreen players', () => {
  assert.match(cluster, /<CommunityVideo uri=\{x\.media_url\} active=\{false\}/);
  assert.match(cluster, /onOpenFullscreen=\{\(\)=>router\.push\(\{pathname:'\/post\/\[id\]'/);
});

test('Member profile posts use shared photo framing and safe video previews', () => {
  assert.match(member, /BuklodCommunityPhotoCollage/);
  assert.match(member, /<CommunityVideo[\s\S]*?active=\{false\}/);
  assert.match(member, /onOpenFullscreen=\{\(\)=>router\.push\(\{ pathname: '\/post\/\[id\]'/);
  assert.doesNotMatch(member, /<Image/);
});
