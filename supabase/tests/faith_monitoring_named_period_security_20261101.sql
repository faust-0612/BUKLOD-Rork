-- Run only after the new read-only period RPC migration is applied.
-- No fixture members or private devotional content are accessed.
do $faith_period_contract$
declare
  fn regprocedure := to_regprocedure('public.buklod_scope_faith_monitoring_period_v1(uuid,text,date)');
  body text;
begin
  if fn is null then
    raise exception 'Named weekly/monthly report RPC is not installed';
  end if;
  body := pg_get_functiondef(fn::oid);
  if has_function_privilege('anon',fn::oid,'EXECUTE')
     or not has_function_privilege('authenticated',fn::oid,'EXECUTE')
     or position('SECURITY DEFINER' in upper(body)) = 0
     or position('search_path' in body) = 0
     or position('auth.uid()' in body) = 0
     or position('buklod_is_exact_scope_admin_v1' in body) = 0
     or position('buklod_user_has_functional_approver_role' in body) = 0
     or position('allowed_scopes' in body) = 0
     or position('devotional_completions' in body) = 0
     or position('daily_bible_assignments' in body) = 0
     or position('answer_text' in body) > 0
     or position('reflection_snapshot' in body) > 0
  then
    raise exception 'Named period report permission / privacy invariant failed';
  end if;
  -- Anonymous execution must be rejected before attempting any roster access.
  begin
    perform public.buklod_scope_faith_monitoring_period_v1(
      '00000000-0000-0000-0000-000000000000'::uuid,
      'week', current_date
    );
    raise exception 'Unauthenticated report access was not rejected';
  exception when insufficient_privilege then
    null; -- expected SQLSTATE 42501
  end;
end;
$faith_period_contract$;
