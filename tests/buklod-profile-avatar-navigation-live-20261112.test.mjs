import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const avatar = readFileSync('src/components/ProfileAvatar.tsx','utf8');
const me = readFileSync('src/app/(tabs)/me.tsx','utf8');
const live = readFileSync('src/lib/buklodAvatarLive.ts','utf8');

test('After successful profile database update, mounted avatars update before slow Wall sharing', () => {
  const database = me.indexOf("await supabase\n            .from(\n              'profiles'");
  const publish = me.indexOf('publishBuklodLiveAvatar({ userId: profile.id, url: avatarUrl });');
  const share = me.indexOf('await shareProfileUpdateOnCommunityWall({', publish);
  assert.ok(database >= 0 && publish > database && share > publish);
  assert.match(live, /for \(const listener of listeners\) listener\(\{ userId, url \}\)/);
  assert.match(avatar, /subscribeBuklodLiveAvatar\(change =>/);
  assert.match(avatar, /change\.userId !== currentId/);
});

test('Versioned image URL is part of both cache identity and recycling identity', () => {
  assert.match(avatar, /cacheKey: userId \? `avatar:\$\{userId\}:\$\{remoteUrl\}` : remoteUrl/);
  assert.match(avatar, /recyclingKey=\{remoteUrl \|\| userId \|\| undefined\}/);
  assert.match(me, /\?v=\$\{Date\.now\(\)\}/);
  assert.match(live, /\^https:/);
});

test('Profile upload continues to use existing owner-only profiles update', () => {
  assert.match(me, /\.update\(\{[\s\S]*?avatar_url:[\s\S]*?avatarUrl,[\s\S]*?\}\)[\s\S]*?\.eq\([\s\S]*?'id',[\s\S]*?profile\.id/);
  assert.doesNotMatch(live, /supabase|service_role|admin/);
});
