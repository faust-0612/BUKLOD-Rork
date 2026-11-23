import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(join(root, p), 'utf8');
const migrations = {
  base: read('supabase/migrations/20261124010000_buklod_points_v4_connect_and_dugtong.sql'),
  qmp: read('supabase/migrations/20261124010100_buklod_qmp_v4_loyalty_preview_only.sql'),
  child: read('supabase/migrations/20261124010200_buklod_children_verified_quiz_v4.sql'),
  claim: read('supabase/migrations/20261124010300_buklod_points_v4_new_claim_categories.sql'),
  wall: read('supabase/migrations/20261124010400_buklod_todays_best_wall_rewards_v4.sql'),
  teaching: read('supabase/migrations/20261124010500_buklod_child_teaching_evidence_v4.sql'),
};
test('Connect verified +1 BP: actor ownership, idempotence, duplicate content, cooling and day cap',()=>{
  const sql=migrations.base;
  for(const needle of [
    "'connect_message','Verified Connect Message',1,1,20,140,true",
    "v_actor <> new.sender_id",
    "pg_advisory_xact_lock",
    "interval '45 seconds'",
    "interval '7 days'",
    "v_daily>=20",
    "new.id::text",
    "on conflict(user_id,source_key) do nothing",
    "new.deleted_at is not null",
  ]) assert.ok(sql.includes(needle),needle);
  assert.match(sql,/buklod_connect_scope_messages/i);
  assert.match(sql,/buklod_connect_direct_messages/i);
  assert.doesNotMatch(sql,/rewarded.?ad|ad.?impression|cash.?settlement/ig);
});
test('Dugtong +3 remains source-bound and weekly tip distinct from Todays Best',()=>{
  for(const key of ['community_dugtong','weekly_tip_dugtong'])
    assert.match(migrations.base,new RegExp("activity_type='"+key+"'"));
  assert.match(migrations.base,/set base_points=3, max_points_per_event=3/i);
  assert.match(migrations.wall,/NOT the\s+-- separate weekly BUKLOD Today helpful-tip card/i);
});
test('Child quiz is authoritative server-side, 144 unique four-question sets',()=>{
  const sql=migrations.child;
  const rows=[...sql.matchAll(/^\('([a-z0-9-]+)',1,array\[(\d,\d,\d,\d)\]::integer\[],(60|90)\)/gm)];
  assert.equal(rows.length,144);
  assert.equal(new Set(rows.map(m=>m[1])).size,144);
  for(const needle of [
    "p_answers is distinct from v_key.answers",
    "now()-v_start<make_interval(secs=>v_key.min_read_seconds)",
    "v_count>=4",
    "'children_story:v4:'",
  ]) assert.ok(sql.includes(needle),needle);
  assert.match(sql,/using \(\(select auth.uid\(\)\)=user_id\)/);
});
test('Private child teaching requires adult consent, date, photo evidence and one real completion per source',()=>{
  const sql=migrations.teaching;
  assert.equal((sql.match(/\$teach\$;/g)||[]).length,1,'reject duplicated migration body');
  for(const needle of [
    "public=false", // either explicit false literal in bucket insert below
  ]) {
    // Storage schema uses positional public=false instead of a named assignment.
    assert.match(sql,/values\('buklod-children-teaching-evidence','buklod-children-teaching-evidence',\s*false/);
  }
  for(const needle of [
    "p_consent_attested",
    "p_taught_on<v_day-7",
    "char_length(pg_catalog.btrim(coalesce(p_growth_narrative,''))) not between 20 and 1500",
    "from storage.objects",
    "unique(user_id,story_id,taught_on,audience_kind)",
    "unique",
    "'child_teaching_session'",
  ]) assert.ok(sql.includes(needle),needle);
  assert.doesNotMatch(sql,/create policy.*to anon/i);
  assert.doesNotMatch(sql,/public\.buklod_community_qmp_events/i);
});
test('Todays Best Wall crediting isolates canonical R37 Wall and deduplicates',()=>{
  const sql=migrations.wall;
  for(const needle of [
    "buklod_is_todays_best_post_v4",
    "v_count>=3",
    "interval '5 minutes'",
    "interval '7 days'",
    "v_awarded<5",
    "v_count>=5",
    "v_count<>7",
    "is_active=true and base_points=2",
    "is_active=true and base_points=1",
    "private.buklod_r37_social_route_v1()='r37'",
    "private.buklod_r36_process_comment_v1",
    "private.buklod_r36_process_reaction_v1",
  ]) assert.ok(sql.includes(needle),needle);
  assert.match(sql,/todays_best:reaction:/);
  assert.match(sql,/on conflict\(user_id,source_key\) do nothing/g);
});
test('QMP loyalty preview has bounded bonuses but CANNOT affect finance',()=>{
  const sql=migrations.qmp;
  for(const needle of [
    "stable security definer",
    "v_active_days>=4 and v_current>=20",
    "v_earned_bp>=50",
    "v_earned_bp>=150",
    "v_earned_bp>=300",
    "sqrt(greatest(v_historical,0)::numeric)",
    "floor(v_current::numeric*0.15)",
    "'preview_only',true",
    "'cash_effect',false",
    "'ad_view_qualification',false",
  ]) assert.ok(sql.includes(needle),needle);
  assert.doesNotMatch(sql,/\b(update|insert|delete|truncate)\s+(?:into\s+|from\s+)?(?:private\.buklod_community_|private\.buklod_pf_|public\.buklod_points_ledger)/i);
});
test('Category claims mirror the server mapping, with no claim-all UI',()=>{
  const sql=migrations.claim;
  const ui=read('src/components/points/BuklodPointsRewardsScreen.tsx');
  for(const category of ['todays_best','connect','children','bible_personal','bayanihan']) {
    assert.match(sql,new RegExp("clean_group = '"+category+"'"));
    assert.match(ui,new RegExp(category));
  }
  assert.match(ui,/claimBuklodRewardGroup\(group\.group_key\)/);
  assert.doesNotMatch(ui,/Claim all verified BUKLOD Points|claimBuklodRewardEvent\('__buklod_claim_all_eligible__'\)/);
  assert.ok(ui.indexOf("showBuklodAdOpportunity('points_claim_success')")>
    ui.indexOf("const result = await claimBuklodRewardGroup(group.group_key)"));
});
test('Earn-time star feedback only on positive server result, not claim or ad',()=>{
  const widget=read('src/components/points/BuklodEarnedStarsFeedback.tsx');
  const child=read('src/app/children-stories/[id].tsx');
  const today=read('src/components/BuklodTodayCard.tsx');
  assert.match(widget,/if \(!award \|\| award\.points <= 0\) return/);
  assert.match(child,/if\(credited>0\)/);
  assert.match(today,/if\(credited>0\)/);
  assert.match(child,/complete_my_children_story_v4/);
  assert.match(today,/react_to_buklod_today_tip_v2/);
});
