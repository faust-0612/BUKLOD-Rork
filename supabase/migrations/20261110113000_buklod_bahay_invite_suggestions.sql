-- BUKLOD Bahay: safe invite-by-ID, private bounded suggestions, pending status.
-- This migration is paired with the client changes; deploy before the client OTA.

create or replace function public.buklod_home_invite_user_v2(
  p_home_id uuid, p_user_id uuid, p_role text default 'ADULT',
  p_expires_at timestamptz default null
)
returns table(user_id uuid, full_name text, username text)
language plpgsql security definer set search_path = ''
as $$
declare
  v_target public.profiles%rowtype;
  v_role text;
  v_saved uuid;
  v_status text;
  v_expiry timestamptz;
begin
  if (select auth.uid()) is null or not public.buklod_home_is_admin(p_home_id) then
    raise exception 'Home admin access required';
  end if;
  if p_user_id is null or p_user_id = (select auth.uid()) then
    raise exception 'Select another BUKLOD member';
  end if;

  select p.* into v_target
  from public.profiles p
  where p.id = p_user_id
    and p.is_active is distinct from false
    and p.user_deactivated_at is null;
  if v_target.id is null then
    raise exception 'BUKLOD member is not available';
  end if;

  v_role := upper(btrim(coalesce(p_role, 'ADULT')));
  if v_role not in ('ADMIN','ADULT','TEEN','CHILD','HELPER','GUEST') then
    raise exception 'Invalid Kasambahay role';
  end if;
  v_expiry := case
    when v_role = 'GUEST' then coalesce(p_expires_at, now() + interval '7 days')
    else p_expires_at
  end;
  if v_expiry is not null and v_expiry <= now() then
    raise exception 'Invitation expiry must be in the future';
  end if;

  -- Conflicting ACTIVE/PENDING rows are never reset. Concurrent invites are safe.
  insert into public.buklod_home_members(
    home_id, user_id, role, status, invited_by, expires_at
  )
  values(p_home_id, v_target.id, v_role, 'PENDING', (select auth.uid()), v_expiry)
  on conflict on constraint buklod_home_members_pkey do update
    set role = excluded.role,
        status = 'PENDING',
        invited_by = excluded.invited_by,
        expires_at = excluded.expires_at,
        joined_at = null
    where public.buklod_home_members.status in ('DECLINED', 'REMOVED')
       or (public.buklod_home_members.expires_at is not null
           and public.buklod_home_members.expires_at <= now())
  returning public.buklod_home_members.user_id into v_saved;

  if v_saved is null then
    select m.status into v_status
    from public.buklod_home_members m
    where m.home_id = p_home_id and m.user_id = v_target.id;
    if v_status = 'ACTIVE' then
      raise exception 'This user is already a Kasambahay';
    elsif v_status = 'PENDING' then
      raise exception 'Invitation is already pending';
    end if;
    raise exception 'Could not create invitation';
  end if;

  insert into public.notifications(user_id, title, body, kind, data)
  select
    v_target.id, 'Imbitasyon sa Bahay',
    h.name || ' invited you as Kasambahay.',
    'buklod_home_invite',
    jsonb_build_object('route', '/personal-home', 'home_id', p_home_id)
  from public.buklod_homes h where h.id = p_home_id;

  return query select v_target.id, v_target.full_name, v_target.username;
end $$;

-- Retain legacy clients, but delegate to the new idempotent/guarded workflow.
create or replace function public.buklod_home_invite_v1(
  p_home_id uuid, p_identifier text, p_role text default 'ADULT',
  p_expires_at timestamptz default null
)
returns table(user_id uuid, full_name text, username text)
language plpgsql security definer set search_path = ''
as $$
declare
  v_target public.profiles%rowtype;
  v_identifier text;
begin
  if (select auth.uid()) is null or not public.buklod_home_is_admin(p_home_id) then
    raise exception 'Home admin access required';
  end if;
  v_identifier := lower(regexp_replace(btrim(coalesce(p_identifier, '')), '^@', ''));
  if v_identifier = '' then
    raise exception 'Username or login identifier is required';
  end if;
  select p.* into v_target
    from public.profiles p
    where lower(coalesce(p.username, '')) = v_identifier
       or lower(coalesce(p.login_identifier, '')) = v_identifier
    order by case when lower(coalesce(p.username, '')) = v_identifier then 0 else 1 end
    limit 1;
  if v_target.id is null then
    raise exception 'BUKLOD user not found';
  end if;
  return query
    select i.user_id, i.full_name, i.username
    from public.buklod_home_invite_user_v2(p_home_id, v_target.id, p_role, p_expires_at) i;
