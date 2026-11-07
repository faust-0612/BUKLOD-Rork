import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const read=p=>readFileSync(p,'utf8');
test('Music uses approved library; bytes require Play',()=>{
 const s=read('src/lib/buklodPostCreatives.ts');
 assert.match(s,/buklod_music_library/);
 assert.match(s,/\.eq\('is_active', true\)/);
 assert.match(s,/createSignedUrl/);
});
test('Motion is lightweight and accessible',()=>{
 const s=read('src/components/BuklodPostMotion.tsx');
 assert.match(s,/isReduceMotionEnabled/);
 assert.match(s,/setPlaying/);
 assert.doesNotMatch(s,/VideoView|ffmpeg/);
});
test('Post creative metadata is gated by post audience/owner',()=>{
 const s=read('supabase/migrations/20261108004500_buklod_post_music_motion_v1.sql');
 assert.match(s,/can_view_community_post_v2\(post_id\)/);
 assert.match(s,/created_by=\(select auth\.uid\(\)\)/);
 assert.match(s,/on delete cascade/);
});
test('Wall persists creative metadata on post publish',()=>{
 const s=read('src/app/(tabs)/buklod.tsx');
 assert.match(s,/saveBuklodPostCreative/);
 assert.match(s,/BuklodPostMotion/);
 assert.match(s,/BuklodPostMusicPicker/);
});
