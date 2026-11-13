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
 for(const name of ['Community Safety','Contact us','Live support'])
   assert.ok((s+read('src/app/settings/index.tsx')).toLowerCase().includes(name.toLowerCase()),name);
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
 for(const key of ['BuklodSoundProfile','BuklodSoundVolume','PROFILE_EARCONS','PROFILE_RATE','PROFILE_GAIN','VOLUME_LEVEL'])
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
 assert.match(cards,/minHeight: 180/,'cards remain usable and responsive');
 assert.match(hub,/borderRadius: buklodVisual.radius.card/,'public Hub uses standard rounded design tokens');
});
test('BUKLOD Today shows public Dugtong in-card with private and history controls',()=>{
 const screen=read('src/components/BuklodTodayCard.tsx');
 for(const key of ['get_buklod_today_tip_v2','react_to_buklod_today_tip_v2',
  'get_my_buklod_today_dugtong_history_v2','set_buklod_today_dugtong_visibility_v2',
  'Continue reading','Save Dugtong','awarded_points','Claim your pending reward',
  'Mga Dugtong ng Komunidad','Private · ikaw lang','Public · lahat',
  'list_buklod_today_dugtongs_v2','Tingnan pa ang mga Dugtong'])
  assert.ok(screen.includes(key),key);
 assert.ok(!screen.includes('Share to Wall'),'Dugtong must be published on this card, not Wall');
 const home=read('src/app/(tabs)/hub.tsx');
 assert.ok(!home.includes('onRespond={draft'),'both Home layouts must drop Wall handoff');
 assert.ok(home.split('<Today />').length>=3,'both Home layouts must use standalone card');
 assert.ok(screen.indexOf('if(data?.ok!==true)throw')<screen.indexOf('setTip(current=>current&&'),
  'Do not optimistically confirm writes or points');
 assert.match(screen,/hasSavedDugtong&&<View style=\{s\.savedDugtong\}/);
 assert.match(screen,/\{tip\.my_dugtong\}/);
 assert.match(screen,/unchangedDugtong/);
 assert.match(screen,/p_cycle_id:tip\.cycle_id/,'Stale cycle writes must be rejected by server');
});

test('Weekly Point awards are server-side, bounded and idempotent',()=>{
 const sql=read('supabase/migrations/20261108030033_buklod_weekly_tips_r1_20261108.sql');
 for(const key of ['auth.uid()','Asia/Manila','primary key(user_id,week_start)','for update','pg_advisory_xact_lock','weekly_tip_reaction','weekly_tip_dugtong','on conflict(user_id,source_key) do nothing','points_pending_claim'])
   assert.ok(sql.includes(key),key);
 assert.ok(!sql.includes('grant insert on public.buklod_weekly_tip_interactions_v1 to authenticated'));
});

test('72-hour inactivity and privacy are enforced server-side, not merely UI',()=>{
 const sql=read('supabase/migrations/20261111024318_buklod_today_public_dugtong_idle_rotation_v2_20261111.sql');
 for(const key of ["interval '72 hours'",'last_engagement_at',
   'ensure_buklod_today_tip_cycle_v2','pg_advisory_xact_lock',
   "visibility='public'","'private',updated_at",
   'enable row level security','revoke all on public.buklod_today_tip_engagement_v2',
   'get_my_buklod_today_dugtong_history_v2','set_buklod_today_dugtong_visibility_v2',
   'p_cycle_id is distinct from v_cycle_id',
   "'weekly_tip:'||v_week::text||':reaction'",
   "'weekly_tip:'||v_week::text||':dugtong'",
   'on conflict(user_id,source_key) do nothing'])
  assert.ok(sql.includes(key),key);
 assert.ok(!sql.includes('grant select on public.buklod_today_tip_engagement_v2 to anon'));
 assert.ok(!sql.includes('grant insert on public.buklod_today_tip_engagement_v2 to authenticated'));
 const paging=read('supabase/migrations/20261111025018_buklod_today_public_dugtong_paging_v2_20261111.sql');
 for(const key of ['list_buklod_today_dugtongs_v2',"visibility='public'",
  'least(greatest(coalesce(p_limit,30),1),30)','p_offset'])
  assert.ok(paging.includes(key),key);
 assert.ok(!paging.includes('grant select on public.buklod_today_tip_engagement_v2 to anon'));
 const v1=read('supabase/migrations/20261108030033_buklod_weekly_tips_r1_20261108.sql');
 assert.ok(v1.includes('primary key(user_id,week_start)'),'v1 and old-client contract intact');
});
