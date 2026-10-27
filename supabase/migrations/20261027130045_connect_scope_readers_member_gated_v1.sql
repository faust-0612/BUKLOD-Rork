-- Applied to Supabase as versioned migration 20261027130045_connect_scope_readers_member_gated_v1.
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

revoke all on function public.buklod_connect_scope_readers_v1(uuid) from public, anon;
grant execute on function public.buklod_connect_scope_readers_v1(uuid) to authenticated;
