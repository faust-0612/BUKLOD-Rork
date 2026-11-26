-- Fictional PG17 schema, never a production replica.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create schema auth;
create schema private;
create table public.profiles(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function public.buklod_is_system_admin() returns boolean language sql stable as $$select coalesce(auth.uid()='00000000-0000-0000-0000-000000000003'::uuid,false)$$;
create table public.buklod_point_rules(activity_type text primary key,label text,base_points int,max_points_per_event int,daily_cap_points int,weekly_cap_points int,is_active boolean,notes text,updated_by uuid,updated_at timestamptz);
create table public.buklod_points_ledger(id uuid primary key default gen_random_uuid(),user_id uuid references public.profiles(id),direction text,points int,activity_type text,source_key text,source_id uuid,description text,awarded_by uuid,claim_state text default 'pending',created_at timestamptz default now(),unique(user_id,source_key));
insert into public.profiles values ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002'),('00000000-0000-0000-0000-000000000003');
