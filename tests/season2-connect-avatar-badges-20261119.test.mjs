import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');

test('Connect and Wall social views use one decorated avatar rather than naked or square images', () => {
  const shared = read('src/components/ProfileAvatar.tsx');
  for (const path of [
    'src/components/BuklodTappableAvatar.tsx',
    'src/components/connect/ConnectTappableAvatar.tsx',
    'src/components/connect/ConnectTappableAvatar.web.tsx',
  ]) {
    const wrapper=read(path);
    assert.match(wrapper, /<ProfileAvatar/);
    assert.match(wrapper, /overflow: 'visible'/, path + ' clips the rank emblem');
  }
  for (const path of [
    'src/components/connect/ConnectInboxRow.tsx',
    'src/components/connect/ConnectQuickContacts.tsx',
    'src/components/connect/ConnectMessageBubble.tsx',
    'src/components/BuklodCommunityWallProfileBubbles.tsx',
    'src/components/BuklodCommunityConnectHeader.web.tsx',
  ]) {
    assert.match(read(path), /<ConnectTappableAvatar/);
  }
  assert.match(read('src/app/(tabs)/buklod.tsx'), /<BuklodTappableAvatar/);
  assert.match(shared, /source=\{require\('\.\.\/\.\.\/assets\/season2\/rank-badges\/buklod-circle-ranks-atlas\.webp'\)\}/);
  assert.match(shared, /overflow: 'hidden'/, 'Only the transparent sprite cell is cropped');
});

test('Connect online status must not reuse unread markers or Profile Notes', () => {
  const avatar=read('src/components/ProfileAvatar.tsx');
  const inbox=read('src/components/connect/ConnectInboxRow.tsx');
  const presence=read('src/lib/buklodAvatarPresence.ts');
  assert.match(avatar, /<ProfileAvatarStatusIndicator/);
  assert.match(avatar, /backgroundColor: '#00AAFF'/);
  assert.match(inbox, /An unread marker, never an unverified online-presence badge/);
  assert.match(presence, /connected\.presenceState\(\)/);
  assert.match(presence, /ready && AppState\.currentState === 'active'/);
  assert.match(presence, /auth\.onAuthStateChange/);
  assert.match(presence, /listeners\.delete\(listener\)/);
  assert.doesNotMatch(avatar, /supabase\.channel\(/, 'Each avatar must not own a channel');
});