end $$;

-- Expired guest invites cannot be accepted. A fresh invite is required.
create or replace function public.buklod_home_invite_decide_v1(p_home_id uuid,p_accept boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.buklod_home_members
     set status = case when p_accept then 'ACTIVE' else 'DECLINED' end,
         joined_at = case when p_accept then now() else joined_at end
   where home_id = p_home_id
     and user_id = (select auth.uid())
     and status = 'PENDING'
     and (expires_at is null or expires_at > now());
  if not found then raise exception 'Invitation expired or no longer pending'; end if;
end $$;

-- Empty query: only genuine shared-scope/chat contacts. Typed query: bounded
-- search on display name or username (no email, phone, or login identifiers).
create or replace function public.buklod_home_search_invitees_v1(
  p_home_id uuid, p_query text default '', p_limit integer default 12
)
returns table(
  user_id uuid, full_name text, username text, avatar_url text, source_label text
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_query text := lower(btrim(regexp_replace(btrim(coalesce(p_query,'')), '^@', '')));
  v_limit integer := least(greatest(coalesce(p_limit,12),1),16);
begin
  if (select auth.uid()) is null or not public.buklod_home_is_admin(p_home_id) then
    raise exception 'Home admin access required';
  end if;
  if char_length(v_query) > 80 then
    raise exception 'Search is too long';
  end if;
  if char_length(v_query) = 1 then
    return;
  end if;

  return query
  with connections as (
    select c.user_id, min(c.shared_scope_label) as shared_scope_label
    from public.buklod_connect_suggested_contacts_v1(80) c
    group by c.user_id
  )
  select
    p.id,
    coalesce(nullif(btrim(p.full_name),''),nullif(btrim(p.username),''),'BUKLOD member')::text,
    nullif(btrim(p.username),'')::text,
    p.avatar_url::text,
    coalesce(nullif(btrim(c.shared_scope_label),''),'BUKLOD member')::text
  from public.profiles p
  left join connections c on c.user_id = p.id
  left join public.buklod_home_members m
    on m.home_id = p_home_id and m.user_id = p.id
  where p.id <> (select auth.uid())
    and p.is_active is distinct from false
    and p.user_deactivated_at is null
    and (m.user_id is null or m.status not in ('ACTIVE','PENDING')
         or (m.expires_at is not null and m.expires_at <= now()))
    and (
      (v_query = '' and c.user_id is not null)
      or (v_query <> '' and (
        left(lower(coalesce(p.username,'')),char_length(v_query)) = v_query
        or strpos(lower(coalesce(p.full_name,'')),v_query) > 0
      ))
    )
  order by
    case
      when v_query = '' then 0
      when lower(coalesce(p.username,'')) = v_query then 0
      when left(lower(coalesce(p.username,'')),char_length(v_query)) = v_query then 1
      else 2
    end,
    (c.user_id is null),
    p.full_name nulls last,
    p.id
  limit v_limit;
end $$;

create or replace function public.buklod_home_pending_invites_v1(p_home_id uuid)
returns table(user_id uuid, full_name text, username text, role text, invited_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not public.buklod_home_is_admin(p_home_id) then
    raise exception 'Home admin access required';
  end if;
  return query
    select m.user_id,
      coalesce(nullif(btrim(p.full_name),''),nullif(btrim(p.username),''),'BUKLOD member')::text,
      p.username::text,
      m.role::text, m.created_at
    from public.buklod_home_members m
    join public.profiles p on p.id = m.user_id
    where m.home_id = p_home_id and m.status = 'PENDING'
      and (m.expires_at is null or m.expires_at > now())
    order by m.created_at desc limit 100;
end $$;

revoke all on function public.buklod_home_invite_user_v2(uuid,uuid,text,timestamptz) from public, anon;
revoke all on function public.buklod_home_invite_v1(uuid,text,text,timestamptz) from public, anon;
revoke all on function public.buklod_home_invite_decide_v1(uuid,boolean) from public, anon;
revoke all on function public.buklod_home_search_invitees_v1(uuid,text,integer) from public, anon;
revoke all on function public.buklod_home_pending_invites_v1(uuid) from public, anon;
grant execute on function public.buklod_home_invite_user_v2(uuid,uuid,text,timestamptz) to authenticated;
grant execute on function public.buklod_home_invite_v1(uuid,text,text,timestamptz) to authenticated;
grant execute on function public.buklod_home_invite_decide_v1(uuid,boolean) to authenticated;
grant execute on function public.buklod_home_search_invitees_v1(uuid,text,integer) to authenticated;
grant execute on function public.buklod_home_pending_invites_v1(uuid) to authenticated;
