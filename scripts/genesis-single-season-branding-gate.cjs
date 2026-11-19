'use strict';
// Season 2 source-only branding gate. Android visual/device acceptance is separate.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const contract = read('src/features/season2/genesis/genesisContract.ts');
const authority = read('src/features/season2/genesis/seasonThemeAuthority.ts');
const provider = read('src/providers/BuklodThemeProvider.tsx');
assert.match(contract, /title: 'Genesis: Let There Be Light'/);
assert.match(contract, /isGenesisPreviewEnabled\(enabled:string\|undefined,environment:string\|undefined\)/);
assert.match(authority, /canUserSelectTheme\(\):boolean\{return !isSeasonThemeLocked\(\);\}/);
assert.match(provider, /options: seasonLocked \? \[\] : BUKLOD_GLOBAL_PREFERENCE_OPTIONS/);
for (const file of [
  'src/components/BuklodMainBrandIntro.tsx',
  'src/components/BuklodMainBrandIntro.web.tsx',
  'src/app/(tabs)/_layout.tsx',
  'src/components/BuklodScopedDashboardHeader.tsx',
]) {
  const source = read(file);
  assert.match(source, /GENESIS_IDENTITY\.title/, file + ' must use canonical wordmark');
  assert.match(source, /isGenesisPreviewBuild/, file + ' must be preview-gated');
  assert.doesNotMatch(source, /GENESIS · SEASON 2/, file + ' must not use old headline');
}
assert.match(read('src/components/BuklodDashboardCustomizer.tsx'), /!canUserSelectTheme\(\)/);
assert.match(read('src/components/BuklodGlobalThemeSelector.tsx'), /canUserSelectTheme/);
console.log('Genesis single seasonal theme branding gate: 10 checks passed');
