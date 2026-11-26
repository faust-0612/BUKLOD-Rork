-- Ephemeral PG17 only, run after report fixtures. No external services.
begin;
alter table public.learning_lessons add column title text;
alter table public.mentor_teaching_sessions add column lesson_id uuid;
create table private.fixture_notifications(recipient uuid,title text,body text,data jsonb,key text unique);
create function public.buklod_cluster_submission_admin_ids_v1(uuid) returns table(user_id uuid)
language sql stable as $$ select case when $1='00000000-0000-0000-0000-000000000010'::uuid
 then '00000000-0000-0000-0000-000000000003'::uuid else '00000000-0000-0000-0000-000000000004'::uuid end $$;
create function public.buklod_queue_notification_once_v1(uuid,text,text,text,jsonb,text) returns uuid
language plpgsql as $$ begin
 insert into private.fixture_notifications values($1,$2,$3,$5,$6) on conflict do nothing;
 return $1; end $$;
create table public.saliksik_investigations(id uuid,title text);
create table public.saliksik_mastery(user_id uuid,investigation_id uuid,version int,passed_at timestamptz);
create table public.saliksik_attempts(user_id uuid,investigation_id uuid,scope_id uuid,passed boolean,submitted_at timestamptz);
create table public.saliksik_master_submissions(user_id uuid,investigation_id uuid,version int,scope_id uuid,status text,reviewed_at timestamptz);
\ir ../../supabase/migrations/20261125142000_faith_accomplishment_named_notifications.sql
insert into public.buklod_abc_growth_progress values
 ('00000000-0000-0000-0000-000000000001','lesson-03',now()),
 ('00000000-0000-0000-0000-000000000001','lesson-04',now()),
 ('00000000-0000-0000-0000-000000000005','before-joining-2',now()-interval '1 minute');
insert into public.bible_reading_sessions values
 ('00000000-0000-0000-0000-000000000001',43,1,'free_reading',now()),
 ('00000000-0000-0000-0000-000000000001',43,1,'search',now()),
 ('00000000-0000-0000-0000-000000000001',43,2,'daily_plan',now());
insert into private.buklod_children_story_completions(user_id,story_id,version,source) values
 ('00000000-0000-0000-0000-000000000001','maliit-na-ilaw',1,'bundled');
update public.mentor_teaching_sessions set status='approved'
 where id='00000000-0000-0000-0000-000000000162';
update public.mentor_teaching_sessions set status='approved'
 where id='00000000-0000-0000-0000-000000000162';
insert into public.saliksik_investigations values
 ('00000000-0000-0000-0000-000000000171','John 1 investigation'),
 ('00000000-0000-0000-0000-000000000172','Outside cluster investigation');
insert into public.saliksik_attempts values
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000171','00000000-0000-0000-0000-000000000010',true,now()),
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000172','00000000-0000-0000-0000-000000000020',true,now());
insert into public.saliksik_mastery values
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000171',1,now()),
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000172',1,now());
do $test$
begin
 if (select count(*) from private.fixture_notifications)<>7 then
  raise exception 'Expected 7 isolated accomplishment notifications, got %',(select count(*) from private.fixture_notifications); end if;
 if exists(select 1 from private.fixture_notifications where recipient<>'00000000-0000-0000-0000-000000000003'::uuid or body not like '%Test Cluster%') then raise exception 'Cross-cluster disclosure'; end if;
 if (select count(*) from private.fixture_notifications where data->>'item_kind'='ABAKA')<>2 then raise exception 'ABAKA must report per lesson'; end if;
 if (select count(*) from private.fixture_notifications where data->>'item_kind'='BIBLE_CHAPTER' and body like '%Fixture 1%John 1%')<>1 then raise exception 'Bible chapter dedupe or label failed'; end if;
 if (select count(*) from private.fixture_notifications where data->>'item_kind' in ('MENTOR_SESSION','MENTEE_SESSION'))<>2 then raise exception 'Mentor and mentee reports failed'; end if;
 if (select count(*) from private.fixture_notifications where data->>'item_kind'='SALIKSIK')<>1 then raise exception 'SALIKSIK attribution failed'; end if;
 if has_function_privilege('authenticated','private.buklod_notify_faith_accomplishment_v1(uuid,text,text,text,text,timestamptz,uuid,uuid)','EXECUTE') then raise exception 'Notification helper publicly callable'; end if;
end;
$test$;
rollback;
