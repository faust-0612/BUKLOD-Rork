-- Disposable fictional schema only. Never run against production.
grant usage on schema auth to authenticated,anon,service_role;
create schema storage;
grant usage on schema storage to authenticated;
create table storage.buckets(id text primary key,name text not null,public boolean not null,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text not null,metadata jsonb,unique(bucket_id,name));
alter table storage.objects enable row level security;
grant insert,select on storage.objects to authenticated;
create table public.buklod_point_rules(activity_type text primary key,label text,base_points int,max_points_per_event int,is_active boolean,notes text);
create table public.buklod_points_ledger(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),direction text,points int,activity_type text,source_key text,source_id uuid,description text,awarded_by uuid,claim_state text default 'pending',unique(user_id,source_key));
create function public.is_system_admin() returns boolean language sql stable as $admin$ select auth.uid()='00000000-0000-0000-0000-000000000003'::uuid $admin$;
create function public.buklod_my_scopes_p0_v2() returns table(scope_id uuid,show_faith_content boolean) language sql stable security definer set search_path='' as $scopes$
 select m.scope_id,true from public.buklod_scope_memberships m where m.user_id=auth.uid() and m.membership_status='ACTIVE'
$scopes$;
alter table public.learning_lessons add column title text;
alter table public.mentor_teaching_sessions add column lesson_id uuid;
create table private.fixture_teaching_notifications(recipient uuid,title text,body text,data jsonb,key text unique);
create function public.buklod_cluster_submission_admin_ids_v1(uuid) returns table(user_id uuid) language sql stable as $scopes$
 select case when $1='00000000-0000-0000-0000-000000000010'::uuid then '00000000-0000-0000-0000-000000000001'::uuid else '00000000-0000-0000-0000-000000000004'::uuid end
$scopes$;
create function public.buklod_queue_notification_once_v1(uuid,text,text,text,jsonb,text) returns uuid language plpgsql as $queue$
begin insert into private.fixture_teaching_notifications values($1,$2,$3,$5,$6) on conflict do nothing; return $1; end;
$queue$;
insert into public.buklod_scope_memberships values('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000020','ACTIVE',now()-interval '3 days',now()-interval '3 days');
insert into public.buklod_scope_role_assignments values('00000000-0000-0000-0000-000000000020','00000000-0000-0000-0000-000000000004','ACTIVE','CLUSTER_ADMIN');
