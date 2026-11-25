import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(name)=>readFileSync(name,'utf8');
const wall=read('src/app/(tabs)/buklod.tsx');
const media=read('src/components/CommunityVideo.tsx');
const creative=read('src/lib/buklodPostCreatives.ts');
const migration=read('supabase/migrations/20261123133500_buklod_post_audio_mix_v1_20261123.sql');
const picker=read('src/components/BuklodPostMusicPicker.tsx');

test('backend music metadata remains subject to the original per-user post creative RLS',()=>{
 assert.match(creative,/UUID\.test\(input\.postId\)/);
 assert.match(creative,/UUID\.test\(input\.userId\)/);
 assert.match(creative,/created_by:input\.userId/);
 assert.match(migration,/alter table public\.buklod_post_creatives/);
 assert.doesNotMatch(migration,/disable row level security|drop policy|create policy|grant all|service_role/i);
 assert.match(migration,/music_volume between 0 and 1/);
 assert.match(migration,/video_volume between 0 and 1/);
});
test('wall navigation pauses soundtrack on blur and on offscreen post change',()=>{
 assert.match(wall,/onCommunityWallViewableItemsChanged/);
 assert.match(wall,/owner!==fullscreenAudioPostIdRef\.current/);
 assert.match(wall,/useFocusEffect\(useCallback\(\(\)=>\{/);
 assert.match(wall,/wallAudioRequestEpochRef\.current\+\+/);
 assert.match(wall,/pauseWallAudio\(\)/);
});
test('video and soundtrack stay isolated from sponsored IMA playback',()=>{
 assert.match(media,/ImaCommunityVideo/);
 assert.match(media,/shouldUseBuklodImaForVideo/);
 assert.match(wall,/BuklodVideoCompanionAd/);
 assert.match(wall,/videoViewerActiveIsAd/);
 assert.match(media,/function ExpoCommunityVideoPlayback\([\s\S]*audioVolume = 1/);
 const imaProps=media.slice(media.indexOf('function ImaCommunityVideo({'),media.indexOf('function ImaCommunityVideo({')+180);
 assert.doesNotMatch(imaProps,/audioVolume/);
});
test('audio mixer is optional to preserve existing Marites composer integration',()=>{
 assert.match(picker,/musicVolume\?:number;videoVolume\?:number/);
 assert.match(picker,/onVolumeChange\?:/);
 assert.match(picker,/!!currentTrack&&!!onVolumeChange/);
});
