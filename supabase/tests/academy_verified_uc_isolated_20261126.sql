begin;
do $test$
declare actor uuid:='00000000-0000-0000-0000-000000000002'; src uuid; assignment uuid; credit uuid; r jsonb;
begin
 perform set_config('request.jwt.claim.sub',actor::text,true);
 if (select enabled from public.buklod_university_config where singleton) then raise exception 'Academy enabled by default'; end if;
 r:=public.buklod_university_sync_my_uc_v1(100);
 if r->>'new_uc' is distinct from '0' then raise exception 'Disabled sync gave UC'; end if;
 update public.buklod_university_config set enabled=true where singleton;
 for i in 1..20 loop
 src:=gen_random_uuid(); assignment:=gen_random_uuid();
 insert into public.daily_bible_assignments(id,reading_date) values(assignment,(now() at time zone 'Asia/Manila')::date-i);
 insert into public.daily_bible_submissions(id,assignment_id,user_id,cluster_id,status,submitted_at,reviewed_at)
 values(src,assignment,actor,'00000000-0000-0000-0000-000000000010','approved',now(),now());
 insert into public.buklod_points_ledger(user_id,direction,points,activity_type,source_key,source_id)
 values(actor,'credit',1,'daily_bible','academy-fixture:'||src,src);
 end loop;
 src:=gen_random_uuid();
 insert into public.devotional_reward_submissions(id,user_id,completion_id,status,reviewed_at) values(src,actor,gen_random_uuid(),'approved',now());
 insert into public.buklod_points_ledger(user_id,direction,points,activity_type,source_key,source_id) values(actor,'credit',1,'devotional','academy-fixture:'||src,src);
 insert into public.buklod_points_ledger(user_id,direction,points,activity_type,source_key) values(actor,'credit',5,'abc_growth_lesson','academy-foundation') returning id into credit;
 insert into public.buklod_abc_growth_progress(user_id,lesson_id,completed_at,point_ledger_id) values(actor,'lesson-01',now(),credit);
 insert into public.buklod_points_ledger(user_id,direction,points,activity_type,source_key) values(actor,'credit',12,'abc_growth_lesson','academy-doctrine') returning id into credit;
 insert into public.buklod_abc_growth_progress(user_id,lesson_id,completed_at,point_ledger_id) values(actor,'doctrine-0001',now(),credit);
 perform public.buklod_university_sync_my_uc_v1(100);
 perform public.buklod_university_sync_my_uc_v1(100);
 if (select sum(uc) from public.buklod_university_uc_ledger where user_id=actor) is distinct from 27 then raise exception 'Wrong UC total'; end if;
 if exists(select 1 from public.buklod_university_uc_ledger where source_key='doctrine-0001') then raise exception 'Continuing doctrine credited as foundation'; end if;
 if not exists(select 1 from public.buklod_university_credential_evidence where user_id=actor and credential_code='C-S01' and status='VERIFIED') then raise exception 'Automatic daily evidence missing'; end if;
 if exists(select 1 from public.buklod_university_awards where user_id=actor and credential_code='C-D01') then raise exception 'Incomplete foundation qualified'; end if;
 if (select count(*) from public.buklod_points_ledger where user_id=actor)<>23 then raise exception 'UC changed BP ledger'; end if;
 if exists(select 1 from storage.buckets where id in ('buklod-university-issuer','buklod-university-papers') and public) then raise exception 'Public credential bucket'; end if;
 if has_table_privilege('authenticated','public.buklod_university_uc_ledger','INSERT') then raise exception 'Direct UC write exposed'; end if;
end;
$test$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',true);
set local role authenticated;
do $test$
begin
 if exists(select 1 from public.buklod_university_uc_ledger) then raise exception 'Other account UC leaked'; end if;
 if exists(select 1 from public.buklod_university_awards) then raise exception 'Other account award leaked'; end if;
end;
$test$;
reset role;
rollback;
select 'ACADEMY_VERIFIED_UC_QA_PASS' as verdict;
