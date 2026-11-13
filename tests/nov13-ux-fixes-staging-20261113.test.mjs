import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Connect message notifications route to real inbox/thread before legacy BSOC destinations',()=>{
const s=read('src/lib/buklodNotificationNavigation.ts');
assert.match(s,/return \{path:'\/messages'\}/);
assert.ok(s.indexOf("conversation_id: clean(payload.conversation_id)")<s.indexOf("const explicitPath"));
assert.match(s,/focusMessageId/);
});
test('Profile hides cluster-only membership rows and duplicate My BUKLOD settings',()=>{
const m=read('src/components/BuklodProfileMembershipNav.tsx');assert.match(m,/scope\.scope_type === 'ORGANIZATION'/);
const p=read('src/app/(tabs)/me.tsx');assert.match(p,/Lock Profile/);assert.match(p,/Community Safety/);
assert.match(p,/BSOC Support Operations/);
const section=p.slice(p.indexOf('title="My BUKLOD"'),p.indexOf('const sectionMap:'));
for(const title of ['About BUKLOD','Password & Recovery','App Language','Sounds & Notifications','Privacy Policy'])
assert.ok(!section.includes('title="'+title+'"'),title);
});
test('Real public Home announcement is on both active /hub variants',()=>{
const h=read('src/app/(tabs)/hub.tsx');assert.equal((h.match(/<BuklodSystemAnnouncementBoard slot="public_home" \/>/g)||[]).length,2);assert.match(h,/<Contribution \/>/);
});
test('Search discovers Rank, referral, attendance, and multikeyword names',()=>{
const s=read('src/lib/buklodNavigationV2.ts');for(const k of ['rank','referral','attendance','formation','music'])assert.ok(s.includes("'"+k+"'"));assert.match(s,/tokens\.every/);
});
test('Theme is scroll-bounded and compact; sounds differ in event cue and rate',()=>{
const a=read('src/components/BuklodGlobalThemeSelector.tsx');assert.match(a,/viewportHeight \* 0\.57/);assert.match(a,/flexWrap: 'wrap'/);
const b=read('src/lib/buklodSounds.ts');assert.match(b,/PROFILE_RATE/);assert.match(b,/PROFILE_GAIN/);assert.match(b,/setPlaybackRate/);
});
test('Successful GIF comment reconciles just its thread without resetting feed',()=>{
const s=read('src/app/(tabs)/buklod.tsx');assert.match(s,/options\?:\{silent\?:boolean\}/);assert.match(s,/loadComments\(postId,\{silent:true\}\)/);assert.match(s,/setPosts\(current=>current\.map/);
});
