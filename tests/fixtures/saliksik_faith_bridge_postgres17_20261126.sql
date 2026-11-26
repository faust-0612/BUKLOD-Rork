-- ONLY on disposable SALIKSIK PG17 fixture, after R1-R4 schema and legacy workflow.
-- Real SALIKSIK source tables are retained. Unrelated formation tables are minimal fixture contracts.
create schema if not exists private;
alter table public.buklod_scopes add column name text, add column organization_id uuid, add column parent_scope_id uuid;
alter table public.buklod_scope_memberships add column joined_at timestamptz not null default now()-interval '3 days', add column created_at timestamptz not null default now()-interval '3 days';
alter table public.profiles add column full_name text, add column first_name text, add column surname text;
update public.profiles set full_name='Fixture Researcher' where id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
update public.buklod_scopes set name='Research Cluster' where id='11111111-1111-1111-1111-111111111111';
insert into public.buklod_scopes(id,scope_type,status,name) values('22222222-2222-2222-2222-222222222222','CLUSTER','ACTIVE','Other Cluster');
insert into public.buklod_scope_memberships(scope_id,user_id,membership_status) values('22222222-2222-2222-2222-222222222222','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','ACTIVE');
create table public.buklod_scope_role_assignments(scope_id uuid,user_id uuid,status text,role_key text);
create table public.daily_bible_assignments(id uuid primary key,reading_date date);
create table public.daily_bible_submissions(id uuid primary key,assignment_id uuid,user_id uuid,cluster_id uuid,status text,submitted_at timestamptz);
create table public.buklod_scope_formation_approvals_v2(scope_id uuid,learner_id uuid,item_kind text,item_id uuid,status text,created_at timestamptz,updated_at timestamptz,decided_at timestamptz);
create table public.devotional_completions(id uuid primary key,user_id uuid,completion_date date,completed_at timestamptz);
create table public.devotional_reward_submissions(id uuid primary key,user_id uuid,completion_id uuid,status text);
create table public.learning_tracks(id uuid primary key,stage_code text);
create table public.learning_lessons(id uuid primary key,track_id uuid);
create table public.lesson_progress(id uuid primary key,user_id uuid,lesson_id uuid);
create table public.buklod_abc_growth_progress(user_id uuid,lesson_id text,completed_at timestamptz,primary key(user_id,lesson_id));
create table public.bible_reading_sessions(user_id uuid,book_no smallint,chapter_no smallint,source text,completed_at timestamptz);
create table public.mentor_teaching_sessions(id uuid primary key,mentor_id uuid,status text,session_date date);
create table public.mentor_session_attendees(session_id uuid,user_id uuid);
create table public.buklod_children_stories(id text primary key,payload jsonb,is_published boolean,publish_at timestamptz);
alter table public.learning_lessons add column title text;
alter table public.mentor_teaching_sessions add column lesson_id uuid;
create table private.buklod_children_story_completions(user_id uuid,story_id text,source text,completed_at timestamptz,primary key(user_id,story_id));
create table private.fixture_saliksik_notifications(recipient uuid,title text,body text,data jsonb,key text unique);
create function public.buklod_is_exact_scope_admin_v1(uuid,uuid) returns boolean language sql stable as $scope$
 select ($1='11111111-1111-1111-1111-111111111111'::uuid and $2='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid)
 or ($1='22222222-2222-2222-2222-222222222222'::uuid and $2='cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid)
$scope$;
create function public.buklod_user_has_functional_approver_role(uuid,uuid) returns boolean language sql stable as $role$ select false $role$;
create function public.buklod_cluster_submission_admin_ids_v1(uuid) returns table(user_id uuid) language sql stable as $scope$
 select case when $1='11111111-1111-1111-1111-111111111111'::uuid then 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid else 'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid end
$scope$;
create function public.buklod_queue_notification_once_v1(uuid,text,text,text,jsonb,text) returns uuid language plpgsql as $queue$
begin insert into private.fixture_saliksik_notifications values($1,$2,$3,$5,$6) on conflict do nothing; return $1; end;
$queue$;
