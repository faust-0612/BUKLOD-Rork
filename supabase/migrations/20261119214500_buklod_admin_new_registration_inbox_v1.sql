-- BUKLOD Main: System Admin registration notifications and complete, gated detail views.
-- Notifications contain only a fixed route and opaque user ID. No member PII is
-- stored in push/notification bodies; the live profile is fetched upon opening.
-- This migration is independent of Season 2 and changes no points/reward rules.

create or replace function public.buklod_admin_recent_registrations_v1(
  p_limit integer default 30,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null
)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $fn$
declare v_result jsonb;
begin
  if auth.uid() is null or not public.buklod_is_system_admin() then
    raise exception 'System Admin access required' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc,r.id desc),'[]'::jsonb)
  into v_result
  from (
    select p.id,p.full_name,p.username,p.mobile,p.created_at,
           p.is_verified,p.is_active,p.connection_type,p.login_method,
           c.name as church_name
    from public.profiles p
    left join public.churches c on c.id=p.church_id
    where p_before_created_at is null
       or (p.created_at,p.id) < (p_before_created_at,coalesce(p_before_id,'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))
    order by p.created_at desc,p.id desc
    limit greatest(1,least(coalesce(p_limit,30),50))
  ) r;
  return v_result;
end;
$fn$;

create or replace function public.buklod_admin_registration_detail_v1(p_user_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $fn$
declare v_result jsonb;
begin
  if auth.uid() is null or not public.buklod_is_system_admin() then
    raise exception 'System Admin access required' using errcode = '42501';
  end if;
  if p_user_id is null then
    raise exception 'User ID is required' using errcode = '22023';
  end if;

  select jsonb_build_object(
    'id',p.id,
    'created_at',p.created_at,
    'full_name',p.full_name,
    'first_name',p.first_name,
    'middle_name',p.middle_name,
    'surname',p.surname,
    'suffix',p.suffix,
    'username',p.username,
    'birth_date',p.birth_date,
    'sex',p.sex,
    'mobile',coalesce(nullif(p.mobile,''),nullif(u.phone,'')),
    'email',case when u.email ilike '%@buklod.invalid' then null else u.email end,
    'email_confirmed',u.email_confirmed_at is not null,
    'phone_confirmed',u.phone_confirmed_at is not null,
    'login_method',p.login_method,
    'login_identifier',case
      when p.login_method='email' and p.login_identifier ilike '%@buklod.invalid' then null
      else p.login_identifier end,
    'connection_type',p.connection_type,
    'preferred_language',p.preferred_language,
    'member_verified',p.is_verified,
    'member_verified_at',p.verified_at,
    'is_active',p.is_active,
    'church_name',c.name,
    'address',(
      select jsonb_build_object(
        'address_line',a.address_line,'barangay',a.barangay,
        'city_municipality',a.city_municipality,
        'province',a.province,'country',a.country,
        'postal_code',a.postal_code,'address_completed',a.address_completed)
      from public.buklod_user_addresses a where a.user_id=p.id
    ),
    'membership_request',(
      select jsonb_build_object(
        'status',j.status,'church',jc.name,
        'requested_group',jg.name,'proposed_group',j.proposed_group_name,
        'submitted_at',j.created_at,'reviewed_at',j.reviewed_at)
      from public.church_join_requests j
      left join public.churches jc on jc.id=j.church_id
      left join public.buklod_groups jg on jg.id=j.requested_group_id
      where j.user_id=p.id
      order by j.created_at desc limit 1
    ),
    'groups',(
      select coalesce(jsonb_agg(jsonb_build_object('name',g.name,'joined_at',gm.joined_at)
        order by gm.joined_at desc),'[]'::jsonb)
      from public.group_members gm
      join public.buklod_groups g on g.id=gm.group_id
      where gm.user_id=p.id and gm.is_active=true
    ),
    'scopes',(
      select coalesce(jsonb_agg(jsonb_build_object(
        'name',s.name,'type',s.scope_type,'status',m.membership_status,'joined_at',m.joined_at)
        order by m.created_at desc),'[]'::jsonb)
      from public.buklod_scope_memberships m
      join public.buklod_scopes s on s.id=m.scope_id
      where m.user_id=p.id and m.membership_status='ACTIVE'
    ),
    'roles',(
      select coalesce(jsonb_agg(r.role::text),'[]'::jsonb)
      from public.user_roles r where r.user_id=p.id and r.is_active=true
    )
  )
  into v_result
  from public.profiles p
  left join auth.users u on u.id=p.id
  left join public.churches c on c.id=p.church_id
  where p.id=p_user_id;

  if v_result is null then
    raise exception 'Member profile unavailable' using errcode='P0002';
  end if;
  return v_result;
end;
$fn$;

revoke all on function public.buklod_admin_recent_registrations_v1(integer,timestamptz,uuid) from PUBLIC,anon;
revoke all on function public.buklod_admin_registration_detail_v1(uuid) from PUBLIC,anon;
grant execute on function public.buklod_admin_recent_registrations_v1(integer,timestamptz,uuid) to authenticated;
grant execute on function public.buklod_admin_registration_detail_v1(uuid) to authenticated;

create or replace function private.buklod_notify_admin_new_registration_v1()
returns trigger language plpgsql security definer set search_path = ''
as $fn$
begin
  -- Only an opaque member ID travels with the notification. Full data is
  -- fetched via the separately authorized RPC, not copied into notifications.
  begin
    insert into public.notifications(user_id,title,body,kind,data)
    select distinct ur.user_id,
      'Bagong BUKLOD registration',
      'May bagong member. Buksan ang admin inbox para makita ang registration information.',
      'admin_new_user',
      jsonb_build_object('route','/admin/new-users','user_id',new.id::text,'event','profile_created')
    from public.user_roles ur
    join public.profiles admin_profile on admin_profile.id=ur.user_id
    where ur.role='system_admin' and ur.is_active=true and coalesce(admin_profile.is_active,true)=true;
  exception when others then
    -- An alert outage must not fail or roll back a member's registration.
    raise log 'BUKLOD admin registration notification delivery error (SQLSTATE %)',SQLSTATE;
  end;
  return new;
end;
$fn$;
revoke all on function private.buklod_notify_admin_new_registration_v1() from PUBLIC,anon,authenticated;
drop trigger if exists buklod_notify_admin_new_registration_v1 on public.profiles;
create trigger buklod_notify_admin_new_registration_v1
after insert on public.profiles
for each row execute function private.buklod_notify_admin_new_registration_v1();
