import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  previewWeeklyClassification, manilaWeekStart, WEEKLY_CLASS_META,
  normalizeVerifiedWeeklyEvidence, WEEKLY_REWARD_POLICY,
} from '../src/lib/season2/buklodWeeklyPerformanceRulesR1.ts';
import {
  planS2WeeklyReward, mayClientMintWeeklyReward,
} from '../src/lib/season2/buklodWeeklyPerformanceRewardR1.ts';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const subject='12345678-1234-1234-1234-1234567890ab';

test('classification is fair to fresh members with verified non-faith participation',()=>{
  assert.equal(previewWeeklyClassification({active_days:0,learning_days:0,community_days:0,creation_days:0}).class_code,'unrated');
  assert.equal(previewWeeklyClassification({active_days:1,learning_days:1,community_days:0,creation_days:0}).class_code,'emerging');
  assert.equal(previewWeeklyClassification({active_days:3,learning_days:0,community_days:3,creation_days:0}).class_code,'active');
  assert.equal(previewWeeklyClassification({active_days:4,learning_days:0,community_days:4,creation_days:4}).class_code,'thrive');
  assert.deepEqual(previewWeeklyClassification({active_days:5,learning_days:0,community_days:5,creation_days:5}),
    {score:90,class_code:'exceptional',category_count:2});
  assert.equal(previewWeeklyClassification({active_days:7,learning_days:5,community_days:0,creation_days:0}).class_code,'active',
    'one activity category must not alone unlock Thrive or Exceptional');
  assert.equal(previewWeeklyClassification({active_days:1000,learning_days:1000,community_days:1000,creation_days:1000}).score,100);
});

test('classes are five bounded states; no fabricated classification',()=>{
  assert.deepEqual(Object.keys(WEEKLY_CLASS_META),['unrated','emerging','active','thrive','exceptional']);
  const valid={
    user_id:subject,week_start:'2026-11-16',class_code:'active',score:35,
    active_days:2,learning_days:0,community_days:2,creation_days:2,
  };
  assert.deepEqual(normalizeVerifiedWeeklyEvidence(valid,subject,'2026-11-16'),valid);
  assert.equal(normalizeVerifiedWeeklyEvidence({...valid,user_id:'00000000-0000-0000-0000-000000000000'},subject,'2026-11-16'),null);
  assert.equal(normalizeVerifiedWeeklyEvidence({...valid,week_start:'2026-11-09'},subject,'2026-11-16'),null);
  assert.equal(normalizeVerifiedWeeklyEvidence({...valid,class_code:'super'},subject,'2026-11-16'),null);
  assert.equal(normalizeVerifiedWeeklyEvidence({...valid,score:200},subject,'2026-11-16'),null);
});

test('Manila Monday reset happens exactly at 00:00 local, not device UTC midnight',()=>{
  assert.equal(manilaWeekStart(new Date('2026-11-15T15:59:59Z')),'2026-11-09');
  assert.equal(manilaWeekStart(new Date('2026-11-15T16:00:00Z')),'2026-11-16');
  assert.equal(manilaWeekStart(new Date('2026-11-22T15:59:59Z')),'2026-11-16');
  assert.equal(manilaWeekStart(new Date('2026-11-22T16:00:00Z')),'2026-11-23');
});

test('reward previews NEVER mint; distinct weeks only and same-week upgrade gives one idempotency key',()=>{
  const base={userId:subject,weekStart:'2026-11-16',weekClosedAndVerified:true};
  const active=planS2WeeklyReward({...base,classification:'active'});
  const exceptional=planS2WeeklyReward({...base,classification:'exceptional'});
  assert.equal(active.idempotencyKey,exceptional.idempotencyKey);
  assert.equal(exceptional.reward,'weekly_exceptional_collectible');
  assert.equal(exceptional.status,'HELD_SEASON2_BACKEND');
  assert.equal(planS2WeeklyReward({...base,weekClosedAndVerified:false,classification:'thrive'}).status,'WEEK_NOT_FINAL');
  assert.equal(planS2WeeklyReward({...base,classification:'emerging'}).status,'NO_REWARD');
  assert.equal(mayClientMintWeeklyReward(),false);
  assert.deepEqual([WEEKLY_REWARD_POLICY.grantsEnabled,WEEKLY_REWARD_POLICY.autoIssuedTokens,
    WEEKLY_REWARD_POLICY.mintedCash,WEEKLY_REWARD_POLICY.mintedSeason1BP],[false,0,0,0]);
  assert.throws(()=>planS2WeeklyReward({...base,weekStart:'2026-11-17',classification:'thrive'}),/Monday/);
});

test('avatar replaces N only; notes, Circle Rank, online dot and main/Connect taps stay intact',()=>{
  const avatar=read('src/components/ProfileAvatar.tsx');
  const profile=read('src/app/(tabs)/me.tsx');
  const client=read('src/lib/season2/buklodWeeklyPerformanceClientR1.ts');
  const card=read('src/components/season2/BuklodWeeklyPerformanceCard.tsx');
  assert.match(avatar,/ProfileAvatarStatusIndicator[\s\S]*WEEKLY_CLASS_META/);
  const indicator=avatar.split('export function ProfileAvatarStatusIndicator')[1].split('/** Readable avatar-adjacent')[0];
  assert.doesNotMatch(indicator,/>\s*N\s*</);
  assert.doesNotMatch(indicator,/readQuickNote/);
  assert.match(avatar,/export function ProfileAvatarNoteChip/);
  assert.match(avatar,/getBuklodCircleRankArt/);
  assert.match(avatar,/backgroundColor:\s*'#00AAFF'/);
  assert.match(avatar,/top:\s*-badgeSize/);
  assert.match(avatar,/userId=\{rankTargetId\}/);
  assert.match(profile,/BuklodWeeklyPerformanceCard userId=\{profile\?\.id\}/);
  assert.match(card,/viewerId!==ownerId/);
  assert.match(client,/S2_WEEKLY_PERFORMANCE_STAGING_ONLY/);
  assert.match(client,/org\.mzbministry\.buklod\.staging/);
  assert.match(client,/batchSize:32/);
  assert.match(client,/manilaWeekStart\(\)/);
  assert.match(client,/PGRST202/);
});

test('SQL core only uses claimed server-backed evidence, never inserts rewards or edits Season One',()=>{
  const path='docs/season2/sql/BUKLOD_S2_WEEKLY_PERFORMANCE_READONLY_STAGING_CANDIDATE.sql';
  const sql=read(path).toLowerCase();
  assert.ok(path.startsWith('docs/season2/sql/'));
  assert.ok(sql.indexOf('create or replace function private.buklod_weekly_performance_core_s2')<
    sql.indexOf('create or replace function public.buklod_weekly_performance_batch_s2'));
  assert.match(sql,/claim_state='claimed'/);
  assert.match(sql,/l\.direction='credit'/);
  assert.match(sql,/date_trunc\('week', now\(\) at time zone 'asia\/manila'\)/);
  assert.match(sql,/count\(distinct d\.manila_day\)/);
  assert.match(sql,/cardinality\(p_user_ids\) between 1 and 40/);
  assert.match(sql,/not private\.buklod_is_platform_official_v1/);
  assert.match(sql,/revoke all on function private\.buklod_weekly_performance_core_s2/);
  assert.match(sql,/get_my_buklod_weekly_performance_s2/);
  assert.doesNotMatch(sql,/\b(insert into|update public|delete from|grant insert|grant update|alter table)\b/);
});
