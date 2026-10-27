-- Applied to Supabase as versioned migration 20261027130103_connect_scope_messages_page_keyset_v2.
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

revoke all on function public.buklod_connect_scope_messages_page_v2(uuid, integer, timestamptz, uuid) from public, anon;
grant execute on function public.buklod_connect_scope_messages_page_v2(uuid, integer, timestamptz, uuid) to authenticated;
