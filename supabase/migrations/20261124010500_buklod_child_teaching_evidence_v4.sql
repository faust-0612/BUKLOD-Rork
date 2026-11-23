-- BUKLOD children's teaching evidence V4. Only adult member account details
-- are stored; recipient is a generic person/group description (no child names).
-- Private photo, adult attestation, date and >=20-char growth narrative are
-- mandatory. One session per adult/story/day and 2 rewards/day maximum.
-- Automatic BP approval occurs ONLY after uploaded evidence exists server-side.
-- No QMP, AdMob impression or cash changes.

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('buklod-children-teaching-evidence','buklod-children-teaching-evidence',
       false,6291456,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;

create policy "Teaching evidence own upload v4" on storage.objects
 for insert to authenticated
 with check (bucket_id='buklod-children-teaching-evidence' and
   (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "Teaching evidence own read v4" on storage.objects
 for select to authenticated
 using (bucket_id='buklod-children-teaching-evidence' and
   (storage.foldername(name))[1]=(select auth.uid())::text);
-- No public bucket, no public list, no cross-user photo reading.
create table if not exists public.buklod_child_teaching_sessions_v4 (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 story_id text not null,
 audience_kind text not null check(audience_kind in ('person','group')),
 audience_description text not null check(char_length(audience_description) between 3 and 120),
 taught_on date not null,
 growth_narrative text not null check(char_length(growth_narrative) between 20 and 1500),
 photo_storage_path text not null unique,
 consent_attested boolean not null check(consent_attested=true),
 status text not null default 'APPROVED' check(status='APPROVED'),
 awarded_points integer not null default 10 check(awarded_points=10),
 created_at timestamptz not null default now(),
 unique(user_id,story_id,taught_on,audience_kind)
);
alter table public.buklod_child_teaching_sessions_v4 enable row level security;
revoke all on public.buklod_child_teaching_sessions_v4 from public,anon,authenticated;
grant select on public.buklod_child_teaching_sessions_v4 to authenticated;
create policy "adult own teaching history v4"
 on public.buklod_child_teaching_sessions_v4 for select to authenticated
 using ((select auth.uid())=user_id);

create or replace function public.submit_my_child_teaching_v4(
 p_story_id text,p_audience_kind text,p_audience_description text,
 p_taught_on date,p_growth_narrative text,p_photo_storage_path text,
 p_consent_attested boolean)
returns jsonb language plpgsql security definer set search_path=''
as $teach$
declare
 v_user uuid:=(select auth.uid());
 v_id uuid;
 v_count integer;
 v_week_count integer;
 v_pts integer;
 v_ledger_id uuid;
 v_day date:=(now() at time zone 'Asia/Manila')::date;
begin
 if v_user is null or not exists(
    select 1 from public.profiles p where p.id=v_user and p.is_active=true)
    or private.buklod_is_platform_official_v1(v_user) then
   raise exception 'Active adult member required' using errcode='42501';
 end if;
 if not coalesce(p_consent_attested,false) then
   raise exception 'Confirm permission to submit private teaching evidence';
 end if;
 if p_audience_kind not in ('person','group') or
    char_length(pg_catalog.btrim(coalesce(p_audience_description,''))) not between 3 and 120 or
    char_length(pg_catalog.btrim(coalesce(p_growth_narrative,''))) not between 20 and 1500 or
    p_taught_on<v_day-7 or p_taught_on>v_day then
   raise exception 'Complete audience type, description, date and personal growth narrative';
 end if;
 if p_story_id !~ '^[a-z0-9-]{3,70}$' or not exists(
    select 1 from private.buklod_children_story_quiz_keys_v4 q where q.story_id=p_story_id
 ) then raise exception 'Story not in verified teaching catalog'; end if;
 if p_photo_storage_path is null or
    pg_catalog.left(p_photo_storage_path,char_length(v_user::text)+1)<>v_user::text||'/' or
    p_photo_storage_path like '%..%' or
    lower(p_photo_storage_path) !~ '\.(jpg|jpeg|png|webp)$' then
   raise exception 'Upload a private JPEG/PNG/WebP evidence photo first';
 end if;
 if not exists(select 1 from storage.objects o
   where o.bucket_id='buklod-children-teaching-evidence'
     and o.name=p_photo_storage_path) then
   raise exception 'Private evidence photo not found';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(
   pg_catalog.hashtext('buklod-children-teaching-v4'),
   pg_catalog.hashtext(v_user::text));
 select s.id into v_id from public.buklod_child_teaching_sessions_v4 s
 where s.user_id=v_user and s.story_id=p_story_id and
   s.taught_on=p_taught_on and s.audience_kind=p_audience_kind;
 if v_id is not null then
   return jsonb_build_object('status','already_approved','awarded_points',0,
                             'session_id',v_id);
 end if;
 select count(*)::integer into v_count
 from public.buklod_child_teaching_sessions_v4 s
 where s.user_id=v_user and (s.created_at at time zone 'Asia/Manila')::date=v_day;
 select count(*)::integer into v_week_count
 from public.buklod_child_teaching_sessions_v4 s
 where s.user_id=v_user and
 (s.created_at at time zone 'Asia/Manila')::date>=
 date_trunc('week',now() at time zone 'Asia/Manila')::date;
 if v_count>=2 or v_week_count>=7 then
   return jsonb_build_object('status','reward_limit','awarded_points',0);
 end if;
 select base_points into v_pts from public.buklod_point_rules
 where activity_type='child_teaching_session' and is_active=true
 and base_points=10 and max_points_per_event>=10;
 if v_pts is null then
   return jsonb_build_object('status','rule_unavailable','awarded_points',0);
 end if;
 insert into public.buklod_child_teaching_sessions_v4(
    user_id,story_id,audience_kind,audience_description,taught_on,
    growth_narrative,photo_storage_path,consent_attested)
 values(v_user,p_story_id,p_audience_kind,pg_catalog.btrim(p_audience_description),
        p_taught_on,pg_catalog.btrim(p_growth_narrative),p_photo_storage_path,true)
 returning id into v_id;
 insert into public.buklod_points_ledger(
 user_id,direction,points,activity_type,source_key,source_id,description)
 values(v_user,'credit',v_pts,'child_teaching_session',
        'child_teaching:v4:'||v_id::text,v_id,'Verified children story teaching session')
 on conflict(user_id,source_key) do nothing returning id into v_ledger_id;
 if v_ledger_id is null then raise exception 'Could not mint verified teaching reward'; end if;
 return jsonb_build_object('status','approved','session_id',v_id,
                           'awarded_points',v_pts,'claim_state','pending');
end;
$teach$;
revoke all on function public.submit_my_child_teaching_v4(
 text,text,text,date,text,text,boolean) from public,anon,authenticated;
grant execute on function public.submit_my_child_teaching_v4(
 text,text,text,date,text,text,boolean) to authenticated;
update public.buklod_point_rules
set is_active=true,updated_at=now()
where activity_type='child_teaching_session' and base_points=10;
comment on table public.buklod_child_teaching_sessions_v4 is
 'Private photo evidence and adult growth reflection, no child names or public media; approved by server completeness checks.';
