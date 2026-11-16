const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const read = file => readFileSync(path.join(root,file),'utf8');

test('public Wall post author uses one full-width line with actions below and compact one-line datetime', () => {
 const source = read('src/app/(tabs)/buklod.tsx');
 const block = source.split('BUKLOD_WALL_SINGLE_LINE_IDENTITY_20261116')[1].split('<BuklodPostMotion')[0];
 assert.match(block, /<BuklodTappableAvatar[\s\S]*?<BuklodTappablePersonName/);
 assert.match(block, /style=\{\{flex:1,minWidth:0\}\}/);
 assert.match(block, /numberOfLines=\{1\}/);
 assert.match(block, /formatCompactWallDateTime\(item\.created_at\)/);
 assert.ok(block.indexOf('formatCompactWallDateTime') < block.indexOf('toggleAuthorFollow'), 'follow control must not steal name/date width');
 assert.match(block, /<ProfileAvatarNoteChip userId=\{item\.user_id\}/);
 assert.match(block, /BuklodContentOverflowMenu/);
});
test('post detail has single-line author and no removed actions', () => {
 const source = read('src/app/post/[id].tsx');
 assert.match(source,/numberOfLines=\{1\}[\s\S]*?\{post\.author_name\}/);
 assert.match(source,/formatCompactWallDateTime\(post\.created_at\)/);
 assert.match(source,/BuklodContentOverflowMenu/);
});
test('avatar SQL exposes ONLY active profile photo to signed-in viewers irrespective of lock and verification', () => {
 const migration = read('supabase/migrations/20261116221100_wall_avatar_privacy_display.sql');
 assert.match(migration,/select p\.id, p\.avatar_url/);
 assert.match(migration,/auth\.uid\(\)\) is not null/);
 assert.match(migration,/p\.is_active = true/);
 assert.doesNotMatch(migration,/is_verified|profile_locked|quick_note|email/);
 assert.match(migration,/revoke execute[\s\S]*?from public, anon/i);
 const member = read('src/lib/buklodMemberProfile.ts');
 assert.match(member,/if \(locked && !isSelf\)/);
 assert.match(member,/can_view_details: false/);
});
