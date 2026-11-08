-- Run on isolated RC database after
-- 20261108063000_devotional_revision_notification_context_r1.sql.
-- This test is read-only and creates no member data or notifications.
begin;
do $assert$
declare
  v_fn text;
  v_policy_count integer;
begin
  if to_regprocedure('public.buklod_notify_scope_formation_outcome_v1(uuid,boolean)') is null then
    raise exception 'Canonical Formation outcome producer missing';
  end if;
  v_fn := pg_get_functiondef('public.buklod_notify_scope_formation_outcome_v1(uuid,boolean)'::regprocedure);
  if position('Revision needed: ' in v_fn)=0
    or position('devotional_title_snapshot' in v_fn)=0
    or position('submission_id' in v_fn)=0
    or position('/devotional/submissions?submissionId=' in v_fn)=0 then
    raise exception 'New member outcome does not identify the exact devotional';
  end if;
  if position('s.id=v_row.item_id and s.user_id=v_row.learner_id' in v_fn)=0 then
    raise exception 'Notification not tied to its exact learner-owned submission';
  end if;
  if position('formation:rejected:user:' in v_fn)=0
    or position('formation:approved:user:' in v_fn)=0
    or position('formation:report:cluster-admin:' in v_fn)=0 then
    raise exception 'Legacy idempotency/admin reporting changed';
  end if;
  select count(*) into v_policy_count from pg_policies
    where schemaname='public'
      and tablename='devotional_reward_submissions'
      and cmd='SELECT'
      and (qual ilike '%auth.uid()%' or qual ilike '%is_system_admin()%');
  if v_policy_count<1 then
    raise exception 'Devotional submissions lack existing own-user/admin SELECT RLS';
  end if;
  if not exists(select 1 from pg_policies
    where schemaname='public' and tablename='notifications'
    and cmd='SELECT' and qual ilike '%auth.uid()%') then
    raise exception 'Own-notifications SELECT RLS removed';
  end if;
end;
$assert$;
rollback;
