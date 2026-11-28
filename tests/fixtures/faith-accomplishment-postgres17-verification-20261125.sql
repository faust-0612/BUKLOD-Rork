-- Only run against the ephemeral fixture above.
begin;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
do $test$
declare a smallint[]; r jsonb; m jsonb; x jsonb;
begin
 if has_function_privilege('anon','public.buklod_scope_faith_monitoring_period_v2(uuid,text,date)','EXECUTE') or
 has_function_privilege('anon','public.complete_my_children_story_v1(uuid,text,integer,text,smallint[])','EXECUTE') or
 has_table_privilege('authenticated','private.buklod_children_story_completions','SELECT') then raise exception 'Privacy grants failed'; end if;
 select answers into a from private.buklod_children_story_answer_keys where story_id='maliit-na-ilaw' and version=1;
 begin
 perform public.complete_my_children_story_v1('00000000-0000-0000-0000-000000000002','maliit-na-ilaw',1,'bundled',a);
 raise exception 'Cross-account completion accepted';
 exception when insufficient_privilege then null; end;
 begin
 perform public.complete_my_children_story_v1('00000000-0000-0000-0000-000000000001','maliit-na-ilaw',1,'bundled',array[2]::smallint[]);
 raise exception 'Wrong answers accepted';
 exception when invalid_parameter_value then null; end;
 x:=public.complete_my_children_story_v1('00000000-0000-0000-0000-000000000001','maliit-na-ilaw',1,'bundled',a);
 if x->>'recorded' is distinct from 'true' then raise exception 'Story not confirmed'; end if;
 x:=public.complete_my_children_story_v1('00000000-0000-0000-0000-000000000001','maliit-na-ilaw',1,'bundled',a);
 if x->>'already_completed' is distinct from 'true' then raise exception 'Idempotency failed'; end if;
 r:=public.buklod_scope_faith_monitoring_period_v2('00000000-0000-0000-0000-000000000010','week',null);
 select item into m from jsonb_array_elements(r->'members') item where item->>'user_id'='00000000-0000-0000-0000-000000000001';
 if m->>'reading_approved_count' is distinct from '2' or m->>'devotion_completed_count' is distinct from '2'
 or m->>'devotion_completed_days' is distinct from '1' or m->>'devotion_actual_completion_days' is distinct from '1'
 or m->>'kl_chapter_count' is distinct from '1' or r->>'devotion_date_basis' is distinct from 'scheduled'
 or m->>'lesson_approved_count' is distinct from '2' or m->>'abaka_completed_count' is distinct from '2'
 or m->>'bible_chapter_count' is distinct from '2' or m->>'mentor_session_count' is distinct from '2'
 or m->>'mentees_reached_count' is distinct from '2' or m->>'children_story_count' is distinct from '1'
 or m->>'saliksik_completed_count' is not null or m->>'children_teaching_count' is not null
 then raise exception 'Incorrect accomplishment counts: %',m; end if;
 select item into m from jsonb_array_elements(r->'members') item where item->>'user_id'='00000000-0000-0000-0000-000000000002';
 if m->>'mentee_session_count' is distinct from '2' then raise exception 'Mentee count failed'; end if;
 select item into m from jsonb_array_elements(r->'members') item where item->>'user_id'='00000000-0000-0000-0000-000000000005';
 if m->>'abaka_completed_count' is distinct from '0' then raise exception 'Pre-membership event leaked'; end if;
 if exists(select 1 from jsonb_array_elements(r->'members') item where item->>'user_id'='00000000-0000-0000-0000-000000000004') then raise exception 'Other scope member leaked'; end if;
 begin
 perform public.buklod_scope_faith_monitoring_period_v2('00000000-0000-0000-0000-000000000020','week',null);
 raise exception 'Other scope allowed'; exception when insufficient_privilege then null; end;
end;
$test$;
-- Replay two distinct scheduled days from the same past week, completed together today.
update public.devotionals set publish_date=date_trunc('week',timezone('Asia/Manila',now()))::date-7
 where id='00000000-0000-0000-0000-000000000181';
update public.devotionals set publish_date=date_trunc('week',timezone('Asia/Manila',now()))::date-6
 where id='00000000-0000-0000-0000-000000000182';
do $test$
declare r jsonb; m jsonb;
begin
 r:=public.buklod_scope_faith_monitoring_period_v2('00000000-0000-0000-0000-000000000010','week',(timezone('Asia/Manila',now()))::date-7);
 select item into m from jsonb_array_elements(r->'members') item where item->>'user_id'='00000000-0000-0000-0000-000000000001';
 if m->>'devotion_completed_days' is distinct from '2' or m->>'devotion_completed_count' is distinct from '2'
 or m->>'devotion_actual_completion_days' is distinct from '1' or jsonb_array_length(m->'devotion_dates')<>2
 or r->'totals'->>'devotion_completed_days' is distinct from '2'
 then raise exception 'Late scheduled devotion reconciliation failed: %',m; end if;
end;
$test$;
create table public.saliksik_mastery(user_id uuid,investigation_id uuid,version int,passed_at timestamptz);
create table public.saliksik_attempts(user_id uuid,investigation_id uuid,scope_id uuid,passed boolean,submitted_at timestamptz);
create table public.saliksik_master_submissions(user_id uuid,investigation_id uuid,version int,scope_id uuid,status text,reviewed_at timestamptz);
insert into public.saliksik_mastery select '00000000-0000-0000-0000-000000000001',('00000000-0000-0000-0000-00000000017'||i)::uuid,1,now() from generate_series(1,3)i;
insert into public.saliksik_attempts values
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000171','00000000-0000-0000-0000-000000000010',true,now()),
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000173','00000000-0000-0000-0000-000000000020',true,now());
insert into public.saliksik_master_submissions values
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000172',1,'00000000-0000-0000-0000-000000000010','approved',now());
set role authenticated;
do $test$
declare r jsonb; m jsonb;
begin
 r:=public.buklod_scope_faith_monitoring_period_v2('00000000-0000-0000-0000-000000000010','month',null);
 select item into m from jsonb_array_elements(r->'members') item where item->>'user_id'='00000000-0000-0000-0000-000000000001';
 if m->>'saliksik_completed_count' is distinct from '2' then raise exception 'SALIKSIK scope/dedupe failed: %',m; end if;
end;
$test$;
reset role;
select set_config('request.jwt.claim.sub','',true);
do $test$
begin
 begin perform public.buklod_scope_faith_monitoring_period_v2('00000000-0000-0000-0000-000000000010','week',null);
 raise exception 'Unauthenticated scope access accepted'; exception when insufficient_privilege then null; end;
end;
$test$;
rollback;
