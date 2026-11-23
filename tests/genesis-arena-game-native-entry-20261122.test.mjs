import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const screen=readFileSync(fileURLToPath(new URL('../src/app/games/empire-arena.tsx',import.meta.url)),'utf8');
const eas=JSON.parse(readFileSync(fileURLToPath(new URL('../eas.json',import.meta.url)),'utf8'));

test('Only isolated Genesis library APK enables one-time native practice, never production',()=>{
  const signed=eas.build['season2-genesis-library-staging'];
  const parent=eas.build[signed.extends];
  assert.equal(signed.env.EXPO_PUBLIC_BUKLOD_ARENA_LIBRARY_BUNDLE,'true');
  assert.equal(parent.env.EXPO_PUBLIC_BUKLOD_ARENA_GODOT_ENABLED,'true');
  assert.equal(signed.env.EXPO_PUBLIC_BUKLOD_ARENA_RANKED_ENABLED,'false');
  assert.match(screen,/const nativeFirstLibrary = godotNativeEnabled &&\s+process.env.EXPO_PUBLIC_BUKLOD_ARENA_LIBRARY_BUNDLE === 'true'/);
  assert.match(screen,/if \(!cancelled && nativeFirstLibrary && !nativeAutoAttempted.current\)/);
  assert.match(screen,/nativeAutoAttempted.current = true/);
  assert.match(screen,/nativeLaunchInFlight.current = true/);
  assert.match(screen,/nativeLaunchInFlight.current = false/);
});

test('Game/Character, auth and legacy offline fallback are preserved on native failure',()=>{
  assert.match(screen,/if \(!isGenesisPreviewBuild\(\)\) return <Redirect href="\/\(tabs\)\/buklod"\/>/);
  assert.match(screen,/if \(!user\) return <Redirect href="\/\(auth\)\/login"\/>/);
  assert.match(screen,/if \(requiresAcceptance\) return <Redirect href="\/privacy\/consent"\/>/);
  assert.match(screen,/const \[hero, setHero\] = useState<BuklodCharacterId>\('phan'\)/);
  assert.match(screen,/getMyBuklodCharacterSelectionV2\(id\)/);
  assert.match(screen,/if \(!started\) setMessage\('Godot Arena pack unavailable\./);
  assert.match(screen,/<ArenaField zoom=\{zoom\}/);
  assert.match(screen,/return <EmpireArenaInApp\/>/);
});
