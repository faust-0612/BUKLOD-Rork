begin;
do $test$
declare actor uuid:='00000000-0000-0000-0000-000000000002'; cluster uuid:='00000000-0000-0000-0000-000000000010';
 other_cluster uuid:='00000000-0000-0000-0000-000000000020'; req uuid:='11111111-1111-1111-1111-111111111111';
 req2 uuid:='22222222-2222-2222-2222-222222222222'; req3 uuid:='33333333-3333-3333-3333-333333333333';
 today date:=(now() at time zone 'Asia/Manila')::date;
 reflection text:='We discussed kindness and helping others through the story.'; r jsonb;
 path text:=actor::text||'/'||cluster::text||'/'||req::text||'.jpg';
begin
 perform set_config('request.jwt.claim.sub',actor::text,true);
 if public.buklod_children_teaching_enabled_v1(cluster) or public.buklod_children_teaching_upload_allowed_v1(path) then raise exception 'Rollout enabled by default'; end if;
 begin perform public.submit_my_children_teaching_v1(actor,cluster,req,'maliit-na-ilaw',today,'family',2,reflection,true); raise exception 'Disabled report accepted'; exception when insufficient_privilege then null; end;
 update private.buklod_children_teaching_rollout set enabled=true where id;
 if not public.buklod_children_teaching_upload_allowed_v1(path) then raise exception 'Eligible upload denied'; end if;
 if public.buklod_children_teaching_upload_allowed_v1(replace(path,actor::text,'00000000-0000-0000-0000-000000000005')) then raise exception 'Cross-account upload'; end if;
 begin perform public.submit_my_children_teaching_v1(actor,cluster,req,'maliit-na-ilaw',today,'family',2,reflection,true); raise exception 'Missing photo accepted'; exception when invalid_parameter_value then if SQLERRM<>'Private teaching photo not found' then raise; end if; end;
 insert into storage.objects(bucket_id,name,metadata) values('buklod-children-teaching-evidence',path,jsonb_build_object('mimetype','image/jpeg','size',1200,'eTag','"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"'));
 begin perform public.submit_my_children_teaching_v1(actor,cluster,req,'maliit-na-ilaw',today,'family',2,'short',true); raise exception 'Short reflection accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.submit_my_children_teaching_v1(actor,cluster,req,'maliit-na-ilaw',today,'family',2,reflection,false); raise exception 'Missing consent accepted'; exception when invalid_parameter_value then null; end;
 r:=public.submit_my_children_teaching_v1(actor,cluster,req,'maliit-na-ilaw',today,'family',2,reflection,true);
 if r->>'points' is distinct from '10' or r->>'claim_state' is distinct from 'pending' then raise exception 'Pending award missing %',r; end if;
 r:=public.submit_my_children_teaching_v1(actor,cluster,req,'maliit-na-ilaw',today,'family',2,reflection,true);
 if r->>'already_recorded' is distinct from 'true' then raise exception 'Replay not idempotent'; end if;
 begin perform public.submit_my_children_teaching_v1(actor,other_cluster,req2,'maliit-na-ilaw',today,'family',2,reflection,true); raise exception 'Story/day duplicated across clusters'; exception when unique_violation then null; end;
 insert into storage.objects(bucket_id,name,metadata) values('buklod-children-teaching-evidence',actor::text||'/'||cluster::text||'/'||req2::text||'.jpg',jsonb_build_object('mimetype','image/jpeg','size',1200,'eTag','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'));
 begin perform public.submit_my_children_teaching_v1(actor,cluster,req2,'david-at-ang-tapang',today,'family',2,reflection,true); raise exception 'Reused photo accepted'; exception when unique_violation then null; end;
 insert into storage.objects(bucket_id,name,metadata) values('buklod-children-teaching-evidence',actor::text||'/'||cluster::text||'/'||req3::text||'.jpg',jsonb_build_object('mimetype','image/jpeg','size',1200,'eTag','bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'));
 r:=public.submit_my_children_teaching_v1(actor,cluster,req3,'david-at-ang-tapang',today,'sunday_school',3,reflection,true);
 if r->>'points' is distinct from '10' then raise exception 'Second distinct session rejected'; end if;
 if (select count(*) from public.buklod_points_ledger where user_id=actor)<>2 or (select sum(points) from public.buklod_points_ledger where user_id=actor)<>20 then raise exception 'Duplicate/missing ledger'; end if;
 if (select count(*) from private.fixture_teaching_notifications where data->>'item_kind'='CHILDREN_TEACHING')<>2 then raise exception 'Incorrect notification count'; end if;
 if exists(select 1 from private.fixture_teaching_notifications where recipient<>'00000000-0000-0000-0000-000000000001'::uuid or body not like 'Fixture 2 submitted Children Teaching - % in your cluster (Test Cluster).%') then raise exception 'Incorrect named notification'; end if;
 if has_table_privilege('authenticated','private.buklod_children_teaching_sessions','SELECT') or has_table_privilege('authenticated','private.buklod_children_teaching_sessions','INSERT') then raise exception 'Private evidence grants'; end if;
 if has_function_privilege('anon','public.submit_my_children_teaching_v1(uuid,uuid,uuid,text,date,text,integer,text,boolean)','EXECUTE') then raise exception 'Anonymous submission grant'; end if;
end;
$test$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
set local role authenticated;
do $test$
declare r jsonb; m jsonb;
begin
 r:=public.buklod_scope_faith_monitoring_period_v3('00000000-0000-0000-0000-000000000010','month',null);
 select value into m from jsonb_array_elements(r->'members') where value->>'user_id'='00000000-0000-0000-0000-000000000002';
 if m->>'children_teaching_count' is distinct from '2' then raise exception 'Per-session count incorrect: %',m; end if;
 begin execute 'select 1 from private.buklod_children_teaching_sessions limit 1'; raise exception 'Private teaching table exposed'; exception when insufficient_privilege then null; end;
 if exists(select 1 from storage.objects where bucket_id='buklod-children-teaching-evidence') then raise exception 'Storage objects exposed'; end if;
end;
$test$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',true);
do $test$
declare r jsonb; m jsonb;
begin
 r:=public.buklod_scope_faith_monitoring_period_v3('00000000-0000-0000-0000-000000000020','month',null);
 select value into m from jsonb_array_elements(r->'members') where value->>'user_id'='00000000-0000-0000-0000-000000000002';
 if m->>'children_teaching_count' is distinct from '0' then raise exception 'Cross-cluster count leaked'; end if;
 begin perform public.buklod_scope_faith_monitoring_period_v3('00000000-0000-0000-0000-000000000010','month',null); raise exception 'Cross-cluster report exposed'; exception when insufficient_privilege then null; end;
end;
$test$;
reset role;
rollback;
select 'CHILDREN_TEACHING_BEHAVIOR_QA_PASS' as verdict;
