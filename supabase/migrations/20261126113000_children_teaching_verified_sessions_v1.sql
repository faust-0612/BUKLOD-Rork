-- QA only. Completeness validation does not prove that a real-world teaching event occurred.
create table if not exists private.buklod_children_teaching_rollout(id boolean primary key default true check(id),enabled boolean not null default false);
insert into private.buklod_children_teaching_rollout values(true,false) on conflict do nothing;
alter table private.buklod_children_teaching_rollout enable row level security;
revoke all on private.buklod_children_teaching_rollout from public,anon,authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('buklod-children-teaching-evidence','buklod-children-teaching-evidence',false,2097152,array['image/jpeg']) on conflict(id) do nothing;
create table if not exists private.buklod_children_teaching_sessions(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 scope_id uuid not null references public.buklod_scopes(id),
 request_id uuid not null,
 story_id text not null check(story_id ~ '^[a-z0-9-]{3,70}$'),
 session_date date not null,
 audience text not null check(audience in ('family','sunday_school','community_group')),
 participant_count int not null check(participant_count between 1 and 100),
 reflection_length int not null check(reflection_length between 20 and 1000),
 photo_path text not null unique,
 photo_etag text not null check(photo_etag ~ '^[a-f0-9]{32}$'),
 consent_attested boolean not null check(consent_attested),
 verified_at timestamptz not null default now(),
 point_ledger_id uuid references public.buklod_points_ledger(id) on delete set null,
 unique(user_id,request_id),unique(user_id,story_id,session_date),unique(user_id,photo_etag));
alter table private.buklod_children_teaching_sessions enable row level security;
revoke all on private.buklod_children_teaching_sessions from public,anon,authenticated;
create index if not exists children_teaching_scope_date_idx on private.buklod_children_teaching_sessions(scope_id,session_date,user_id);
insert into public.buklod_point_rules(activity_type,label,base_points,max_points_per_event,is_active,notes)
 values('children_teaching_session','Children Teaching Session',10,10,true,'One evidence-complete session per adult account, story and Manila day; manual claim.') on conflict(activity_type) do nothing;
create or replace function public.buklod_children_teaching_enabled_v1(p_scope_id uuid)
returns boolean language sql stable security definer set search_path='' as $fn$
 select auth.uid() is not null
 and exists(select 1 from private.buklod_children_teaching_rollout where id and enabled)
 and exists(select 1 from public.buklod_scopes s where s.id=p_scope_id and s.scope_type='CLUSTER' and s.status='ACTIVE')
 and exists(select 1 from public.buklod_scope_memberships m where m.scope_id=p_scope_id and m.user_id=auth.uid() and m.membership_status='ACTIVE')
 and exists(select 1 from public.buklod_my_scopes_p0_v2() s where s.scope_id=p_scope_id and s.show_faith_content is true)
$fn$;
revoke all on function public.buklod_children_teaching_enabled_v1(uuid) from public,anon;
grant execute on function public.buklod_children_teaching_enabled_v1(uuid) to authenticated;
create or replace function public.buklod_children_teaching_upload_allowed_v1(p_name text)
returns boolean language plpgsql stable security definer set search_path='' as $fn$
declare actor uuid:=auth.uid(); parts text[]; target uuid;
begin
 if actor is null or p_name is null or p_name !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}[.]jpg$' then return false; end if;
 parts:=string_to_array(p_name,'/');
 if parts[1]<>actor::text then return false; end if;
 begin target:=parts[2]::uuid; exception when invalid_text_representation then return false; end;
 if not public.buklod_children_teaching_enabled_v1(target) then return false; end if;
 if exists(select 1 from private.buklod_children_teaching_sessions t where t.photo_path=p_name) then return false; end if;
 return (select count(*) from storage.objects o where o.bucket_id='buklod-children-teaching-evidence'
 and split_part(o.name,'/',1)=actor::text and not exists(select 1 from private.buklod_children_teaching_sessions t where t.photo_path=o.name))<3;
end;
$fn$;
revoke all on function public.buklod_children_teaching_upload_allowed_v1(text) from public,anon;
grant execute on function public.buklod_children_teaching_upload_allowed_v1(text) to authenticated;
drop policy if exists "Children teaching own upload v1" on storage.objects;
create policy "Children teaching own upload v1" on storage.objects for insert to authenticated
 with check(bucket_id='buklod-children-teaching-evidence' and public.buklod_children_teaching_upload_allowed_v1(name));
