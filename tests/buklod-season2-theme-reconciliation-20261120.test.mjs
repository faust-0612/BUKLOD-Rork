import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('final Genesis title is galactic Creation, not the old seed/forest theme', () => {
  const contract = read('src/features/season2/genesis/genesisContract.ts');
  assert.match(contract, /title:\s*'Genesis: Let There Be Light'/);
  assert.match(contract, /motif:\s*'galactic-creation'/);
  assert.match(contract, /center:\s*'radiant-first-light'/);
  assert.doesNotMatch(contract, /The Seed of Glory|THE FIRST LIGHT|The Beginning/);
});

test('season lock propagates to Connect and ignores old per-thread color overrides', () => {
  const authority = read('src/features/season2/genesis/seasonThemeAuthority.ts');
  const provider = read('src/providers/ConnectThemeProvider.tsx');
  const background = read('src/providers/ChatBackgroundProvider.tsx');
  const selector = read('src/components/connect/ConnectThemeSelector.tsx');

  assert.match(authority, /export const GENESIS_MESSAGES_ROLES/);
  assert.match(authority, /\.\.\.GENESIS_GLOBAL_ROLES/);
  assert.match(authority, /getLockedSeasonMessagesTheme/);
  assert.match(provider, /seasonLocked \?\s*\{[\s\S]*?roles: getLockedSeasonMessagesTheme\(\)/);
  assert.match(provider, /if \(seasonLocked\) return;[\s\S]*?setMessagesPreferenceState\(next\)/);
  assert.match(provider, /options: seasonLocked \? \[\] : MESSAGES_PREFERENCE_OPTIONS/);
  assert.match(background, /if \(seasonLocked\) \{\s*return \{\s*config: \{ \.\.\.DEFAULT_CHAT_BACKGROUND \}/);
  assert.match(background, /if \(seasonLocked\) return;[\s\S]*?normalizeChatBackgroundConfig\(config\)/);
  assert.match(background, /previewConfig: seasonLocked \? null : previewConfig/);
  assert.match(selector, /if \(!canUserSelectTheme\(\)\) return null;/);
  assert.match(read('src/components/BuklodGlobalThemeSelector.tsx'), /if \(!canUserSelectTheme\(\)\) return null;/);
});

test('cosmic header is static and gated; production header is unchanged', () => {
  const source = read('src/app/(tabs)/_layout.tsx');
  assert.match(source, /const cosmicHeader = genesisPreview && publicMinimal/);
  assert.match(source, /const publicHeaderColor = cosmicHeader \? GENESIS_PALETTE.cosmos : '#0B2048'/);
  assert.match(source, /\{cosmicHeader \? \(/);
  assert.match(source, /pointerEvents="none"/);
  assert.match(source, /stroke=\{GENESIS_PALETTE.goldLight\}/);
  assert.doesNotMatch(source, /Animated\.loop/);
});

test('season preview remains non-production only; release does not autoactivate by calendar', () => {
  const source = read('src/features/season2/genesis/genesisContract.ts');
  assert.match(source, /\['staging','preview','development','dev'\]/);
  assert.match(source, /enabled==='true'/);
  assert.doesNotMatch(source, /Date\.now\(\)|new Date\(\)/);
  assert.match(read('src/features/season2/genesis/genesisAudioPolicy.ts'), /asset-not-mastered/);
});
