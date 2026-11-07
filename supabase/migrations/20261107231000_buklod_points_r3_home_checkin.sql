-- R3 Home Check In Today: no external attendance workspace dependency.
-- A live event is an existing Cluster scope attendance_events row; status is independent until approval.
create table if not exists public.buklod_home_event_checkins_r3(
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.attendance_events(id),
 scope_id uuid not null references public.buklod_scopes(id),
 user_id uuid not null references public.profiles(id),
 checked_in_at timestamptz not null default now(),
 status text not null default 'pending' check(status in('pending','approved','rejected')),
 reviewed_at timestamptz, reviewed_by uuid references public.profiles(id),
 review_note text,
 ledger_id uuid references public.buklod_points_ledger(id),
 unique(event_id,user_id)
);
create index if not exists buklod_home_checkin_pending_r3 on public.buklod_home_event_checkins_r3(status,checked_in_at desc);
alter table public.buklod_home_event_checkins_r3 enable row level security;
revoke all on public.buklod_home_event_checkins_r3 from public,anon,authenticated;
create or replace function public.get_my_buklod_home_checkin_today_r3()
returns jsonb language sql stable security definer set search_path=''
as $$
 select coalesce(jsonb_agg(jsonb_build_object(
 'event_id',e.id,'title',e.title,'location',coalesce(nullif(e.location,''),'Venue not provided'),
 'scope_id',e.scope_id,'scope_name',s.name,'starts_at',e.starts_at,
 'ends_at',coalesce(e.attendance_close_at,e.ends_at,e.starts_at+interval '4 hours'),
 'checkin_id',c.id,'checkin_status',c.status,'checked_in_at',c.checked_in_at)
 order by e.starts_at asc),'[]'::jsonb)
 from public.attendance_events e
 join public.buklod_scopes s on s.id=e.scope_id and s.scope_type='CLUSTER'
 join public.buklod_scope_memberships m on m.scope_id=e.scope_id
  and m.user_id=(select auth.uid()) and m.membership_status='ACTIVE' and m.left_at is null
 left join public.buklod_home_event_checkins_r3 c on c.event_id=e.id and c.user_id=(select auth.uid())
 where (select auth.uid()) is not null and e.is_active=true
 and now()>=greatest(coalesce(e.attendance_open_at,e.starts_at),e.starts_at-interval '1 hour')
 and now()<=coalesce(e.attendance_close_at,e.ends_at,e.starts_at+interval '4 hours')
 and (e.starts_at at time zone 'Asia/Manila')::date=(now() at time zone 'Asia/Manila')::date
$$;
revoke all on function public.get_my_buklod_home_checkin_today_r3() from public,anon;
grant execute on function public.get_my_buklod_home_checkin_today_r3() to authenticated;

create or replace function public.submit_my_buklod_home_checkin_r3(p_event_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare actor uuid:=auth.uid(); e record; claim record;
begin
 if actor is null then raise exception 'Authentication required'; end if;
 select ev.id,ev.scope_id,ev.title,ev.location,ev.starts_at,ev.ends_at,ev.attendance_open_at,
 ev.attendance_close_at into e from public.attendance_events ev
 join public.buklod_scopes s on s.id=ev.scope_id
 where ev.id=p_event_id and ev.is_active=true and s.scope_type='CLUSTER'
 for share of ev;
 if not found then raise exception 'No active Cluster event';end if;
 if e.starts_at is null
 or (e.starts_at at time zone 'Asia/Manila')::date<>(now() at time zone 'Asia/Manila')::date
 or now()<greatest(coalesce(e.attendance_open_at,e.starts_at),e.starts_at-interval '1 hour')
 or now()>coalesce(e.attendance_close_at,e.ends_at,e.starts_at+interval '4 hours') then
  raise exception 'Attendance check-in window is closed';end if;
 if not exists (select 1 from public.buklod_scope_memberships m
 where m.scope_id=e.scope_id and m.user_id=actor and m.membership_status='ACTIVE'
  and m.left_at is null) then raise exception 'Active Cluster membership required';end if;
 insert into public.buklod_home_event_checkins_r3(event_id,scope_id,user_id)
 values(p_event_id,e.scope_id,actor)
 on conflict(event_id,user_id) do nothing;
 select id,status,checked_in_at into claim from public.buklod_home_event_checkins_r3
 where event_id=p_event_id and user_id=actor;
 return jsonb_build_object('id',claim.id,'status',claim.status,
   'checked_in_at',claim.checked_in_at,'event',e.title,'location',e.location);
end;
$$;
revoke all on function public.submit_my_buklod_home_checkin_r3(uuid) from public,anon;
grant execute on function public.submit_my_buklod_home_checkin_r3(uuid) to authenticated;

create or replace function public.admin_get_buklod_home_checkin_queue_r3()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare result jsonb;
begin
 if (select auth.uid()) is null or not public.is_system_admin() then
 raise exception 'System Admin access required' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
 'id',c.id,'event_id',c.event_id,'member_id',c.user_id,'status',c.status,
 'checked_in_at',c.checked_in_at,'event',e.title,'place',e.location,'starts_at',e.starts_at,
 'cluster',s.name) order by c.checked_in_at desc),'[]'::jsonb) into result
 from (select * from public.buklod_home_event_checkins_r3
 where status='pending' order by checked_in_at desc limit 100) c
 join public.attendance_events e on e.id=c.event_id
 join public.buklod_scopes s on s.id=c.scope_id;
 return result;
