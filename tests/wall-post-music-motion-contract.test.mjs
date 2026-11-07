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

test('Only the active post row subscribes to audio clock',()=>{
 const wall=read('src/app/(tabs)/buklod.tsx');
 const meter=read('src/components/BuklodWallPostAudioMeter.tsx');
 assert.doesNotMatch(wall,/useAudioPlayerStatus/);
 assert.match(meter,/useAudioPlayerStatus\(player\)/);
 assert.match(wall,/BuklodWallPostAudioMeter player=\{wallAudioPlayer\}/);
});
test('In-flight music loading is cancelled on navigation and scrolling',()=>{
 const wall=read('src/app/(tabs)/buklod.tsx');
 assert.match(wall,/wallAudioRequestEpochRef/);
 assert.match(wall,/wallAudioPendingOwnerRef/);
 assert.match(wall,/onCommunityWallViewableItemsChanged/);
 assert.match(wall,/communityViewabilityListener\.current\(event\)/);
 assert.match(wall,/useFocusEffect\(useCallback\(\(\)=>\(\)=>\{/);
});
test('Audio focus includes the premium music deck and DZAS',()=>{
 const deck=read('src/components/BuklodPremiumMusicDeck.tsx');
 const dzas=read('src/lib/buklodDzasRadio.ts');
 assert.match(deck,/requestBuklodAudioFocus\('music-deck'\)/);
 assert.match(dzas,/requestBuklodAudioFocus\('dzas'\)/);
 assert.match(dzas,/peekDzasPlaying\(\)\) pauseDzasRadio\(\)/);
});
test('Music retirement never blocks deleting a track from admin library',()=>{
 const migration=read('supabase/migrations/20261108004500_buklod_post_music_motion_v1.sql');
 assert.match(migration,/on delete set null/);
 assert.doesNotMatch(migration,/check \(music_track_id is not null or motion_preset/);
});