-- No direct SELECT, UPDATE or DELETE policy for this evidence bucket.
create or replace function public.submit_my_children_teaching_v1(
 p_expected_user uuid,p_scope_id uuid,p_request_id uuid,p_story_id text,p_session_date date,
 p_audience text,p_participant_count integer,p_reflection text,p_consent boolean
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare actor uuid:=auth.uid(); day_ph date:=(now() at time zone 'Asia/Manila')::date;
 existing private.buklod_children_teaching_sessions%rowtype; photo text; meta jsonb;
 etag text; size_text text; reflect_len integer; title text; new_id uuid; ledger uuid; points integer:=0;
begin
 if actor is null or actor is distinct from p_expected_user then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_request_id is null or p_scope_id is null then raise exception 'Missing request or workspace' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,526110));
 select * into existing from private.buklod_children_teaching_sessions t where t.user_id=actor and t.request_id=p_request_id;
 if found then
  if existing.scope_id is distinct from p_scope_id or existing.story_id is distinct from p_story_id or existing.session_date is distinct from p_session_date or existing.audience is distinct from p_audience or existing.participant_count is distinct from p_participant_count then
   raise exception 'Request already recorded with different details' using errcode='22023'; end if;
  return jsonb_build_object('recorded',true,'already_recorded',true,'session_id',existing.id,'points',coalesce((select l.points from public.buklod_points_ledger l where l.id=existing.point_ledger_id and l.user_id=actor),0),'claim_state',coalesce((select l.claim_state from public.buklod_points_ledger l where l.id=existing.point_ledger_id and l.user_id=actor),'unrewarded'));
 end if;
 if not public.buklod_children_teaching_enabled_v1(p_scope_id) then raise exception 'Teaching reporting unavailable for this workspace' using errcode='42501'; end if;
 reflect_len:=char_length(btrim(regexp_replace(coalesce(p_reflection,''),'[[:space:]]+',' ','g')));
 if p_consent is distinct from true or p_audience is null or p_audience not in ('family','sunday_school','community_group')
 or p_participant_count is null or p_participant_count not between 1 and 100 or reflect_len not between 20 and 1000
 or p_session_date is null or p_session_date not between day_ph-7 and day_ph
 or p_story_id is null or p_story_id !~ '^[a-z0-9-]{3,70}$'
 then raise exception 'Complete date, audience, count, reflection and consent' using errcode='22023'; end if;
 if not exists(select 1 from public.buklod_scope_memberships m where m.user_id=actor and m.scope_id=p_scope_id and m.membership_status='ACTIVE'
 and (coalesce(m.joined_at,m.created_at) at time zone 'Asia/Manila')::date<=p_session_date)
 then raise exception 'Session predates active membership' using errcode='42501'; end if;
 select coalesce(nullif(s.payload->'title'->>'tl',''),nullif(s.payload->'title'->>'en','')) into title from public.buklod_children_stories s
 where s.id=p_story_id and s.is_published and (s.publish_at is null or s.publish_at<=now());
 if not found and not exists(select 1 from private.buklod_children_story_answer_keys k where k.story_id=p_story_id) then raise exception 'Unknown or unavailable story' using errcode='22023'; end if;
 title:=coalesce(title,initcap(replace(p_story_id,'-',' ')));
 if exists(select 1 from private.buklod_children_teaching_sessions t where t.user_id=actor and t.story_id=p_story_id and t.session_date=p_session_date) then raise exception 'Story/date already reported' using errcode='23505'; end if;
 photo:=actor::text||'/'||p_scope_id::text||'/'||p_request_id::text||'.jpg';
 select o.metadata into meta from storage.objects o where o.bucket_id='buklod-children-teaching-evidence' and o.name=photo for share;
 if not found then raise exception 'Private teaching photo not found' using errcode='22023'; end if;
 size_text:=meta->>'size'; etag:=lower(trim(both '"' from coalesce(meta->>'eTag',meta->>'etag','')));
 if meta->>'mimetype' is distinct from 'image/jpeg' or size_text is null or size_text !~ '^[0-9]{1,10}$' then raise exception 'Invalid teaching photo metadata' using errcode='22023'; end if;
 if size_text::bigint not between 1 and 2097152 or etag !~ '^[a-f0-9]{32}$' then raise exception 'Photo size or duplicate fingerprint unavailable' using errcode='22023'; end if;
 if exists(select 1 from private.buklod_children_teaching_sessions t where t.user_id=actor and t.photo_etag=etag) then raise exception 'Photo already used' using errcode='23505'; end if;
 if not public.is_system_admin() then
 if not exists(select 1 from public.buklod_point_rules r where r.activity_type='children_teaching_session' and r.is_active and r.base_points=10 and r.max_points_per_event>=10) then raise exception 'Teaching point rule unavailable'; end if;
 points:=10; end if;
 insert into private.buklod_children_teaching_sessions(user_id,scope_id,request_id,story_id,session_date,audience,participant_count,reflection_length,photo_path,photo_etag,consent_attested)
 values(actor,p_scope_id,p_request_id,p_story_id,p_session_date,p_audience,p_participant_count,reflect_len,photo,etag,true) returning id into new_id;
 if points>0 then
 insert into public.buklod_points_ledger(user_id,direction,points,activity_type,source_key,source_id,description,awarded_by)
 values(actor,'credit',points,'children_teaching_session','children_teaching:v1:'||new_id,new_id,'Children Teaching Session: '||left(title,120),actor) returning id into ledger;
 if not exists(select 1 from public.buklod_points_ledger l where l.id=ledger and l.user_id=actor and l.claim_state='pending') then raise exception 'Manual claim ledger unavailable'; end if;
 update private.buklod_children_teaching_sessions set point_ledger_id=ledger where id=new_id;
 end if;
 perform private.buklod_notify_faith_accomplishment_v1(actor,'CHILDREN_TEACHING',new_id::text,'Children Teaching - '||title,'submitted',now(),p_scope_id);
 return jsonb_build_object('recorded',true,'already_recorded',false,'session_id',new_id,'points',points,'claim_state',case when points>0 then 'pending' else 'unrewarded' end);
end;
$fn$;
revoke all on function public.submit_my_children_teaching_v1(uuid,uuid,uuid,text,date,text,integer,text,boolean) from public,anon;
grant execute on function public.submit_my_children_teaching_v1(uuid,uuid,uuid,text,date,text,integer,text,boolean) to authenticated;
notify pgrst,'reload schema';
