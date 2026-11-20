import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (path) => readFileSync(new URL('../'+path, import.meta.url),'utf8');
test('Genesis surfaces do not cover the moving first-light background with white',()=>{
 const cluster=read('src/components/BuklodClusterHomeCommandCenterImpl.tsx');
 const org=read('src/components/BuklodScopeHomeDashboard.tsx');
 const scope=read('src/app/scope/index.tsx');
 assert.match(cluster,/GENESIS_CLUSTER \? 'transparent' : '#F2F7FD'/);
 assert.match(org,/GENESIS_ORG \? 'transparent' : '#F2F7FD'/);
 assert.match(scope,/canUserSelectTheme\(\) \? '#F4F9FF' : 'rgba\(15,32,59,\.94\)'/);
});
test('Cluster selected panels keep legible text and the card orbital background does not capture gestures',()=>{
 const cluster=read('src/components/BuklodClusterHomeCommandCenterImpl.tsx');
 assert.match(cluster,/clusterInk = GENESIS_CLUSTER \? '#F8FAFF'/);
 assert.match(cluster,/clusterMuted = GENESIS_CLUSTER \? '#D4E3F4'/);
 assert.match(cluster,/GenesisCosmicSky active=\{false\} minimal transparent/);
 assert.match(cluster,/featureTileText:\{color:GENESIS_CLUSTER/);
});
test('Cosmic animation is deactivated when unfocused or reduced motion is enabled',()=>{
 const visuals=read('src/features/season2/genesis/GenesisVisuals.tsx');
 const contract=read('src/features/season2/genesis/genesisContract.ts');
 assert.match(visuals,/GenesisAtmosphere active=\{active\}/);
 assert.match(visuals,/GENESIS_GALAXY_IMAGES.nebula/);
 assert.match(visuals,/GENESIS_GALAXY_IMAGES.creation/);
 assert.match(contract,/focused&&c.appActive&&!c.reducedMotion/);
});
test('Owned Galaxy image gallery is statically bundled and only enabled for Genesis',()=>{
 const gallery=read('src/features/season2/genesis/genesisGalleryAssets.ts');
 const wall=read('src/components/BuklodCommunityWallProfileBubbles.tsx');
 for(const name of ['nebula','creation','earth']) assert.match(gallery,new RegExp('galaxy/'+name+'\\.jpg'));
 assert.match(wall,/GENESIS_WALL \? <View pointerEvents="none"/);
});
