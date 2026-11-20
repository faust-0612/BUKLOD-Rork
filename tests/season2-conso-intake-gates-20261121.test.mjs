import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const text = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('forward-porting must remain fail-closed until the backend is verified',()=>{
  assert.ok(text('src/features/world/worldEconomyBlueprint.ts').includes('WORLD_TRADING_ENABLED = false'));
  assert.ok(text('src/features/world/worldQmpPolicyDraft.ts').includes('WORLD_QMP_ACTIVATION_ENABLED = false'));
  assert.ok(text('src/features/world/worldDevelopmentCatalog.ts').includes('WORLD_DEVELOPMENT_ENABLED = false'));
  assert.ok(text('src/lib/buklodAssetTradePolicy.ts').includes('newBpPerTrade: 0'));
});
test('existing Genesis app entry, nav persistence and AdMob bootstrap remain unmodified at intake',()=>{
  const boot=text('src/app/index.tsx');
  assert.ok(boot.includes('isGenesisPreviewBuild()'));
  assert.ok(boot.includes("'/(tabs)/hub' : '/(tabs)/buklod'"));
  assert.ok(text('src/app/(tabs)/_layout.tsx').includes('BuklodDashboardAdWarmup'));
  assert.ok(text('src/app/(tabs)/_layout.tsx').includes('BuklodAndroidDashboardTabs'));
});
test('arena still returns server-only plans, never a client-declared match payment',()=>{
  assert.ok(text('src/features/empire-arena/arenaCore.mjs').includes('fixed_tick_required'));
  assert.ok(text('src/features/empire-arena/settlementPolicy.mjs').includes('planned_not_committed'));
});

test('Genesis preview routes to map-first World, hides old global bars and preserves complete purpose directory',()=>{
  const hub=text('src/app/(tabs)/hub.tsx');
  const world=text('src/components/world/BuklodGenesisWorldHome.tsx');
  const tabs=text('src/app/(tabs)/_layout.tsx');
  const shell=text('src/components/BuklodNavSafeShell.tsx');
  assert.ok(hub.includes('if (genesisPreview)'));
  assert.ok(hub.includes('<GenesisWorld />'));
  assert.ok(tabs.includes('!isGenesisPreviewBuild() ? <SwipeDashboardHeader />'));
  assert.ok(shell.includes('!genesisWorld && !immersiveIgpat && !immersiveConversation'));
  assert.ok(world.includes('WORLD_COMPLETE_DESTINATION_DIRECTORY'));
  assert.ok(world.includes('BuklodFirstViewAd'));
  assert.ok(world.includes('BuklodScreenBottomBanner'));
  assert.ok(world.includes('require(\'../../../assets/sounds/kingdom-premium/kingdom-village.ogg\')'));
  assert.ok(world.includes('setMusicEnabled'));
  assert.ok(world.includes('GENESIS_GALAXY_IMAGES.creation'));
  assert.ok(world.includes('Preview'));
});
