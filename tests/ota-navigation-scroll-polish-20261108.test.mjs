import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('music selection retains 5-60s seek contract with responsive drag UI and numeric fallback',()=>{
 const picker=read('src/components/BuklodPostMusicPicker.tsx');
 const timeline=read('src/components/BuklodMusicClipTimeline.tsx');
 const wall=read('src/app/(tabs)/buklod.tsx');
 assert.match(picker,/BuklodMusicClipTimeline/);
 assert.match(picker,/preciseTimingOpen/);
 assert.match(timeline,/PanResponder\.create/);
 assert.match(timeline,/onPanResponderMove/);
 assert.match(timeline,/clamp\(Math\.round\(durationSeconds\),5,Math\.min\(60/);
 assert.match(wall,/await player\.seekTo\(start\)/);
 assert.match(wall,/onClipChange=\{\(start,duration\)/);
});
test('Connect inbox header is compact, independently scrollable and normal navigation remains',()=>{
 const inbox=read('src/app/(tabs)/messages.tsx');
 assert.match(inbox,/minHeight: 89/);
 assert.match(inbox,/paddingBottom: 8/);
 assert.match(inbox,/ConnectInboxTabs/);
 assert.match(inbox,/ConnectCommunityRow/);
});
test('Points source breakdown and history are opt-in, but deep-link ledger focus expands',()=>{
 const points=read('src/components/points/BuklodPointsRewardsScreen.tsx');
 const profile=read('src/app/(tabs)/me.tsx');
 assert.match(points,/const \[historyOpen,setHistoryOpen\] = useState\(Boolean\(exactLedgerId\)\)/);
 assert.match(points,/\{historyOpen && <>/);
 assert.match(points,/const visibleRows = expanded \? rows : \[\]/);
 assert.match(points,/Claim all verified BUKLOD Points/);
 assert.match(profile,/View 40-level Circle Rank progression/);
 assert.match(profile,/router\.push\('\/points\/progression' as any\)/);
 assert.doesNotMatch(profile,/subtitle="Circle rank"\s*onPress=\{\(\) => router\.push\('\/points'\)/);
});
