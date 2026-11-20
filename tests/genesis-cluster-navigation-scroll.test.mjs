import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const cluster = fs.readFileSync('src/app/clusters/index.tsx', 'utf8');
const scope = fs.readFileSync('src/app/scope/index.tsx', 'utf8');
const wall = fs.readFileSync('src/components/BuklodExclusiveScopeCommunity.tsx', 'utf8');
const atmosphere = fs.readFileSync('src/features/season2/genesis/GenesisVisuals.tsx', 'utf8');

test('Cluster directory shows the existing Genesis sky behind a transparent scroll canvas', () => {
  assert.match(cluster, /isGenesisPreviewBuild\(\)/);
  assert.match(cluster, /<GenesisCosmosBackground active=\{clusterFocused\} \/>/);
  assert.match(cluster, /backgroundColor: genesisClusterCanvas \? '#070D22' : theme\.canvas/);
  assert.match(cluster, /<BuklodPortalScrollView[\s\S]*?backgroundColor: 'transparent'/);
  assert.match(cluster, /refreshControl=/);
});

test('Creation movement suspends offscreen, in background or with reduced-motion enabled', () => {
  assert.match(cluster, /useFocusEffect\(useCallback\(\(\) => \{\s*setClusterFocused\(true\)/);
  assert.match(cluster, /return \(\) => setClusterFocused\(false\)/);
  assert.match(atmosphere, /isReduceMotionEnabled/);
  assert.match(atmosphere, /AppState\.addEventListener/);
});

test('Organization and Cluster Wall expose the shared Creation sky without hiding cards or ads', () => {
  assert.match(scope, /<GenesisCosmosBackground active=\{section === 'home' \|\| section === 'community'\}/);
  assert.match(wall, /style=\{isGenesisPreviewBuild\(\) && mode === 'wall' \? \{ backgroundColor: 'transparent' \} : undefined\}/);
  assert.match(wall, /contentContainerStyle=\{\[[\s\S]*?isGenesisPreviewBuild\(\) && mode === 'wall' \? \{ backgroundColor: 'transparent' \} : undefined/);
  assert.match(wall, /<BuklodFirstViewAd/);
  assert.match(wall, /BuklodCommunityWallPostCard/);
  assert.match(wall, /removeClippedSubviews=/);
});
