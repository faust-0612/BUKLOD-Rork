import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const wall=read('src/app/(tabs)/buklod.tsx');
const creative=read('src/lib/buklodPostCreatives.ts');
const picker=read('src/components/BuklodPostMusicPicker.tsx');
const ad=read('src/components/BuklodCommunitySponsoredAd.tsx');
const preview=read('src/components/BuklodCommunityCommentPreview.tsx');
const nav=read('src/components/BuklodPersistentBottomNav.tsx');
const navLib=read('src/lib/buklodInstantNavigation.ts');
const home=read('src/app/(tabs)/hub.tsx');
const cards=read('src/components/home/BuklodHomeUtilityCards.tsx');
const today=read('src/components/BuklodTodayCard.tsx');
const motion=read('src/components/BuklodPostMotion.tsx');
const sql=read('supabase/migrations/20261108093945_buklod_post_music_selected_clip_v1_20261108.sql');

test('GIF/photo snippets never expose encoded media payload, caption retains plain text', async()=>{
 const media=await import('data:text/javascript,'+encodeURIComponent(
   stripTypeScriptTypes(read('src/lib/buklodCommentMediaBody.ts'))
 ));
 const raw=media.encodeBuklodCommentMediaBody(
   {kind:'gif',ref:'https://media.giphy.com/media/abc/giphy.gif'},'Great!');
 assert.equal(media.parseBuklodCommentMediaBody(raw).caption,'Great!');
 assert.equal(media.parseBuklodCommentMediaBody(raw).media.kind,'gif');
 assert.match(preview,/parseBuklodCommentMediaBody/);
 assert.match(preview,/GIF · Tap to view/);
 assert.match(preview,/const visibleCaption = encoded && !parsed.media \? '' : parsed.caption/);
 assert.doesNotMatch(preview,/repairMojibakeText\(preview\.body\)/);
});
test('selected licensed song section is bounded, previewed, and persisted without duplicating audio',()=>{
 assert.match(picker,/clipStartSeconds:number; clipDurationSeconds:number/);
 assert.match(picker,/onPreview\(item,start,duration\)/);
 assert.match(picker,/onSelect\(item,start,30\)/);
 assert.match(picker,/fixedLength=\{30\}/);
 assert.match(picker,/Preview selected 30s loop/);
 assert.match(wall,/wallClipLoopingRef/);
 assert.match(wall,/player\.seekTo\(clip\.start\)/);
 assert.match(creative,/music_clip_start_seconds:clipStart/);
 assert.match(creative,/music_clip_duration_seconds:clipDuration/);
 assert.match(creative,/music_clip_start_seconds,music_clip_duration_seconds/);
 assert.match(wall,/clipStartSeconds:composerClipStartSeconds/);
 assert.match(wall,/setComposerClipStartSeconds\(snapshot\.clipStartSeconds\)/);
 assert.match(wall,/await player\.seekTo\(start\)/);
 assert.match(wall,/status\.currentTime>=clip\.end/);
 assert.match(wall,/wallAudioRequestEpochRef\.current!==requestEpoch/);
 assert.match(sql,/music_clip_start_seconds numeric\(8,2\)/);
 assert.match(sql,/music_clip_duration_seconds between 5 and 60/);
 assert.match(sql,/music_clip_start_seconds is null and music_clip_duration_seconds is null/);
});
test('paid sponsored videos play audibly only in-view and pause when hidden, while keeping approval/expiry gates',()=>{
 assert.match(ad,/p\.muted = false/);
 assert.match(ad,/player\.play\(\)/);
 assert.match(ad,/requestBuklodAudioFocus\('sponsor-ad'\)/);
 assert.match(ad,/measureInWindow/);
 assert.match(ad,/visible=\{screenFocused&&videoVisible\}/);
 assert.match(ad,/try \{player\.pause\(\);\}/);
 assert.match(ad,/useFocusEffect\(useCallback/);
 assert.match(ad,/paidSponsorshipCanDisplay/);
 assert.match(ad,/\.eq\('status', 'approved'\)/);
 assert.match(ad,/\.gt\('ends_at'/);
});
test('primary dashboard navigation reuses mounted route state instead of replace-on-every-tap',()=>{
 assert.match(navLib,/export function buklodInstantNavigate/);
 assert.match(navLib,/router\.navigate\(href as any\)/);
 assert.match(nav,/buklodInstantNavigate\(/);
 assert.doesNotMatch(nav,/buklodInstantReplace\(/);
 assert.match(home,/\{foreground \? \(/);
});
test('all three Home cards have accessible neon borders without adding native dependencies',()=>{
 assert.match(today,/borderColor:'#AD65FF'/);
 assert.match(today,/shadowColor:'#A020F0'/);
 assert.match(cards,/#00E6B5/);
 assert.match(cards,/#F14AE0/);
 assert.match(cards,/accessibilityRole="button"/);
 assert.match(motion,/const count=preset==='storm'\?36/);
 assert.match(motion,/reduceMotion/);
});
