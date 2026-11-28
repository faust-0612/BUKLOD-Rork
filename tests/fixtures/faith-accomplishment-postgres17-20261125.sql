-- Disposable PG17 only. All UUIDs below are invented fixture records.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create schema auth;
create schema private;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table public.buklod_scopes(id uuid primary key,scope_type text,name text,status text,organization_id uuid,parent_scope_id uuid);
create table public.buklod_scope_memberships(user_id uuid,scope_id uuid,membership_status text,joined_at timestamptz,created_at timestamptz);
create table public.buklod_scope_role_assignments(scope_id uuid,user_id uuid,status text,role_key text);
create table public.profiles(id uuid primary key,full_name text,first_name text,surname text);
create function public.buklod_is_exact_scope_admin_v1(uuid,uuid) returns boolean language sql stable as $$
 select $1='00000000-0000-0000-0000-000000000010'::uuid and $2='00000000-0000-0000-0000-000000000001'::uuid
$$;
create function public.buklod_user_has_functional_approver_role(uuid,uuid) returns boolean language sql stable as $$select false$$;
create table public.daily_bible_assignments(id uuid primary key,reading_date date);
create table public.daily_bible_submissions(id uuid primary key,assignment_id uuid,user_id uuid,cluster_id uuid,status text,submitted_at timestamptz);
create table public.buklod_scope_formation_approvals_v2(scope_id uuid,learner_id uuid,item_kind text,item_id uuid,status text,created_at timestamptz,updated_at timestamptz,decided_at timestamptz);
create table public.devotionals(id uuid primary key,publish_date date);
create table public.devotional_completions(id uuid primary key,user_id uuid,completion_date date,completed_at timestamptz,devotional_id uuid);
create table public.devotional_reward_submissions(id uuid primary key,user_id uuid,completion_id uuid,status text,devotional_id uuid);
create table public.kl_reading_sessions(user_id uuid,episode_id uuid,completed_at timestamptz);
create table public.learning_tracks(id uuid primary key,stage_code text);
create table public.learning_lessons(id uuid primary key,track_id uuid);
create table public.lesson_progress(id uuid primary key,user_id uuid,lesson_id uuid);
create table public.buklod_abc_growth_progress(user_id uuid,lesson_id text,completed_at timestamptz,primary key(user_id,lesson_id));
create table public.bible_reading_sessions(user_id uuid,book_no smallint,chapter_no smallint,source text,completed_at timestamptz);
create table public.mentor_teaching_sessions(id uuid primary key,mentor_id uuid,status text,session_date date);
create table public.mentor_session_attendees(session_id uuid,user_id uuid);
create table public.buklod_children_stories(id text primary key,payload jsonb,is_published boolean,publish_at timestamptz);
insert into auth.users select ('00000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid from generate_series(1,5) i;
insert into public.buklod_scopes values
 ('00000000-0000-0000-0000-000000000010','CLUSTER','Test Cluster','ACTIVE',null,null),
 ('00000000-0000-0000-0000-000000000020','CLUSTER','Other Cluster','ACTIVE',null,null);
insert into public.profiles(id,full_name) select id,'Fixture '||right(id::text,1) from auth.users;
insert into public.buklod_scope_memberships
 select id,'00000000-0000-0000-0000-000000000010','ACTIVE',now()-interval '3 days',now()-interval '3 days' from auth.users where right(id::text,1) in ('1','2','3');
insert into public.buklod_scope_memberships values
 ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000020','ACTIVE',now()-interval '3 days',now()-interval '3 days'),
 ('00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000010','ACTIVE',now(),now());
insert into public.daily_bible_assignments select ('00000000-0000-0000-0000-00000000010'||i)::uuid, (now() at time zone 'Asia/Manila')::date from generate_series(1,2)i;
insert into public.daily_bible_submissions select ('00000000-0000-0000-0000-00000000011'||i)::uuid, ('00000000-0000-0000-0000-00000000010'||i)::uuid,'00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','approved',now() from generate_series(1,2)i;
insert into public.daily_bible_submissions values ('00000000-0000-0000-0000-000000000119','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','approved',now());
insert into public.devotionals select ('00000000-0000-0000-0000-00000000018'||i)::uuid,(now() at time zone 'Asia/Manila')::date from generate_series(1,2)i;
insert into public.devotional_completions select ('00000000-0000-0000-0000-00000000012'||i)::uuid,'00000000-0000-0000-0000-000000000001',(now() at time zone 'Asia/Manila')::date,now(),('00000000-0000-0000-0000-00000000018'||i)::uuid from generate_series(1,2)i;
insert into public.devotional_reward_submissions select ('00000000-0000-0000-0000-00000000013'||i)::uuid,'00000000-0000-0000-0000-000000000001',('00000000-0000-0000-0000-00000000012'||i)::uuid,'approved',('00000000-0000-0000-0000-00000000018'||i)::uuid from generate_series(1,2)i;
insert into public.kl_reading_sessions values
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000191',now()),
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000191',now()),
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000192',null);
insert into public.buklod_scope_formation_approvals_v2 select '00000000-0000-0000-0000-000000000010',user_id,'DAILY_DEVOTION',id,'APPROVED',now(),now(),now() from public.devotional_reward_submissions;
insert into public.learning_tracks values ('00000000-0000-0000-0000-000000000140','101');
insert into public.learning_lessons select ('00000000-0000-0000-0000-00000000014'||i)::uuid,'00000000-0000-0000-0000-000000000140' from generate_series(1,2)i;
insert into public.lesson_progress select ('00000000-0000-0000-0000-00000000015'||i)::uuid,'00000000-0000-0000-0000-000000000001',('00000000-0000-0000-0000-00000000014'||i)::uuid from generate_series(1,2)i;
insert into public.buklod_scope_formation_approvals_v2 select '00000000-0000-0000-0000-000000000010',user_id,'LESSON',id,'APPROVED',now(),now(),now() from public.lesson_progress;
insert into public.buklod_abc_growth_progress values
 ('00000000-0000-0000-0000-000000000001','lesson-01',now()),
 ('00000000-0000-0000-0000-000000000001','lesson-02',now()),
 ('00000000-0000-0000-0000-000000000004','other-scope',now()),
 ('00000000-0000-0000-0000-000000000005','before-joining',now()-interval '1 minute');
insert into public.bible_reading_sessions values
 ('00000000-0000-0000-0000-000000000001',1,1,'free_reading',now()),
 ('00000000-0000-0000-0000-000000000001',1,1,'search',now()),
 ('00000000-0000-0000-0000-000000000001',1,2,'search',now()),
 ('00000000-0000-0000-0000-000000000001',1,3,'daily_plan',now());
insert into public.mentor_teaching_sessions values
 ('00000000-0000-0000-0000-000000000160','00000000-0000-0000-0000-000000000001','approved',(now() at time zone 'Asia/Manila')::date),
 ('00000000-0000-0000-0000-000000000161','00000000-0000-0000-0000-000000000001','approved',(now() at time zone 'Asia/Manila')::date),
 ('00000000-0000-0000-0000-000000000162','00000000-0000-0000-0000-000000000001','pending_admin',(now() at time zone 'Asia/Manila')::date);
insert into public.mentor_session_attendees values
 ('00000000-0000-0000-0000-000000000160','00000000-0000-0000-0000-000000000002'),
 ('00000000-0000-0000-0000-000000000160','00000000-0000-0000-0000-000000000003'),
 ('00000000-0000-0000-0000-000000000160','00000000-0000-0000-0000-000000000004'),
 ('00000000-0000-0000-0000-000000000161','00000000-0000-0000-0000-000000000002'),
 ('00000000-0000-0000-0000-000000000162','00000000-0000-0000-0000-000000000002');
