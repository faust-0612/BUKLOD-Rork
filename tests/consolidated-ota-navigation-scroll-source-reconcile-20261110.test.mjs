import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = f => readFileSync(f, 'utf8');

test('both scoped Homes keep members-only BP and external GCash fund as separate visible cards', () => {
  for (const file of ['src/components/BuklodScopeHomeDashboard.tsx','src/components/BuklodClusterHomeCommandCenterImpl.tsx']) {
    const s=read(file);
    assert.match(s,/BuklodScopeBPTop10/);
    assert.match(s,/BuklodScopeFundCard/);
    assert.doesNotMatch(s,/<BuklodUnifiedEarningsHomeCard/);
  }
  const sql=read('supabase/migrations/20261110103333_buklod_scope_gcash_contributions_v1.sql');
  assert.match(sql,/v_actor=v_report.submitted_by/);
  assert.match(sql,/manual_fund_custody/);
  assert.doesNotMatch(sql,/insert into private.buklod_pf_community_fund_ledger/i);
});

test('the single-source candidate preserves approved Home, offline and privacy fixes', () => {
  const hub=read('src/app/(tabs)/hub.tsx');
  assert.match(hub,/BuklodKingdomHubCard/);
  assert.match(hub,/path: '\/bible', action: \(\) => router.push\('\/bible'/);
  assert.match(read('src/components/BuklodTodayCard.tsx'),/my_dugtong/);
  assert.match(read('src/app/learn/[id].tsx'),/selectAuthorizedOfflineLessonIds/);
  assert.match(read('src/app/learn/[id].tsx'),/AI Approved/);
  assert.match(read('src/components/BuklodPersistentBottomNav.tsx'),/onPressIn/);
  assert.match(read('src/app/(tabs)/buklod.tsx'),/drawDistance=\{Platform.OS==='web' \? 2400 : 2000\}/);
  assert.match(read('src/lib/buklodHealthCenterLauncher.ts'),/HEALTH/i);
});

test('no parallel points or finance engines and no native runtime source drift introduced', () => {
  const bp=read('supabase/migrations/20261110093333_buklod_scope_bp_top10_members_only.sql');
  assert.match(bp,/viewer.user_id = v_viewer/);
  assert.match(bp,/LIMIT 10/);
  const rules=read('src/lib/buklodAiResponseValidation.ts');
  assert.match(rules,/functions\.invoke\('buklod-ai-validate-response'/);
  assert.match(rules,/rule-only \/ fail-open response/);
  const workflow=read('.github/workflows/unified_rc_compiled_qa_20261108.yml');
  assert.match(workflow,/integration\/buklod-nov10-single-source-ota/);
  const app=read('app.config.js');
  assert.match(app,/runtimeVersion: isClassroom \? '1.3.0' : '1.3.2'/);
});
