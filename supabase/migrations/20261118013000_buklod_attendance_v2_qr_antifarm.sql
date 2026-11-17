-- Attendance V2: event-scoped rotating QR, independent reward review, and bounded BP.
-- Additive identity/attendance contracts; historical records and Profile QR remain untouched.
create table if not exists public.buklod_attendance_event_qr_v2 (
  token_hash text primary key,
  event_id uuid not null references public.attendance_events(id) on delete cascade,
  issued_by uuid not null references auth.users(id),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists attendance_event_qr_v2_lookup_idx
  on public.buklod_attendance_event_qr_v2(event_id,expires_at desc);
alter table public.buklod_attendance_event_qr_v2 enable row level security;
revoke all on public.buklod_attendance_event_qr_v2 from public,anon,authenticated;

create table if not exists public.buklod_attendance_event_review_v2 (
 event_id uuid primary key references public.attendance_events(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 reviewed_by uuid references auth.users(id),
 reviewed_at timestamptz,
 reason text,
 updated_at timestamptz not null default now()
);
alter table public.buklod_attendance_event_review_v2 enable row level security;
revoke all on public.buklod_attendance_event_review_v2 from public,anon,authenticated;

create table if not exists public.buklod_attendance_reward_caps_v2 (
 singleton boolean primary key default true check(singleton),
 per_event integer not null default 10 check(per_event between 0 and 20),
 per_day integer not null default 20 check(per_day between 0 and 100),
 per_week integer not null default 50 check(per_week between 0 and 300)
);
insert into public.buklod_attendance_reward_caps_v2(singleton)
values(true) on conflict(singleton) do nothing;
alter table public.buklod_attendance_reward_caps_v2 enable row level security;
revoke all on public.buklod_attendance_reward_caps_v2 from public,anon,authenticated;

create or replace function public.buklod_issue_event_qr_v2(p_event_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare actor uuid := auth.uid(); e public.attendance_events%rowtype;
 secret uuid := gen_random_uuid(); valid_until timestamptz := now() + interval '75 seconds';
begin
 if actor is null then raise exception 'Login required' using errcode='42501'; end if;
 select * into e from public.attendance_events where id=p_event_id;
 if not found or not public.can_manage_buklod_attendance_event(p_event_id,actor)
    then raise exception 'Event operator required' using errcode='42501'; end if;
 if not e.is_active or now() < greatest(coalesce(e.attendance_open_at,e.starts_at-interval '15 minutes'),e.starts_at-interval '15 minutes')
    or now()>coalesce(e.attendance_close_at,e.ends_at,e.starts_at+interval '4 hours')
    then raise exception 'Check-in is not open'; end if;
 insert into public.buklod_attendance_event_qr_v2(token_hash,event_id,issued_by,expires_at)
 values(encode(extensions.digest(secret::text,'sha256'),'hex'),p_event_id,actor,valid_until);
 -- Bounded opportunistic cleanup. Never affects active challenges.
 delete from public.buklod_attendance_event_qr_v2
 where event_id=p_event_id and expires_at < now()-interval '10 minutes';
 return jsonb_build_object(
 'payload','BUKLOD:EVENT:V2:'||p_event_id::text||':'||secret::text,
 'expires_at',valid_until);
end;
$$;

create or replace function public.buklod_scan_event_qr_v2(p_payload text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare actor uuid:=auth.uid(); parts text[]; event_id uuid; challenge uuid;
 e public.attendance_events%rowtype; inserted_id uuid; existing_id uuid; existing_at timestamptz;
begin
 if actor is null then raise exception 'Login required' using errcode='42501'; end if;
 if length(coalesce(p_payload,''))>160 or p_payload !~* '^BUKLOD:EVENT:V2:[0-9a-f-]{36}:[0-9a-f-]{36}$'
    then raise exception 'Invalid event QR'; end if;
 parts:=string_to_array(p_payload,':'); event_id:=parts[4]::uuid; challenge:=parts[5]::uuid;
 if not exists(select 1 from public.profiles p where p.id=actor and coalesce(p.is_active,true))
    then raise exception 'Active BUKLOD account required'; end if;
 select * into e from public.attendance_events where id=event_id for share;
 if not found or not e.is_active or not ('qr'=any(e.allowed_methods)) then raise exception 'Event QR is not active'; end if;
 if now()<greatest(coalesce(e.attendance_open_at,e.starts_at-interval '15 minutes'),e.starts_at-interval '15 minutes')
   or now()>coalesce(e.attendance_close_at,e.ends_at,e.starts_at+interval '4 hours')
   then raise exception 'Outside the attendance window'; end if;
 if not exists(
   select 1 from public.buklod_attendance_event_qr_v2 q
   where q.event_id=event_id and q.token_hash=encode(extensions.digest(challenge::text,'sha256'),'hex')
   and q.expires_at>=now())
   then raise exception 'Event QR expired. Scan the latest QR.'; end if;
 insert into public.attendance_records(event_id,user_id,status,method,operator_id,metadata)
 values(event_id,actor,case when e.late_after is not null and now()>e.late_after then 'late' else 'present' end,
   'qr',actor,jsonb_build_object('source','event_qr_v2','verified_at',now()))
 on conflict(event_id,user_id) do nothing returning id into inserted_id;
 if inserted_id is null then
   select id,checked_in_at into existing_id,existing_at from public.attendance_records
   where attendance_records.event_id=event_id and attendance_records.user_id=actor;
 else
   existing_id:=inserted_id;
   select checked_in_at into existing_at from public.attendance_records where id=inserted_id;
 end if;
 return jsonb_build_object('event_id',event_id,'record_id',existing_id,
  'status',case when inserted_id is null then 'already_recorded' else 'recorded' end,
  'checked_in_at',existing_at,'reward_status','pending_verification');
end;
$$;

-- Canonical event reward: never automatically award for unreviewed events,
-- allow either record table, and serialize concurrent award decisions per user.
create or replace function public.buklod_award_scope_attendance_points_v1(
 p_user_id uuid,p_event_id uuid,p_record_id uuid,p_status text,p_operator_id uuid default null
) returns void language plpgsql security definer set search_path=''
as $$
declare
 e public.attendance_events%rowtype; record_at timestamptz; record_method text;
 record_operator uuid; record_meta jsonb; cfg record; rule_points integer;
 used_day integer; used_week integer; award integer; day_start date; week_start date;
begin
 if p_user_id is null or p_event_id is null or p_record_id is null
    or p_status not in ('present','late') then return; end if;
 select * into e from public.attendance_events where id=p_event_id;
 if not found or e.scope_id is null or e.ends_at is null then return; end if;
 if not exists(select 1 from public.buklod_attendance_event_review_v2 v
 where v.event_id=p_event_id and v.status='approved') then return; end if;
 if not public.buklod_scope_attendance_member_eligible_v1(p_user_id) then return; end if;
 select r.checked_in_at,r.method,r.operator_id,r.metadata
 into record_at,record_method,record_operator,record_meta from public.attendance_records r
 where r.id=p_record_id and r.event_id=p_event_id and r.user_id=p_user_id
 and r.status=p_status;
 if not found then
  select r.checked_in_at,r.method,r.operator_id,r.metadata
  into record_at,record_method,record_operator,record_meta
  from public.attendance_person_records r join public.attendance_people ap on ap.id=r.person_id
  where r.id=p_record_id and r.event_id=p_event_id and ap.buklod_user_id=p_user_id
    and r.status=p_status;
  if not found then return; end if;
 end if;
 -- Device-only biometric is not reliable server proof of physical presence.
 if record_method='device_biometric' then return; end if;
 if record_operator=p_user_id and coalesce(record_meta->>'source','')<>'event_qr_v2'
    then return; end if;
 if record_at<greatest(coalesce(e.attendance_open_at,e.starts_at-interval '15 minutes'),e.starts_at-interval '15 minutes')
 or record_at>coalesce(e.attendance_close_at,e.ends_at) then return; end if;
 select * into cfg from public.buklod_attendance_reward_caps_v2 where singleton=true;
 select least(base_points,coalesce(max_points_per_event,base_points)) into rule_points
 from public.buklod_point_rules where activity_type='scope_attendance' and is_active=true;
 if cfg is null or coalesce(rule_points,0)<=0 then return; end if;
 -- Serialize even across distinct events. Profile row lock is transaction-scoped.
 perform 1 from public.profiles where id=p_user_id for update;
 day_start:=(record_at at time zone 'Asia/Manila')::date;
 week_start:=date_trunc('week',record_at at time zone 'Asia/Manila')::date;
 select coalesce(sum(case when l.direction='credit' then l.points else -l.points end),0)::integer
 into used_day
 from public.buklod_points_ledger l left join public.attendance_events ev on ev.id=l.source_id
 where l.user_id=p_user_id and l.activity_type in ('scope_attendance','event_attendance')
  and (coalesce(ev.starts_at,l.created_at) at time zone 'Asia/Manila')::date=day_start;
 select coalesce(sum(case when l.direction='credit' then l.points else -l.points end),0)::integer
 into used_week
 from public.buklod_points_ledger l left join public.attendance_events ev on ev.id=l.source_id
 where l.user_id=p_user_id and l.activity_type in ('scope_attendance','event_attendance')
  and (coalesce(ev.starts_at,l.created_at) at time zone 'Asia/Manila')::date>=week_start
  and (coalesce(ev.starts_at,l.created_at) at time zone 'Asia/Manila')::date<week_start+7;
 award:=greatest(0,least(rule_points,cfg.per_event,cfg.per_day-greatest(0,used_day),
   cfg.per_week-greatest(0,used_week)));
 if award=0 then return; end if;
 insert into public.buklod_points_ledger(user_id,direction,points,activity_type,source_key,source_id,description,awarded_by)
 values(p_user_id,'credit',award,'scope_attendance',
 'scope_attendance:'||p_event_id::text||':'||p_user_id::text,p_event_id,
 'Independent verified event attendance',p_operator_id)
 on conflict(user_id,source_key) do nothing;
end;
$$;

create or replace function public.buklod_review_event_rewards_v2(
 p_event_id uuid,p_approve boolean,p_reason text
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare actor uuid:=auth.uid(); e public.attendance_events%rowtype; r record;
 approved_count integer:=0;
begin
 if actor is null then raise exception 'Login required' using errcode='42501'; end if;
 select * into e from public.attendance_events where id=p_event_id for update;
 if not found then raise exception 'Event not found'; end if;
 if not (public.is_system_admin() or public.buklod_is_scope_admin(e.scope_id))
   then raise exception 'Independent scope admin required' using errcode='42501'; end if;
 if e.created_by=actor then raise exception 'Event creator cannot approve their own event rewards' using errcode='42501'; end if;
 if length(btrim(coalesce(p_reason,'')))<10 then raise exception 'Reason must contain at least 10 characters'; end if;
 if p_approve and
   (e.created_at>e.ends_at or e.ends_at is null or e.ends_at>now() or e.starts_at>=e.ends_at
     or e.ends_at-e.starts_at<interval '15 minutes' or nullif(btrim(e.location),'') is null)
   then raise exception 'Event must be completed with a valid duration and venue'; end if;
 if p_approve and not public.is_system_admin() and (
   select count(*) from public.attendance_events ev
   where ev.created_by=e.created_by
    and (ev.starts_at at time zone 'Asia/Manila')::date=(e.starts_at at time zone 'Asia/Manila')::date
 )>2 then raise exception 'High-frequency organizer requires independent System Admin review'; end if;
 insert into public.buklod_attendance_event_review_v2(event_id,status,reviewed_by,reviewed_at,reason)
 values(p_event_id,case when p_approve then 'approved' else 'rejected' end,actor,now(),btrim(p_reason))
 on conflict(event_id) do update set status=excluded.status,reviewed_by=excluded.reviewed_by,
 reviewed_at=excluded.reviewed_at,reason=excluded.reason,updated_at=now();
 if p_approve then
   for r in select id,user_id,status,operator_id from public.attendance_records where event_id=p_event_id loop
      perform public.buklod_award_scope_attendance_points_v1(r.user_id,p_event_id,r.id,r.status,r.operator_id);
      approved_count:=approved_count+1;
   end loop;
   for r in select pr.id,ap.buklod_user_id user_id,pr.status,pr.operator_id
        from public.attendance_person_records pr join public.attendance_people ap on ap.id=pr.person_id
        where pr.event_id=p_event_id and ap.buklod_user_id is not null loop
      perform public.buklod_award_scope_attendance_points_v1(r.user_id,p_event_id,r.id,r.status,r.operator_id);
      approved_count:=approved_count+1;
   end loop;
 end if;
 return jsonb_build_object('status',case when p_approve then 'approved' else 'rejected' end,
    'records_evaluated',approved_count);
end;
$$;

create or replace function public.buklod_attendance_event_reward_status_v2(p_event_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare actor uuid:=auth.uid(); e public.attendance_events%rowtype; r record;
begin
 if actor is null then raise exception 'Login required' using errcode='42501'; end if;
 select * into e from public.attendance_events where id=p_event_id;
 if not found or not (public.buklod_can_view_scope(e.scope_id)
   or public.can_manage_buklod_attendance_event(p_event_id,actor))
 then raise exception 'Event unavailable' using errcode='42501'; end if;
 select status,reason,reviewed_at into r from public.buklod_attendance_event_review_v2 where event_id=p_event_id;
 return jsonb_build_object('status',coalesce(r.status,'pending'),
 'can_review',((public.is_system_admin() or public.buklod_is_scope_admin(e.scope_id)) and e.created_by is distinct from actor),
 'reviewed_at',r.reviewed_at);
end;
$$;

-- No public direct writes or direct internal BP awards: public RPCs enforce auth.uid().
revoke all on function public.buklod_award_scope_attendance_points_v1(uuid,uuid,uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.buklod_issue_event_qr_v2(uuid) from public,anon;
revoke all on function public.buklod_scan_event_qr_v2(text) from public,anon;
revoke all on function public.buklod_review_event_rewards_v2(uuid,boolean,text) from public,anon;
revoke all on function public.buklod_attendance_event_reward_status_v2(uuid) from public,anon;
grant execute on function public.buklod_issue_event_qr_v2(uuid) to authenticated;
grant execute on function public.buklod_scan_event_qr_v2(text) to authenticated;
grant execute on function public.buklod_review_event_rewards_v2(uuid,boolean,text) to authenticated;
grant execute on function public.buklod_attendance_event_reward_status_v2(uuid) to authenticated;
