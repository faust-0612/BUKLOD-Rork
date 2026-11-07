import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const read=p=>readFileSync(p,'utf8');
test('Music uses approved library; audio resolves only after a visible autoplay or explicit Play',()=>{
 const s=read('src/lib/buklodPostCreatives.ts');
 assert.match(s,/buklod_music_library/);
 assert.match(s,/\.eq\('is_active', true\)/);
 assert.match(s,/createSignedUrl/);
});
test('Motion is lightweight and accessible',()=>{
 const s=read('src/components/BuklodPostMotion.tsx');
 assert.match(s,/isReduceMotionEnabled/);
 assert.match(s,/!active \|\| reduceMotion/);
 assert.match(s,/animation\.start\(\)/);
 assert.doesNotMatch(s,/Pause motion|Play motion/);
 assert.doesNotMatch(s,/VideoView|ffmpeg/);
});
test('Post creative metadata is gated by post audience/owner',()=>{
 const s=read('supabase/migrations/20261107171413_buklod_post_music_motion_v1_20261108.sql');
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
 assert.match(wall,/BuklodWallPostAudioMeter player=\{wallAudioPlayerRef\.current\}/);
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
 const migration=read('supabase/migrations/20261107171413_buklod_post_music_motion_v1_20261108.sql');
 assert.match(migration,/on delete set null/);
 assert.doesNotMatch(migration,/check \(music_track_id is not null or motion_preset/);
});

test('Optional music failure does not delete already published post',()=>{
 const s=read('src/app/(tabs)/buklod.tsx');
 assert.match(s,/optionalCreativeFailed=true/);
 assert.match(s,/Optional creative failure must never delete an already published post/);
 assert.match(s,/wallAudioPendingOwnerRef.current==='composer'/);
});

test('Native Wall audio is lazy and isolated from first-render failures',()=>{
 const wall=read('src/app/(tabs)/buklod.tsx');
 const playerFactory=wall.indexOf('const ensureWallAudioPlayer=');
 const playHandler=wall.indexOf('const toggleWallMusic=');
 assert.ok(playerFactory>0 && playHandler>playerFactory);
 assert.doesNotMatch(wall,/useAudioPlayer\(null/);
 assert.match(wall,/const player=createAudioPlayer\(null\)/);
 assert.match(wall,/const player=ensureWallAudioPlayer\(\)/);
 assert.match(wall,/try\{wallAudioPlayerRef\.current\?\.pause\(\);\}catch/);
 assert.match(wall,/try\{player\.pause\(\);\}catch/);
 assert.match(wall,/try\{player\.release\(\);\}catch/);
});

test('Post motion is automatically active only in visible Wall cards, without remounting hidden content',()=>{
 const wall=read('src/app/(tabs)/buklod.tsx');
 const motion=read('src/components/BuklodPostMotion.tsx');
 assert.match(wall,/active=\{wallScreenFocused&&visibleCreativePostIds\.includes/);
 assert.match(wall,/setVisibleCreativePostIds\(nextIds\)/);
 assert.match(motion,/style=\{!active \|\| reduceMotion \? \{\} : style\}/);
 assert.match(motion,/progress\.stopAnimation\(\)/);
});
test('Native audio autostarts only on a settled visible card; web remains opt-in',()=>{
 const wall=read('src/app/(tabs)/buklod.tsx');
 assert.match(wall,/Platform\.OS==='web'/);
 assert.match(wall,/wallAutoMusicAttemptedRef/);
 assert.match(wall,/wallAutoMusicSuppressedRef/);
 assert.match(wall,/wallAudioSettledTick/);
 assert.match(wall,/setTimeout\(\(\)=>\{/);
 assert.match(wall,/visibleCreativeIdsRef\.current\.includes/);
 assert.match(wall,/communityComposerOpen\|\|visibleVideoPostId/);
 assert.match(wall,/wallScreenFocused/);
});
