import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const source = {
  cluster: read('src/components/BuklodClusterHomeCommandCenterImpl.tsx'),
  organization: read('src/components/BuklodScopeHomeDashboard.tsx'),
  scope: read('src/app/scope/index.tsx'),
  wallRail: read('src/components/BuklodCommunityWallProfileBubbles.tsx'),
  connect: read('src/components/connect/ConnectThreadBackground.tsx'),
  connectInbox: read('src/app/(tabs)/messages.tsx'),
  gallery: read('src/features/season2/genesis/genesisGalleryAssets.ts'),
  background: read('src/features/season2/genesis/GenesisVisuals.tsx'),
};

const luminosity = (hex) => {
  const rgb = [1, 3, 5].map(index =>
    parseInt(hex.slice(index, index + 2), 16) / 255
  ).map(channel => channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4);
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
};
const contrast = (a, b) => {
  const [bright, dark] = [luminosity(a), luminosity(b)].sort((x, y) => y - x);
  return (bright + 0.05) / (dark + 0.05);
};

test('Bundled Galaxy assets are actual nonempty JPEG binaries, not only a source manifest', () => {
  for (const name of ['nebula', 'creation', 'earth']) {
    const file = readFileSync(new URL('../assets/season2/genesis/galaxy/' + name + '.jpg', import.meta.url));
    assert.ok(file.length >= 4000, name + ' should be an optimized image, not a placeholder');
    assert.equal(file[0], 0xFF);
    assert.equal(file[1], 0xD8);
    assert.equal(file[2], 0xFF);
    assert.equal(file[file.length - 2], 0xFF);
    assert.equal(file[file.length - 1], 0xD9);
    assert.match(source.gallery, new RegExp('galaxy/' + name + '\\.jpg'));
  }
});

test('Genesis Cluster and scope nav meet WCAG AA regular-text contrast, including secondary labels', () => {
  assert.ok(contrast('#F8FAFF', '#0C1B37') >= 4.5);
  assert.ok(contrast('#D4E3F4', '#0C1B37') >= 4.5);
  assert.ok(contrast('#F4F8FF', '#122748') >= 4.5);
  assert.ok(contrast('#FFE8B6', '#0F203B') >= 4.5);
  assert.ok(contrast('#D2E0F7', '#0F203B') >= 4.5);
  assert.match(source.cluster, /clusterInk = GENESIS_CLUSTER \? '#F8FAFF'/);
  assert.match(source.cluster, /clusterMuted = GENESIS_CLUSTER \? '#D4E3F4'/);
  assert.match(source.cluster, /featureTileText:\{color:GENESIS_CLUSTER \? '#F4F8FF'/);
  assert.match(source.scope, /'rgba\(15,32,59,\.94\)'/);
});

test('Dashboard backdrops are visible in Genesis, without changing Season 1 or native ad creatives', () => {
  assert.match(source.cluster, /GENESIS_CLUSTER \? 'transparent' : '#F2F7FD'/);
  assert.match(source.organization, /GENESIS_ORG \? 'transparent' : '#F2F7FD'/);
  assert.match(source.background, /GENESIS_GALAXY_IMAGES.nebula/);
  assert.match(source.background, /GenesisAtmosphere active=\{active\}/);
  assert.match(source.wallRail, /GENESIS_WALL \? <View pointerEvents="none"/);
  assert.match(source.cluster, /BuklodFirstViewAd placement="cluster"/);
  assert.match(source.connectInbox, /BuklodFirstViewAd/);
});

test('Connect inbox uses local static Galaxy imagery while thread backgrounds stay user-safe', () => {
  assert.match(source.connectInbox, /<ConnectThreadBackground style=\{styles.screen\} genesisInbox>/);
  assert.match(source.connect, /genesisInbox = false/);
  assert.match(source.connect, /genesisInbox && isGenesisPreviewBuild\(\)/);
  assert.match(source.connect, /GENESIS_GALAXY_IMAGES.nebula/);
  assert.match(source.connect, /GenesisCosmicSky active=\{false\} minimal transparent/);
  assert.match(source.connect, /pointerEvents="none"/);
  assert.match(source.connect, /<BackgroundLayers[\s\S]*config=\{effectiveBackground\}/);
});
