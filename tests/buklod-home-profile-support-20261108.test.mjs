import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Reward focus moves to CLUSTER Home only, not Points/Character',()=>{
 const scope=read('src/components/BuklodScopeHomeDashboard.tsx');
 const points=read('src/components/points/BuklodPointsRewardsScreen.tsx');
 assert.ok(scope.includes("scope.scope_type === 'CLUSTER' ? <BuklodR2FocusMonitor />"));
 assert.ok(!points.includes('BuklodR2FocusMonitor'));
});
test('Profile routes are distinct and personnel code is not a public menu',()=>{
 const s=read('src/app/(tabs)/me.tsx');
 for(const name of ['Paid Features','BUKLOD Policy','Send Feedback','BSOC Personnel Access Code'])
   assert.ok(!s.includes('title="'+name+'"'),name);
 for(const name of ['Community Safety','Contact Us','Live Chat & Report a Problem'])
   assert.ok(s.includes('title="'+name+'"'),name);
 const admin=read('src/app/admin/bsoc-personnel.tsx');
 const staff=read('src/app/bsoc/access.tsx');
 assert.ok(admin.includes('buklod_bsoc_issue_personnel_code_v1'));
 assert.ok(staff.includes('buklod_bsoc_redeem_personnel_code_v1'));
 assert.ok(staff.includes('supabase.auth.getUser'));
});
test('Live Support exposes photo and video before cases, and logs after chat editor',()=>{
 const s=read('src/app/support/live.tsx');
 assert.ok(s.includes('Upload support photo')&&s.includes('Upload support video'));
 assert.ok(s.includes('targetCaseId')&&s.includes('bsoc_case_attachments'));
 assert.ok(s.indexOf('Send a photo or video to BSOC')<s.indexOf('Create a concern'));
 assert.ok(s.indexOf('Conversation & evidence log')>s.indexOf('Send message'));
 assert.ok(s.indexOf('Previous support cases · Activity logs')>s.indexOf('Conversation & evidence log'));
});
test('Contact Us is direct, no second Send Feedback',()=>{
 const s=read('src/app/contact-us/index.tsx');
 for(const value of ['mzbministry@gmail.com','09167366414','Mt Zion Baptist Ministry','mailto:','tel:'])
   assert.ok(s.includes(value),value);
 assert.ok(!s.includes("router.push('/feedback'"));
});
test('Sound styles and volume choices have actual local cue assets',()=>{
 const lib=read('src/lib/buklodSounds.ts');
 const screen=read('src/app/settings/sounds.tsx');
 for(const key of ['BuklodSoundProfile','BuklodSoundVolume','GENTLE_SOUNDS','CELEBRATION_SOUNDS','VOLUME_LEVEL'])
   assert.ok(lib.includes(key),key);
 for(const key of ['Preview selected style','Gentle','Celebration','Balanced','Quiet hours'])
   assert.ok(screen.includes(key),key);
});
test('Canonical Home uses square Bahay and Health Center cards, mobile and desktop',()=>{
 const hub=read('src/app/(tabs)/hub.tsx');
 const cards=read('src/components/home/BuklodHomeUtilityCards.tsx');
 assert.equal(hub.split('<BuklodHomeUtilityCards />').length-1,2);
 for(const key of ['paddingHorizontal: 0','/personal-home','/profile/buklod-health'])
   assert.ok((hub+cards).includes(key),key);
 assert.match(cards,/aspectRatio:\s*1\b/,'utility cards must stay square');
 assert.match(hub,/borderRadius:\s*4\b/,'public Hub compact card corners retained');
});
test('Weekly tips have real continuation, reactions and confirmed BP feedback',()=>{
 const screen=read('src/components/BuklodTodayCard.tsx');
 for(const key of ['get_buklod_weekly_tip_v1','react_to_buklod_weekly_tip_v1','Continue reading','Save Dugtong','awarded_points','Claim your pending reward'])
  assert.ok(screen.includes(key),key);
});
test('Weekly Point awards are server-side, bounded and idempotent',()=>{
 const sql=read('supabase/migrations/20261108030033_buklod_weekly_tips_r1_20261108.sql');
 for(const key of ['auth.uid()','Asia/Manila','primary key(user_id,week_start)','for update','pg_advisory_xact_lock','weekly_tip_reaction','weekly_tip_dugtong','on conflict(user_id,source_key) do nothing','points_pending_claim'])
   assert.ok(sql.includes(key),key);
 assert.ok(!sql.includes('grant insert on public.buklod_weekly_tip_interactions_v1 to authenticated'));
});

test('Saved weekly Dugtong appears beneath the tip and is private until Wall share',()=>{
 const screen=read('src/components/BuklodTodayCard.tsx');
 assert.match(screen,/hasSavedDugtong&&<View style=\{s\.savedDugtong\}/);
 assert.match(screen,/Ang Dugtong mo/);
 assert.match(screen,/\{tip\.my_dugtong\}/);
 assert.match(screen,/Pribado/);
 assert.match(screen,/I-edit ang Dugtong/);
 assert.match(screen,/setDraft\(tip\.my_dugtong\?\?''\);setEditing\(false\)/);
 assert.match(screen,/my_dugtong:dugtong\?\?current\.my_dugtong/);
 assert.ok(screen.indexOf('if(data?.ok!==true)throw')<screen.indexOf('setTip(current=>current?'));
 assert.match(screen,/!hasSavedDugtong\|\|editing/);
 assert.match(screen,/unchangedDugtong/);
 const home=read('src/app/(tabs)/hub.tsx');
 assert.match(home,/homeTodayDraft: draft \?\? ''/);
 assert.match(screen,/onRespond\(draft\.trim\(\)\|\|tip\.my_dugtong/);
});
