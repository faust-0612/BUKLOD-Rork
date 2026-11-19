-- Isolated rollback-only integration proof for zero-budget BSOC.
-- Requires the two BSOC automation migrations. NEVER commit synthetic member data.
begin;
set local session_replication_role=replica;
insert into public.user_feedback(user_id,category,title,message,diagnostics)
values
(null,'bug','BSOC_ZB_TEST_WALL','Wall reaction issue','{"error_signature":"RENDER_3E577D35","route_module":"community-wall"}'::jsonb),
(null,'bug','BSOC_ZB_TEST_UNKNOWN','Unexpected issue without screen or reproduction','{}'::jsonb),
(null,'privacy','BSOC_ZB_TEST_SENSITIVE','Identity verification concern','{}'::jsonb);
set local session_replication_role=origin;
insert into public.bsoc_ai_case_jobs(case_id,state)
select id,'PENDING' from public.user_feedback where title like 'BSOC_ZB_TEST_%';
select private.bsoc_ai_zero_budget_tick_v1(3);
select f.title,j.state,j.error_code,j.safe_analysis
from public.user_feedback f
join public.bsoc_ai_case_jobs j on j.case_id=f.id
where f.title like 'BSOC_ZB_TEST_%' order by f.title;
-- No unexpected changes to canonical member case status.
do $test$
begin
  if (select count(*) from public.user_feedback
      where title like 'BSOC_ZB_TEST_%' and status::text='new')<>3 then
    raise exception 'Failed: canonical member case statuses mutated';
  end if;
  if (select count(*) from public.bsoc_ai_case_jobs j
      join public.user_feedback f on f.id=j.case_id
      where f.title like 'BSOC_ZB_TEST_%'
       and ((f.title='BSOC_ZB_TEST_WALL' and j.state='TRIAGED')
         or (f.title='BSOC_ZB_TEST_UNKNOWN' and j.state='NEEDS_DETAILS')
         or (f.title='BSOC_ZB_TEST_SENSITIVE' and j.state='NEEDS_HUMAN')))<>3 then
    raise exception 'Failed: zero-budget case classifications';
  end if;
end;
$test$;
select 'PASS: rollback-only screening tests' as result;
rollback;
