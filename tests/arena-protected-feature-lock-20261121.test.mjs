import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assessProtectedFeatureLock } from '../scripts/protected-feature-lock.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = file => readFileSync(resolve(root,file),'utf8');
const path = '.buklod/scopes/arena-premium-hud-20261121.json';
const manifest = JSON.parse(read(path));
const changed = [
  path,
  '.github/workflows/engineering-accountability.yml',
  'src/components/BuklodNavSafeShell.tsx',
  'src/app/games/empire-arena.tsx',
  'src/features/games/empire/ArenaAnimatedActor.tsx',
  'src/features/games/empire/ArenaCombatHud.tsx',
  'src/features/games/empire/arenaHudLayout.mjs',
  'src/features/games/empire/arenaPracticeAudio.mjs',
  'src/features/games/empire/arenaFeedbackReceipts.mjs',
  'src/features/games/empire/ArenaMaterialFeedback.tsx',
  'src/features/games/empire/arenaTacticalCalls.mjs',
  'experiments/empire-arena-v2/arena-v2-empire.mjs',
  'tests/arena-full-functionality-audit-20261121.test.mjs',
  'src/features/games/empire/arenaSoundscape.mjs',
  'src/features/games/empire/ArenaWorldArt.tsx',
  'src/features/games/runtime/rorkAudio.ts',
  'experiments/empire-arena-v2/arena-v2-engine.mjs',
  'tests/arena-event-audio-graphics-20261121.test.mjs',
  'tests/arena-premium-voice-motion-terrain-20261121.test.mjs',
  'src/features/games/empire/arenaPracticePresentation.mjs',
  'tests/empire-arena-v2-presentation-20261121.test.mjs',
  'experiments/empire-arena-v2/arena-v2-solo.mjs',
  '.github/workflows/season2-empire-arena-conso-qa-20261121.yml',
  'tests/arena-offline-solo-cpu-battle-20261121.test.mjs',
  'tests/empire-arena-v2-premium-audio-motion-20261121.test.mjs',
  'tests/season2-arena-responsive-navigation-20261121.test.mjs',
  'tests/arena-kingdom-game-premium-20261121.test.mjs',
  'tests/arena-protected-feature-lock-20261121.test.mjs',
];
const changes = changed.map(p=>({path:p,status:'M'}));

test('the dedicated protected Arena branch can only target the map-first DEV source', () => {
  const workflow = read('.github/workflows/engineering-accountability.yml');
  assert.match(workflow,/dev\/arena-responsive-zoom-navigation-fix-20261121/);
  assert.match(workflow,/PR_BASE.*dev\/season2-map-first-conso-intake-20261121/);
  assert.ok(workflow.includes('BUKLOD_SCOPE_MANIFEST='+path));
  assert.doesNotMatch(workflow,/BUKLOD_CONSOLIDATED_RC_GATE=true.*arena-responsive/);
});

test('exact changed paths and protected BUKLOD feature proofs pass without weakening governance', () => {
  assert.equal(manifest.contractVersion,2);
  assert.deepEqual(assessProtectedFeatureLock(changes,manifest).failures,[]);
  assert.ok(manifest.allowedPaths.includes('src/components/BuklodNavSafeShell.tsx'));
  assert.ok(manifest.allowedPaths.includes('src/app/games/empire-arena.tsx'));
});

test('a stray backend or production change fails closed', () => {
  const result=assessProtectedFeatureLock([
    ...changes,{path:'supabase/migrations/20261121_unreviewed_arena.sql',status:'A'},
  ],manifest);
  assert.ok(result.failures.length);
  assert.ok(result.failures.some(x=>x.includes('outside work scope') || x.includes('Undeclared')));
});
