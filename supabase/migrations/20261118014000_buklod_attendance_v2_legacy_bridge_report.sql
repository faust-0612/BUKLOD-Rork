-- Attendance V2 bridge: historical check-ins remain intact, new paths use one reward gate.
create table if not exists public.buklod_attendance_review_audit_v2 (
 id bigint generated always as identity primary key,
 event_id uuid not null references public.attendance_events(id),
 status text not null,
 reviewer_id uuid not null references auth.users(id),
 reason text not null,
 occurred_at timestamptz not null default now()
);
alter table public.buklod_attendance_review_audit_v2 enable row level security;
revoke all on public.buklod_attendance_review_audit_v2 from public,anon,authenticated;

create or replace function public.buklod_attendance_review_audit_trigger_v2()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if NEW.reviewed_by is not null then
   insert into public.buklod_attendance_review_audit_v2(event_id,status,reviewer_id,reason)
   values(NEW.event_id,NEW.status,NEW.reviewed_by,coalesce(NEW.reason,''));
 end if;
 return NEW;
end;
$$;
drop trigger if exists trg_buklod_attendance_review_audit_v2 on public.buklod_attendance_event_review_v2;
create trigger trg_buklod_attendance_review_audit_v2
after insert or update on public.buklod_attendance_event_review_v2
for each row execute function public.buklod_attendance_review_audit_trigger_v2();
revoke all on function public.buklod_attendance_review_audit_trigger_v2() from public,anon,authenticated;

