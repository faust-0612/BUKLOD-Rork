-- Fictional test schema only. Run after the isolated report fixture.
begin;
alter table public.profiles add column username text;
alter table public.learning_tracks add column title text;
alter table public.learning_lessons add column title text;
alter table public.daily_bible_assignments add column bible_reference text;
alter table public.buklod_scope_formation_approvals_v2 add column id uuid, add column remarks text;
alter table public.devotional_reward_submissions add column devotional_id uuid, add column devotional_title_snapshot text, add column admin_note text;
create table public.devotionals(id uuid primary key,title text);
create table private.fixture_formation_notifications(recipient uuid,title text,body text,data jsonb,key text unique);
create function public.buklod_cluster_submission_admin_ids_v1(uuid) returns table(user_id uuid)
language sql stable as $$ select '00000000-0000-0000-0000-000000000003'::uuid where $1='00000000-0000-0000-0000-000000000010'::uuid $$;
create function public.buklod_queue_notification_once_v1(uuid,text,text,text,jsonb,text) returns uuid
language plpgsql as $$ begin
 insert into private.fixture_formation_notifications values($1,$2,$3,$5,$6) on conflict do nothing; return $1; end $$;
update public.learning_lessons set title='Fixture Lesson A' where id='00000000-0000-0000-0000-000000000141';
update public.daily_bible_assignments set bible_reference='John 1:1–14' where id='00000000-0000-0000-0000-000000000101';
update public.devotional_reward_submissions set devotional_id='00000000-0000-0000-0000-000000000190',devotional_title_snapshot='Fixture Devotion' where id='00000000-0000-0000-0000-000000000131';
insert into public.devotionals values('00000000-0000-0000-0000-000000000190','Fixture Devotion');
update public.buklod_scope_formation_approvals_v2 set id='00000000-0000-0000-0000-000000000191' where item_id='00000000-0000-0000-0000-000000000151';
update public.buklod_scope_formation_approvals_v2 set id='00000000-0000-0000-0000-000000000192' where item_id='00000000-0000-0000-0000-000000000131';
insert into public.buklod_scope_formation_approvals_v2(scope_id,learner_id,item_kind,item_id,status,created_at,updated_at,decided_at,id)
values('00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000001','DAILY_READING','00000000-0000-0000-0000-000000000111','REJECTED',now(),now(),now(),'00000000-0000-0000-0000-000000000193');
\ir ../../supabase/migrations/20261125141900_named_formation_submission_notifications.sql
select public.buklod_notify_scope_formation_outcome_v1(id,true) from public.buklod_scope_formation_approvals_v2 where id is not null;
select public.buklod_notify_scope_formation_outcome_v1('00000000-0000-0000-0000-000000000191',true);
do $test$
begin
 if (select count(*) from private.fixture_formation_notifications)<>6 then raise exception 'Expected six unique member/admin notices'; end if;
 if (select count(*) from private.fixture_formation_notifications where recipient='00000000-0000-0000-0000-000000000003' and body like 'Fixture 1 submitted % in your cluster (Test Cluster). %')<>3 then raise exception 'Named cluster notifications missing'; end if;
 if not exists(select 1 from private.fixture_formation_notifications where body like '%BUKLOD 101 - Fixture Lesson A%') then raise exception 'Lesson title missing'; end if;
 if not exists(select 1 from private.fixture_formation_notifications where body like '%Daily Devotion - Fixture Devotion%') then raise exception 'Devotion title missing'; end if;
 if not exists(select 1 from private.fixture_formation_notifications where body like '%Daily Reading - John 1:1–14%' and body like '%Needs correction%') then raise exception 'Reading context missing'; end if;
 if has_function_privilege('authenticated','public.buklod_notify_scope_formation_outcome_v1(uuid,boolean)','EXECUTE') then raise exception 'Unauthorized outcome producer access'; end if;
end;
$test$;
rollback;
