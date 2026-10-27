-- REVIEW ONLY: additive Connect history and reader RPCs. No production application here.\n-- Existing scope/read tables, canonical room gate and mark-read are unchanged.\n-- Security: authenticated callers and exact thread/active scope gate only.\n\ncreate or replace function public.buklod_connect_direct_messages_page_v2(
  _thread_id uuid,
  _limit integer default 120,
  _before timestamptz default null,
  _before_id uuid default null
)
returns setof public.buklod_connect_direct_messages
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(_limit, 120), 1), 121);
begin
  if auth.uid() is null then
    raise exception 'Sign in is required';
  end if;

  -- Exact personal-thread participants only. No admin bypass.
  if not exists (
    select 1
    from public.buklod_connect_direct_threads t
    where t.id = _thread_id
      and auth.uid() in (t.user_one, t.user_two)
  ) then
    raise exception 'Personal Connect is not available';
  end if;

  return query
  select m.*
  from public.buklod_connect_direct_messages m
  where m.thread_id = _thread_id
    and (
      _before is null
      or m.created_at < _before
      or (m.created_at = _before and m.id < _before_id)
    )
  order by m.created_at desc, m.id desc
  limit v_limit;
end;
$$;

create or replace function public.buklod_connect_scope_messages_page_v2(
  _scope_id uuid,
  _limit integer default 120,
  _before timestamptz default null,
  _before_id uuid default null
)
returns setof public.buklod_connect_scope_messages
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(_limit, 120), 1), 121);
begin
  if auth.uid() is null then
    raise exception 'Sign in is required';
  end if;

  -- Canonical room gate: active membership and permitted scope type.
  if not public.buklod_connect_can_use_scope_room(_scope_id) then
    raise exception 'This Connect room is not available';
  end if;

  return query
  select m.*
  from public.buklod_connect_scope_messages m
  where m.scope_id = _scope_id
    and (
      _before is null
      or m.created_at < _before
      or (m.created_at = _before and m.id < _before_id)
    )
  order by m.created_at desc, m.id desc
  limit v_limit;
end;
$$;

create or replace function public.buklod_connect_scope_readers_v1(
  _scope_id uuid
)
returns table (
  user_id uuid,
  display_name text,
  avatar_url text,
  last_read_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in is required';
  end if;

  -- Same canonical gate as buklod_connect_mark_scope_read.
  -- Non-members, departed members, unrelated scopes, and disallowed scope
  -- types fail closed inside buklod_connect_can_use_scope_room.
  -- System admin is not an additional bypass.
  if not public.buklod_connect_can_use_scope_room(_scope_id) then
    raise exception 'This Connect room is not available';
  end if;

  return query
  select
    r.user_id,
    coalesce(nullif(p.full_name, ''), nullif(p.username, ''), 'Member') as display_name,
    p.avatar_url,
    r.last_read_at
  from public.buklod_connect_scope_reads r
  join public.buklod_scope_memberships sm
    on sm.scope_id = r.scope_id
   and sm.user_id = r.user_id
   and sm.membership_status = 'ACTIVE'
  left join public.profiles p
    on p.id = r.user_id
  where r.scope_id = _scope_id
    and r.user_id <> auth.uid()
  order by r.last_read_at desc
  limit 200;
end;
$$;

revoke all on function public.buklod_connect_direct_messages_page_v2(uuid, integer, timestamptz, uuid) from public, anon;
revoke all on function public.buklod_connect_scope_messages_page_v2(uuid, integer, timestamptz, uuid) from public, anon;
revoke all on function public.buklod_connect_scope_readers_v1(uuid) from public, anon;

grant execute on function public.buklod_connect_direct_messages_page_v2(uuid, integer, timestamptz, uuid) to authenticated;
grant execute on function public.buklod_connect_scope_messages_page_v2(uuid, integer, timestamptz, uuid) to authenticated;
grant execute on function public.buklod_connect_scope_readers_v1(uuid) to authenticated;
