import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const connect = read('src/app/(tabs)/messages.tsx');
const contacts = read('src/components/connect/ConnectQuickContacts.tsx');
const profile = read('src/app/(tabs)/me.tsx');
const character = read('src/components/points/BuklodProfileCharacterCard.tsx');
const ranking = read('src/components/BuklodProfileTopTenRankings.tsx');

test('Connect hero and unread pill stay fully visible above search dock', () => {
  const dock = connect.match(/searchDock:\s*\{([\s\S]*?)\},/)?.[1] ?? '';
  assert.match(dock, /marginTop:\s*4/);
  assert.doesNotMatch(dock, /marginTop:\s*-/);
  assert.ok(connect.indexOf('<View style={styles.hero}>') < connect.indexOf('<View style={styles.searchDock}>'));
  assert.match(connect, /<View style=\{styles.heroCount\}>/);
  // On the dark canvas the headings must remain legible after removing opaque tiles.
  assert.match(connect, /contactsTitle: \{\s*color: theme\.textPrimary/);
  assert.match(connect, /sectionTitle: \{\s*color: theme\.textPrimary/);
});

test('Connect avatars are unobstructed, equal-positioned and notes stay editable', () => {
  const column = contacts.match(/column:\s*\{([\s\S]*?)\},/)?.[1] ?? '';
  const zone = contacts.match(/noteZone:\s*\{([\s\S]*?)\},/)?.[1] ?? '';
  const editing = contacts.match(/noteZoneEditing:\s*\{([\s\S]*?)\},/)?.[1] ?? '';
  assert.match(column, /backgroundColor:\s*'transparent'/);
  assert.match(column, /minHeight:\s*0/);
  assert.match(zone, /minHeight:\s*44/);
  assert.doesNotMatch(zone, /^\s*height\s*:/m);
  assert.match(contacts, /scroll:\s*\{[\s\S]{0,150}alignItems:\s*'flex-end'/);
  assert.match(editing, /height:\s*NOTE_ZONE_HEIGHT/);
  assert.match(contacts, /editingPopover: \{/);
  assert.match(contacts, /onSave=\{onSaveSelfNote\}/);
  assert.match(contacts, /markConnectStatusNoteSeen/);
  assert.ok(contacts.indexOf('style={styles.noteZone}') < contacts.indexOf('style={styles.avatarWrap}'));
});

test('Profile identity strip is translucent and cover extends behind it', () => {
  assert.match(profile, /paddingTop: coverUrl \? 195 : 56/);
  assert.match(profile, /height: 256, overflow: 'hidden'/);
  assert.match(profile, /backgroundColor: withAlpha\(theme\.cardSurface, coverUrl \? 0\.86 : 0\.94\)/);
  assert.match(profile, /style=\{\[styles\.identityRow,/);
});

test('Profile keeps canonical monthly/all-time Top 10 with no duplicate all-time fetch', () => {
  assert.match(ranking, /\(\['monthly', 'all_time'\] as const\)/);
  assert.match(ranking, /get_buklod_points_leaderboard/);
  assert.match(profile, /<BuklodProfileTopTenRankings userId=\{profile\.id\}/);
  assert.doesNotMatch(character, /get_buklod_points_leaderboard|topTenSection|topTenBusy/);
  assert.match(character, /<BuklodAdLightRewardCard \/>/);
});
