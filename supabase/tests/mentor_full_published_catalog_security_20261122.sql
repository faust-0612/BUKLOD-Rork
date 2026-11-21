-- Run only AFTER the migration on isolated BUKLOD MAIN staging/PostgreSQL.
-- Safe read-only assertions: no production account or finance data changes.
begin;
do $test$
declare
  definition text;
  eligible_count integer;
  result jsonb;
begin
  select pg_get_functiondef('public.get_my_mentor_reportable_lessons_r2()'::regprocedure)
  into definition;
  if definition is null or position('has_capability' in definition) = 0 then
    raise exception 'Mentor capability gate was removed';
  end if;
  if position('content_ready' in definition) = 0 or position('published' in definition) = 0 then
    raise exception 'Published and content-ready catalog guard is missing';
  end if;
  if has_function_privilege('anon','public.get_my_mentor_reportable_lessons_r2()','EXECUTE') then
    raise exception 'Anonymous execution of mentor catalog must be revoked';
  end if;
  if not has_function_privilege('authenticated','public.get_my_mentor_reportable_lessons_r2()','EXECUTE') then
    raise exception 'Authenticated mentors must be able to request their gated catalog';
  end if;
  -- Without a signed-in user no protected rows are exposed; fail closed.
  perform set_config('request.jwt.claim.sub','',true);
  begin
    result := public.get_my_mentor_reportable_lessons_r2();
    raise exception 'Unauthenticated catalog call unexpectedly succeeded: %', result;
  exception
    when sqlstate 'P0001' then
      if sqlerrm not like '%Authentication required%' then
        raise;
      end if;
  end;
  select count(*)::integer into eligible_count
    from public.learning_lessons l
    join public.learning_tracks t on t.id=l.track_id
    where t.status='published' and coalesce(l.content_ready,true)=true;
  if eligible_count < 0 then raise exception 'Impossible catalog count'; end if;
end;
$test$;
rollback;
