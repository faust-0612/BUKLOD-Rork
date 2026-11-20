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
  assert.ok(text('src/app/index.tsx').includes('href="/(tabs)/buklod"'));
  assert.ok(text('src/app/(tabs)/_layout.tsx').includes('BuklodDashboardAdWarmup'));
  assert.ok(text('src/app/(tabs)/_layout.tsx').includes('BuklodAndroidDashboardTabs'));
});
test('arena still returns server-only plans, never a client-declared match payment',()=>{
  assert.ok(text('src/features/empire-arena/arenaCore.mjs').includes('fixed_tick_required'));
  assert.ok(text('src/features/empire-arena/settlementPolicy.mjs').includes('planned_not_committed'));
});