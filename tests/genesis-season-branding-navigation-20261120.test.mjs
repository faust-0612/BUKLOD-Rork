import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
test('seasonal title comes from exactly one Genesis identity, not dashboard copy', () => {
  const contract = source('src/features/season2/genesis/genesisContract.ts');
  assert.match(contract, /title: 'Genesis: Let There Be Light'/);
  assert.match(contract, /verse: 'Genesis 1:3'/);
  for(const path of [
    'src/components/BuklodMainBrandIntro.tsx',
    'src/components/BuklodMainBrandIntro.web.tsx',
    'src/app/(tabs)/_layout.tsx',
    'src/components/BuklodScopedDashboardHeader.tsx'
  ]) {
    const code = source(path);
    assert.match(code, /GENESIS_IDENTITY\.title/, path);
    assert.match(code, /isGenesisPreviewBuild\(/, path);
    assert.doesNotMatch(code, /GENESIS · SEASON 2/, path);
  }
});
test('Genesis stage owns colors, and blocks competing dashboard themes', () => {
  const authority = source('src/features/season2/genesis/seasonThemeAuthority.ts');
  const provider = source('src/providers/BuklodThemeProvider.tsx');
  assert.match(authority, /isSeasonThemeLocked\(\):boolean\{return isGenesisPreviewBuild\(\);\}/);
  assert.match(authority, /canUserSelectTheme\(\):boolean\{return !isSeasonThemeLocked\(\);\}/);
  assert.match(provider, /options: seasonLocked \? \[\] : BUKLOD_GLOBAL_PREFERENCE_OPTIONS/);
  assert.match(source('src/components/BuklodDashboardCustomizer.tsx'), /!canUserSelectTheme\(\)/);
  assert.match(source('src/components/connect/ConnectThemeSelector.tsx'), /!canUserSelectTheme\(\)/);
});
test('shared navigation routes and ad placements stay present and untouched', () => {
  const tab = source('src/app/(tabs)/_layout.tsx');
  const scope = source('src/components/BuklodScopedDashboardHeader.tsx');
  for (const route of ["'/home'", "'/messages'", "'/buklod'", "'/me'"])
    assert.ok(tab.includes(route), 'tab missing ' + route);
  assert.match(tab, /<BuklodHeaderSponsor/);
  assert.match(tab, /refreshUnread/);
  assert.match(tab, /Open navigation menu/);
  assert.match(scope, /<BuklodDashboardCustomizer/);
  assert.match(scope, /normalizedType === 'CLUSTER'/);
  assert.match(source('src/features/season2/genesis/genesisContract.ts'),
    /\['staging','preview','development','dev'\]/);
});
test('stage identity is distinct from production runtime and AdMob test configuration', () => {
  const cfg = source('app.config.js');
  const eas = JSON.parse(source('eas.json'));
  assert.match(cfg, /genesisNativePreview \? '2\.0\.0-genesis-preview' : '1\.3\.2'/);
  assert.match(cfg, /'org\.mzbministry\.buklod\.staging'/);
  assert.match(cfg, /ca-app-pub-3940256099942544~3347511713/);
  assert.equal(eas.build['season2-genesis-preview'].channel, 'season2-genesis-preview');
  assert.equal(eas.build['season2-genesis-preview'].env.EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW, 'true');
  assert.equal(eas.build.production.channel, 'production');
});
