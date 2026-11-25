import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(path,'utf8');
const picker=read('src/components/BuklodPostMusicPicker.tsx');
const timeline=read('src/components/BuklodMusicClipTimeline.tsx');
const wall=read('src/app/(tabs)/buklod.tsx');
const creative=read('src/lib/buklodPostCreatives.ts');
const androidVideo=read('src/components/CommunityVideo.tsx');
const webVideo=read('src/components/CommunityVideo.web.tsx');
const preview=read('src/components/BuklodMusicVideoMixPreview.tsx');
const sql=read('supabase/migrations/20261123133500_buklod_post_audio_mix_v1_20261123.sql');

test('music track choice stays inside the picker until segment approval',()=>{
 assert.match(picker,/Use this 30s segment/);
 assert.match(picker,/onSelect\(currentTrack,start,30\);onClose\(\);/);
 assert.doesNotMatch(picker,/onSelect\(item,start,30\);onClose\(\);/);
 assert.match(picker,/minHeight:170/);
 assert.match(picker,/height:'96%'/);
});
test('timeline drags locally without rerendering entire composer every frame',()=>{
 assert.match(timeline,/setDraggedStart\(next\)/);
 assert.match(timeline,/lastSeekAt\.current>=120/);
 assert.match(timeline,/onPanResponderMove/);
 assert.match(timeline,/onPanResponderRelease:[\s\S]*?data\.current\.onChange/);
 assert.doesNotMatch(timeline,/n\.onChange\(next,duration\)/);
});
test('post uses validated and persisted independent music/video levels',()=>{
 assert.match(creative,/music_volume:r\.music_volume/);
 assert.match(creative,/video_volume:r\.video_volume/);
 assert.match(creative,/music_volume:musicVolume, video_volume:videoVolume/);
 assert.match(creative,/musicVolume! < 0/);
 assert.match(creative,/videoVolume! > 1/);
 assert.match(wall,/musicVolume:snapshot\.musicTrack\?snapshot\.musicVolume:null/);
 assert.match(wall,/videoVolume:snapshot\.musicTrack\?snapshot\.videoVolume:null/);
 assert.match(wall,/music_volume:snapshot\.musicTrack\?snapshot\.musicVolume:null/);
 assert.match(wall,/video_volume:snapshot\.musicTrack\?snapshot\.videoVolume:null/);
 assert.match(sql,/buklod_post_creatives_audio_mix_range_check/);
});
test('composer preview and post playback support both audible streams',()=>{
 assert.match(picker,/AudioMixSlider label="Added music"/);
 assert.match(picker,/AudioMixSlider label="Original video sound"/);
 assert.match(picker,/BuklodMusicVideoMixPreview/);
 assert.match(preview,/audioMixingMode='mixWithOthers'/);
 assert.match(wall,/interruptionMode:'mixWithOthers'/);
 assert.match(wall,/postCreatives\[ownerKey\]\?\.music_volume/);
 assert.match(wall,/fullscreenAudioPostIdRef/);
 assert.match(wall,/videoViewerActiveIsAd/);
 assert.match(wall,/audioVolume=\{postCreatives\[postId\]\?\.video_volume\?\?1\}/);
 assert.match(androidVideo,/player\.volume = Math\.max/);
 assert.match(webVideo,/videoRef\.current\.volume=Math\.max/);
});
test('existing ad and post safety boundaries remain in place',()=>{
 assert.match(wall,/BuklodVideoCompanionAd/);
 assert.match(androidVideo,/ImaCommunityVideo/);
 assert.match(wall,/requestBuklodAudioFocus\('wall-post'\)/);
 assert.match(wall,/wallAudioRequestEpochRef/);
 assert.match(creative,/UUID\.test\(input\.postId\)/);
});
