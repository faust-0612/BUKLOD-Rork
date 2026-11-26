-- Actual canonical SALIKSIK rows from the R4 workflow, no fabricated mastery rows.
begin;
do $test$
declare v_count int;
begin
 if not exists(select 1 from pg_trigger where tgrelid='public.saliksik_mastery'::regclass and tgname='buklod_faith_named_accomplishment' and not tgisinternal and tgenabled<>'D') then raise exception 'Missing canonical SALIKSIK notification hook'; end if;
 select count(*) into v_count from private.fixture_saliksik_notifications where data->>'item_kind'='SALIKSIK';
 if v_count<>9 then raise exception 'Expected nine fresh canonical notifications, got %',v_count; end if;
 if exists(select 1 from private.fixture_saliksik_notifications where recipient<>'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid or data->>'scope_id'<>'11111111-1111-1111-1111-111111111111' or body not like 'Fixture Researcher completed SALIKSIK - % in your cluster (Research Cluster).%') then raise exception 'Wrong recipient, cluster, or named activity'; end if;
 if (select count(distinct data->>'item_id') from private.fixture_saliksik_notifications)<>9 then raise exception 'Duplicate or missing investigation/version notification'; end if;
 if (select sum(points) from public.buklod_points_ledger where user_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')<>410 then raise exception 'Faith hook changed canonical pending BP'; end if;
 if has_function_privilege('authenticated','private.buklod_notify_faith_accomplishment_v1(uuid,text,text,text,text,timestamptz,uuid,uuid)','EXECUTE') then raise exception 'Public producer grant'; end if;
end;
$test$;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',true);
set local role authenticated;
do $test$
declare r jsonb;m jsonb;
begin
 r:=public.buklod_scope_faith_monitoring_period_v2('11111111-1111-1111-1111-111111111111','month',null);
 select value into m from jsonb_array_elements(r->'members') where value->>'user_id'='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
 if m->>'saliksik_completed_count' is distinct from '18' then raise exception 'Expected 18 real investigation/version accomplishments (9 legacy + 9 automated), got %',m; end if;
 begin
   perform public.buklod_scope_faith_monitoring_period_v2('22222222-2222-2222-2222-222222222222','month',null);
   raise exception 'Cross-scope report accessible';
 exception when insufficient_privilege then null; end;
end;
$test$;
select set_config('request.jwt.claim.sub','cccccccc-cccc-cccc-cccc-cccccccccccc',true);
do $test$
declare r jsonb;m jsonb;
begin
 r:=public.buklod_scope_faith_monitoring_period_v2('22222222-2222-2222-2222-222222222222','month',null);
 select value into m from jsonb_array_elements(r->'members') where value->>'user_id'='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
 if m->>'saliksik_completed_count' is distinct from '0' then raise exception 'Personal membership wrongly attributed SALIKSIK to another cluster: %',m; end if;
end;
$test$;
reset role;
rollback;
select 'SALIKSIK_CANONICAL_FAITH_QA_PASS' as verdict;