end;
$$;
revoke all on function public.admin_get_buklod_home_checkin_queue_r3() from public,anon;
grant execute on function public.admin_get_buklod_home_checkin_queue_r3() to authenticated;

create or replace function public.admin_review_buklod_home_checkin_r3(
 p_checkin_id uuid,p_approve boolean,p_reason text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare actor uuid:=auth.uid(); row_rec record; awarded integer:=0; awarded_id uuid;
begin
 if actor is null or not public.is_system_admin() then raise exception 'Admin required' using errcode='42501';end if;
 if length(trim(coalesce(p_reason,'')))<8 then raise exception 'Review note required';end if;
 select c.*,e.title,e.location,e.starts_at into row_rec
 from public.buklod_home_event_checkins_r3 c
 join public.attendance_events e on e.id=c.event_id
 where c.id=p_checkin_id for update of c;
 if not found then raise exception 'Check-in missing';end if;
 if row_rec.status<>'pending' then raise exception 'Already reviewed';end if;
 if p_approve then
  if not exists(select 1 from public.buklod_scope_memberships m
   where m.scope_id=row_rec.scope_id and m.user_id=row_rec.user_id
   and m.membership_status='ACTIVE' and m.left_at is null) then
   raise exception 'Member no longer belongs to this Cluster';end if;
  select least(r.base_points,coalesce(r.max_points_per_event,10),10)
  into awarded from public.buklod_point_rules r
  where r.activity_type='scope_attendance' and r.is_active=true;
  awarded:=greatest(coalesce(awarded,0),0);
  if awarded>0 then
   insert into public.buklod_points_ledger
   (user_id,direction,points,activity_type,source_key,source_id,description,awarded_by)
   values(row_rec.user_id,'credit',awarded,'scope_attendance',
    'scope_attendance:'||row_rec.event_id::text||':'||row_rec.user_id::text,
    row_rec.event_id,
    'Admin-verified Cluster attendance: '||row_rec.title||' at '||
       coalesce(nullif(row_rec.location,''),'unspecified venue'),actor)
   on conflict(user_id,source_key) do nothing returning id into awarded_id;
  end if;
 end if;
 update public.buklod_home_event_checkins_r3
 set status=case when p_approve then 'approved' else 'rejected' end,
 reviewed_at=now(),reviewed_by=actor,review_note=trim(p_reason),ledger_id=awarded_id
 where id=p_checkin_id;
 return jsonb_build_object('status',case when p_approve then 'approved' else 'rejected' end,
 'credited',awarded_id is not null,'points',case when awarded_id is not null then awarded else 0 end);
end;
$$;
revoke all on function public.admin_review_buklod_home_checkin_r3(uuid,boolean,text) from public,anon;
grant execute on function public.admin_review_buklod_home_checkin_r3(uuid,boolean,text) to authenticated;
