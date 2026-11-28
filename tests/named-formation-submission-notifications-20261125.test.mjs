import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=read('supabase/migrations/20261125141900_named_formation_submission_notifications.sql');
const previous=read('supabase/migrations/20261108030050_devotional_revision_notification_context_r1_20261108.sql');
test('exact submitter, cluster and activity come from trusted records',()=>{
  for(const token of ['p.id=v_row.learner_id','s.id=v_row.scope_id','p.full_name','p.username','s.name','v_devotional_title','a.bible_reference','lp.id=v_row.item_id and lp.user_id=v_row.learner_id','s.id=v_row.item_id and s.user_id=v_row.learner_id',"'BUKLOD ' || btrim(t.stage_code)","'101','102','103','104','105','106','107'","'%s submitted %s in %s. %s'"]) assert.ok(sql.includes(token),token);
  assert.ok(!sql.includes('A submission in your cluster'));
  assert.ok(sql.includes("left(v_admin_label,96) || ' submitted'"));
});
test('approved and correction outcomes remain informational',()=>{
  assert.ok(sql.includes('Automatically validated. No approval required.'));
  assert.ok(sql.includes('Needs correction after automatic validation. No approval required.'));
});
test('member notifications, fanout, dedupe, exact routing and grants are unchanged',()=>{
  const member=s=>s.slice(s.indexOf("  if v_row.status='APPROVED' then"),s.indexOf('  if p_auto_approved then'));
  assert.equal(member(sql),member(previous));
  const tail=s=>s.slice(s.indexOf('    for v_admin in select')).replace("left(v_admin_label,96) || ' submitted'","v_label || ' submission report'");
  assert.equal(tail(sql),tail(previous));
  assert.ok(sql.includes('SECURITY DEFINER'));
  assert.ok(sql.includes("SET search_path TO ''"));
  assert.ok(!/\b(?:update|delete from|insert into)\s+public\.notifications\b/i.test(sql));
});
