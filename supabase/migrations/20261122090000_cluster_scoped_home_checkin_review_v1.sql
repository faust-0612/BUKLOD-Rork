-- Home Check In Today: verification belongs to the exact Cluster admin, not System Admin.
-- Keep existing claims and ledger source keys unchanged; no credits are backfilled here.
-- All authorized reads and writes use auth.uid() and exact-scope ACTIVE membership + role.

create or replace function public.buklod_cluster_can_review_home_checkin_v1(p_scope_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select (select auth.uid()) is not null
    and p_scope_id is not null
    and exists (
      select 1
      from public.buklod_scopes s
      join public.buklod_scope_memberships m
        on m.scope_id=s.id
       and m.user_id=(select auth.uid())
       and m.membership_status='ACTIVE'
       and m.left_at is null
      join public.buklod_scope_role_assignments ra
        on ra.scope_id=s.id
       and ra.user_id=m.user_id
       and ra.status='ACTIVE'
       and ra.revoked_at is null
       and upper(ra.role_key) in ('ADMIN','CLUSTER_ADMIN')
      where s.id=p_scope_id
        and s.scope_type='CLUSTER'
        and s.status='ACTIVE'
    );
$$;
revoke all on function public.buklod_cluster_can_review_home_checkin_v1(uuid) from public, anon;
grant execute on function public.buklod_cluster_can_review_home_checkin_v1(uuid) to authenticated;

create or replace function public.cluster_get_buklod_home_checkin_queue_v1(p_scope_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare result jsonb;
begin
  if (select auth.uid()) is null or
     not public.buklod_cluster_can_review_home_checkin_v1(p_scope_id) then
    raise exception 'Cluster Admin access required' using errcode='42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'event_id', c.event_id,
    'member_id', c.user_id,
    'member_name', p.full_name,
    'status', c.status,
    'checked_in_at', c.checked_in_at,
    'event', e.title,
    'place', e.location,
    'starts_at', e.starts_at,
    'cluster', s.name
  ) order by c.checked_in_at desc), '[]'::jsonb)
  into result
  from (
    select c.*
    from public.buklod_home_event_checkins_r3 c
    where c.scope_id=p_scope_id and c.status='pending'
    order by c.checked_in_at desc limit 100
  ) c
  join public.attendance_events e on e.id=c.event_id and e.scope_id=c.scope_id
  join public.buklod_scopes s on s.id=c.scope_id and s.scope_type='CLUSTER'
  join public.profiles p on p.id=c.user_id;
  return result;
end;
$$;
revoke all on function public.cluster_get_buklod_home_checkin_queue_v1(uuid) from public, anon;
grant execute on function public.cluster_get_buklod_home_checkin_queue_v1(uuid) to authenticated;

create or replace function public.cluster_review_buklod_home_checkin_v1(
  p_checkin_id uuid, p_approve boolean, p_reason text
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  actor uuid := (select auth.uid());
  row_rec record;
  awarded integer := 0;
  awarded_id uuid;
  v_key text;
begin
  if actor is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  if p_checkin_id is null or p_approve is null then
    raise exception 'Check-in and decision are required';
  end if;
  if length(btrim(coalesce(p_reason,''))) < 8 then
    raise exception 'Verification note must contain at least 8 characters';
  end if;

  -- Lock claim before checking the decision. Concurrent approval and retry
  -- cannot result in two reviews or two BP credits.
  select c.*, e.title, e.location, e.starts_at
    into row_rec
    from public.buklod_home_event_checkins_r3 c
    join public.attendance_events e
      on e.id=c.event_id and e.scope_id=c.scope_id
   where c.id=p_checkin_id
   for update of c;
  if not found then
    raise exception 'Check-in unavailable or not authorized' using errcode='42501';
  end if;
  if not public.buklod_cluster_can_review_home_checkin_v1(row_rec.scope_id) then
    raise exception 'Cluster Admin access required' using errcode='42501';
  end if;
  if row_rec.status <> 'pending' then
    raise exception 'Already reviewed';
  end if;
  if p_approve then
    if row_rec.user_id=actor then
      raise exception 'Another Cluster Admin must verify your own check-in';
    end if;
    if btrim(coalesce(row_rec.location,''))='' then
      raise exception 'Event venue is required before attendance reward approval';
    end if;
    if not exists (
      select 1 from public.buklod_scope_memberships m
      where m.scope_id=row_rec.scope_id
        and m.user_id=row_rec.user_id
        and m.membership_status='ACTIVE'
        and m.left_at is null
    ) then
      raise exception 'Member no longer belongs to this Cluster';
    end if;

    select least(r.base_points,coalesce(r.max_points_per_event,10),10)
      into awarded
      from public.buklod_point_rules r
     where r.activity_type='scope_attendance' and r.is_active=true;
    awarded := greatest(coalesce(awarded,0),0);
    if awarded>0 then
      v_key := 'scope_attendance:'||row_rec.event_id::text||':'||row_rec.user_id::text;
      insert into public.buklod_points_ledger
        (user_id,direction,points,activity_type,source_key,source_id,description,awarded_by)
      values (
        row_rec.user_id,'credit',awarded,'scope_attendance',v_key,row_rec.event_id,
        'Cluster Admin-verified attendance: '||row_rec.title||' at '||row_rec.location,actor
      )
      on conflict (user_id,source_key) do nothing
      returning id into awarded_id;
      if awarded_id is null then
        select id into awarded_id
          from public.buklod_points_ledger
         where user_id=row_rec.user_id and source_key=v_key;
      end if;
    end if;
  end if;

  update public.buklod_home_event_checkins_r3
     set status=case when p_approve then 'approved' else 'rejected' end,
         reviewed_at=now(), reviewed_by=actor,
         review_note=btrim(p_reason), ledger_id=awarded_id
   where id=p_checkin_id;

  return jsonb_build_object(
    'status',case when p_approve then 'approved' else 'rejected' end,
    'credited',awarded_id is not null,
    'points',case when awarded_id is not null then awarded else 0 end
  );
end;
$$;
revoke all on function public.cluster_review_buklod_home_checkin_v1(uuid,boolean,text) from public, anon;
grant execute on function public.cluster_review_buklod_home_checkin_v1(uuid,boolean,text) to authenticated;

-- Retire the legacy global queue and approval authority without breaking old
-- Admin Monitor loads. Existing pending claims remain intact for scoped review.
create or replace function public.admin_get_buklod_home_checkin_queue_r3()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
begin
  if (select auth.uid()) is null or not public.is_system_admin() then
    raise exception 'System Admin access required' using errcode='42501';
  end if;
  return '[]'::jsonb;
end;
$$;
revoke all on function public.admin_get_buklod_home_checkin_queue_r3() from public, anon;
grant execute on function public.admin_get_buklod_home_checkin_queue_r3() to authenticated;

create or replace function public.admin_review_buklod_home_checkin_r3(
  p_checkin_id uuid,p_approve boolean,p_reason text
)
returns jsonb language plpgsql security definer set search_path=''
as $$
begin
  raise exception 'Home check-in verification belongs to the exact Cluster Admin'
    using errcode='42501';
end;
$$;
revoke all on function public.admin_review_buklod_home_checkin_r3(uuid,boolean,text) from public, anon;
grant execute on function public.admin_review_buklod_home_checkin_r3(uuid,boolean,text) to authenticated;