-- Close the old Cluster Home reward bypass; admin approval records attendance,
-- while BP stays behind the independent event approval/cap gate.
create or replace function public.admin_review_buklod_home_checkin_r3(
 p_checkin_id uuid,p_approve boolean,p_reason text
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare actor uuid:=auth.uid(); checkin record;
begin
 if actor is null or not public.is_system_admin()
 then raise exception 'System Admin required' using errcode='42501'; end if;
 if length(btrim(coalesce(p_reason,'')))<8 then raise exception 'Review note required'; end if;
 select c.*,e.title,e.location into checkin
 from public.buklod_home_event_checkins_r3 c
 join public.attendance_events e on e.id=c.event_id
 where c.id=p_checkin_id for update of c;
 if not found or checkin.status<>'pending' then raise exception 'Pending check-in not found'; end if;
 if p_approve then
  if nullif(btrim(checkin.location),'') is null then raise exception 'Event venue required'; end if;
  if not exists(select 1 from public.buklod_scope_memberships m where m.scope_id=checkin.scope_id
     and m.user_id=checkin.user_id and m.membership_status='ACTIVE' and m.left_at is null)
  then raise exception 'Active Cluster membership required'; end if;
  insert into public.attendance_records(event_id,user_id,status,method,operator_id,metadata,checked_in_at)
  values(checkin.event_id,checkin.user_id,'present','manual',actor,
    jsonb_build_object('source','reviewed_cluster_home_checkin','checkin_id',checkin.id),checkin.checked_in_at)
  on conflict(event_id,user_id) do nothing;
 end if;
 update public.buklod_home_event_checkins_r3
 set status=case when p_approve then 'approved' else 'rejected' end,
 reviewed_at=now(),reviewed_by=actor,review_note=btrim(p_reason),ledger_id=null
 where id=p_checkin_id;
 return jsonb_build_object('status',case when p_approve then 'approved' else 'rejected' end,
  'credited',false,'points',0,'reward_status','independent_event_review_required');
end;
$$;
revoke all on function public.admin_review_buklod_home_checkin_r3(uuid,boolean,text) from public,anon;
grant execute on function public.admin_review_buklod_home_checkin_r3(uuid,boolean,text) to authenticated;

-- Fix event-report PII exposure: only a scope event operator/admin may read full roster.
create or replace function public.get_buklod_attendance_event_report(p_event_id uuid)
returns table(user_id uuid,full_name text,status text,method text,checked_in_at timestamptz)
language plpgsql stable security definer set search_path=''
as $$
declare actor uuid:=auth.uid();
begin
 if actor is null or not public.can_manage_buklod_attendance_event(p_event_id,actor)
 then raise exception 'Event report requires attendance operator access' using errcode='42501'; end if;
 return query
 with all_rows as (
  select r.user_id as logical_id, 'buklod:'||r.user_id::text as logical_key,
    coalesce(p.full_name,'BUKLOD Member')::text as name,
    r.status::text as state,r.method::text as recorded_method,r.checked_in_at as recorded_at
  from public.attendance_records r left join public.profiles p on p.id=r.user_id
  where r.event_id=p_event_id
  union all
  select coalesce(ap.buklod_user_id,pr.person_id),
     case when ap.buklod_user_id is not null then 'buklod:'||ap.buklod_user_id::text
       else 'person:'||pr.person_id::text end,
     ap.full_name::text,pr.status::text,pr.method::text,pr.checked_in_at
  from public.attendance_person_records pr
    join public.attendance_people ap on ap.id=pr.person_id
  where pr.event_id=p_event_id
 )
 select ranked.logical_id,ranked.name,ranked.state,ranked.recorded_method,ranked.recorded_at
 from (
   select a.*,row_number() over(partition by logical_key order by recorded_at asc) rn from all_rows a
 ) ranked
 where rn=1 order by recorded_at asc;
end;
$$;
revoke all on function public.get_buklod_attendance_event_report(uuid) from public,anon;
grant execute on function public.get_buklod_attendance_event_report(uuid) to authenticated;

-- Cross-organization home-scope reporting: one record for each real event+user.
-- A scope's operators can see its members' attendance elsewhere; no extra BP is minted.
create or replace function public.buklod_attendance_home_report_v2(
 p_scope_id uuid,p_from date default null,p_to date default null
) returns table(member_id uuid,member_name text,event_id uuid,event_title text,
 host_scope_id uuid,host_scope_name text,checked_in_at timestamptz,attendance_status text)
language plpgsql stable security definer set search_path=''
as $$
declare actor uuid:=auth.uid();
begin
 if actor is null or not public.can_operate_attendance_scope(p_scope_id,actor)
 then raise exception 'Home attendance report requires scope operator access' using errcode='42501'; end if;
 return query
 with raw as (
   select r.user_id as person,r.event_id,r.checked_in_at as stamp,r.status::text as state
   from public.attendance_records r
   union all
   select ap.buklod_user_id,pr.event_id,pr.checked_in_at,pr.status::text
   from public.attendance_person_records pr
   join public.attendance_people ap on ap.id=pr.person_id
   where ap.buklod_user_id is not null
 ), canonical as (
   select distinct on(raw.person,raw.event_id) raw.person,raw.event_id,raw.stamp,raw.state from raw
   order by raw.person,raw.event_id,raw.stamp asc
 )
 select c.person,p.full_name::text,c.event_id,
    case when public.buklod_can_view_scope(e.scope_id) then e.title else 'External attendance' end::text,
    e.scope_id,
    case when public.buklod_can_view_scope(e.scope_id) then s.name else 'External organization' end::text,
    c.stamp,c.state
 from canonical c
 join public.buklod_scope_memberships m on m.user_id=c.person
   and m.scope_id=p_scope_id and m.membership_status='ACTIVE' and m.left_at is null
 join public.attendance_events e on e.id=c.event_id
 join public.buklod_scopes s on s.id=e.scope_id
 join public.profiles p on p.id=c.person
 where (p_from is null or (c.stamp at time zone 'Asia/Manila')::date>=p_from)
  and (p_to is null or (c.stamp at time zone 'Asia/Manila')::date<=p_to)
 order by c.stamp desc limit 1000;
end;
$$;
revoke all on function public.buklod_attendance_home_report_v2(uuid,date,date) from public,anon;
grant execute on function public.buklod_attendance_home_report_v2(uuid,date,date) to authenticated;

-- Final review decisions are immutable; correcting a completed decision requires a new auditable workflow.
create or replace function public.buklod_guard_final_attendance_review_v2()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if OLD.status in ('approved','rejected') and NEW.status<>OLD.status then
   raise exception 'Final attendance reward decision cannot be changed without formal reversal';
 end if;
 return NEW;
end;
$$;
drop trigger if exists trg_guard_final_attendance_review_v2 on public.buklod_attendance_event_review_v2;
create trigger trg_guard_final_attendance_review_v2
before update on public.buklod_attendance_event_review_v2
for each row execute function public.buklod_guard_final_attendance_review_v2();
revoke all on function public.buklod_guard_final_attendance_review_v2() from public,anon,authenticated;

-- Legacy church_events rewards share the same daily/weekly anti-farming ceiling.
-- This changes BP credit only; never changes an attendance record.
create or replace function public.buklod_legacy_event_attendance_cap_v2()
returns trigger language plpgsql security definer set search_path=''
as $$
declare cfg record; event_stamp timestamptz; day_start date; week_start date;
 used_day integer; used_week integer;
begin
 if NEW.activity_type<>'event_attendance' or NEW.direction<>'credit' then return NEW; end if;
 select * into cfg from public.buklod_attendance_reward_caps_v2 where singleton=true;
 if not found then return null; end if;
 select coalesce(ev.starts_at,NEW.created_at,now()) into event_stamp
 from public.church_events ev where ev.id=NEW.source_id;
 if event_stamp is null then event_stamp:=coalesce(NEW.created_at,now()); end if;
 perform 1 from public.profiles where id=NEW.user_id for update;
 -- Legacy source_key includes a mutable timestamp. Block repeat credits for
 -- the same user+event independently of that stamp, including after correction.
 if exists (
   select 1 from public.buklod_points_ledger prev
   where prev.user_id=NEW.user_id and prev.source_id=NEW.source_id
     and prev.activity_type='event_attendance' and prev.direction='credit'
 ) then return null; end if;
 day_start:=(event_stamp at time zone 'Asia/Manila')::date;
 week_start:=date_trunc('week',event_stamp at time zone 'Asia/Manila')::date;
 select coalesce(sum(case when l.direction='credit' then l.points else -l.points end),0)::integer
 into used_day from public.buklod_points_ledger l
 left join public.attendance_events ae on ae.id=l.source_id
 left join public.church_events ce on ce.id=l.source_id
 where l.user_id=NEW.user_id and l.activity_type in ('scope_attendance','event_attendance')
 and (coalesce(ae.starts_at,ce.starts_at,l.created_at) at time zone 'Asia/Manila')::date=day_start;
 select coalesce(sum(case when l.direction='credit' then l.points else -l.points end),0)::integer
 into used_week from public.buklod_points_ledger l
 left join public.attendance_events ae on ae.id=l.source_id
 left join public.church_events ce on ce.id=l.source_id
 where l.user_id=NEW.user_id and l.activity_type in ('scope_attendance','event_attendance')
 and (coalesce(ae.starts_at,ce.starts_at,l.created_at) at time zone 'Asia/Manila')::date>=week_start
 and (coalesce(ae.starts_at,ce.starts_at,l.created_at) at time zone 'Asia/Manila')::date<week_start+7;
 NEW.points:=greatest(0,least(NEW.points,cfg.per_event,
 cfg.per_day-greatest(0,used_day),cfg.per_week-greatest(0,used_week)));
 if NEW.points<=0 then return null; end if;
 return NEW;
end;
$$;
drop trigger if exists trg_buklod_legacy_event_attendance_cap_v2 on public.buklod_points_ledger;
create trigger trg_buklod_legacy_event_attendance_cap_v2
before insert on public.buklod_points_ledger
for each row execute function public.buklod_legacy_event_attendance_cap_v2();
revoke all on function public.buklod_legacy_event_attendance_cap_v2() from public,anon,authenticated;


-- Cap-safe reversals: debit only the actual original credited BP, once.
create or replace function public.buklod_reverse_scope_attendance_points_v1(
 p_user_id uuid,p_event_id uuid,p_checked_in_at timestamptz,p_operator_id uuid default null
) returns void language plpgsql security definer set search_path=''
as $$
declare v_points integer;
begin
 if p_user_id is null or p_event_id is null then return; end if;
 perform 1 from public.profiles where id=p_user_id for update;
 select l.points into v_points from public.buklod_points_ledger l
 where l.user_id=p_user_id and l.source_key='scope_attendance:'||p_event_id::text||':'||p_user_id::text
 and l.activity_type='scope_attendance' and l.direction='credit' limit 1;
 if coalesce(v_points,0)<=0 then return; end if;
 if exists (
   select 1 from public.buklod_points_ledger l
   where l.user_id=p_user_id and l.source_id=p_event_id
     and l.activity_type='scope_attendance' and l.direction='debit'
     and l.source_key like 'scope_attendance_reversal:%'
 ) then return; end if;
 insert into public.buklod_points_ledger
  (user_id,direction,points,activity_type,source_key,source_id,description,awarded_by)
 values(p_user_id,'debit',v_points,'scope_attendance',
  'scope_attendance_reversal:v2:'||p_event_id::text||':'||p_user_id::text,
  p_event_id,'Reversed exact credited attendance BP',p_operator_id)
 on conflict(user_id,source_key) do nothing;
end;
$$;
revoke all on function public.buklod_reverse_scope_attendance_points_v1(uuid,uuid,timestamptz,uuid)
 from public,anon,authenticated;
