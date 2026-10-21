-- REVIEW ONLY. Do not apply this file to production from the Connect chat UX change.
-- It is intentionally outside supabase/migrations so release tooling will not run it.
-- Apply only in a later, separately approved database release.
--
-- What this adds, without replacing live RPCs:
-- 1. Newest-page + keyset history functions for direct and scope Connect.
-- 2. A scope read-cursor table and reader list so group Seen avatars can be
--    real membership-scoped data. mark_scope_read alone does not expose readers.
--
-- Security:
-- * SECURITY DEFINER with an explicit caller check.
-- * Direct history is limited to the two people on that thread.
-- * Scope history and read cursors are limited to active members of THAT scope
--   (or a system admin). No cross-organization or cross-cluster rows are returned.
-- * Clients must ignore missing functions and must not show optimistic Seen.

create table if not exists public.buklod_connect_scope_reads (
  scope_id uuid not null references public.buklod_scopes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (scope_id, user_id)
);

alter table public.buklod_connect_scope_reads enable row level security;

drop policy if exists buklod_connect_scope_reads_select_member
  on public.buklod_connect_scope_reads;
create policy buklod_connect_scope_reads_select_member
  on public.buklod_connect_scope_reads
  for select
  to authenticated
  using (
    public.buklod_is_system_admin()
    or exists (
      select 1
      from public.buklod_scope_memberships sm
      where sm.scope_id = buklod_connect_scope_reads.scope_id
        and sm.user_id = (select auth.uid())
        and sm.membership_status = 'ACTIVE'
    )
  );

drop policy if exists buklod_connect_scope_reads_write_own
  on public.buklod_connect_scope_reads;
create policy buklod_connect_scope_reads_write_own
  on public.buklod_connect_scope_reads
  for all
  to authenticated
  using (
    user_id = (select auth.uid())
    and (
      public.buklod_is_system_admin()
      or exists (
        select 1
        from public.buklod_scope_memberships sm
        where sm.scope_id = buklod_connect_scope_reads.scope_id
          and sm.user_id = (select auth.uid())
          and sm.membership_status = 'ACTIVE'
      )
    )
  )
  with check (
    user_id = (select auth.uid())
    and (
      public.buklod_is_system_admin()
      or exists (
        select 1
        from public.buklod_scope_memberships sm
        where sm.scope_id = buklod_connect_scope_reads.scope_id
          and sm.user_id = (select auth.uid())
          and sm.membership_status = 'ACTIVE'
      )
    )
  );

create index if not exists buklod_connect_scope_reads_scope_idx
  on public.buklod_connect_scope_reads (scope_id, last_read_at desc);

create or replace function public.buklod_connect_direct_messages_page_v2(
  _thread_id uuid,
  _limit integer default 120,
  _before timestamptz default null,
  _before_id uuid default null
)
returns setof public.buklod_connect_direct_messages
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit integer := least(greatest(coalesce(_limit, 120), 1), 121);
begin
  if auth.uid() is null then
    raise exception 'Sign in is required';
  end if;

  if not exists (
    select 1
    from public.buklod_connect_direct_threads t
    where t.id = _thread_id
      and (
        t.user_one = auth.uid()
        or t.user_two = auth.uid()
        or public.buklod_is_system_admin()
      )
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
set search_path = public
as $$
declare
  v_limit integer := least(greatest(coalesce(_limit, 120), 1), 121);
begin
  if auth.uid() is null then
    raise exception 'Sign in is required';
  end if;

  if not (
    public.buklod_is_system_admin()
    or exists (
      select 1
      from public.buklod_scope_memberships sm
      where sm.scope_id = _scope_id
        and sm.user_id = auth.uid()
        and sm.membership_status = 'ACTIVE'
    )
  ) then
    raise exception 'Active membership in this Connect room is required';
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

create or replace function public.buklod_connect_mark_scope_read_v2(
  _scope_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in is required';
  end if;

  if not (
    public.buklod_is_system_admin()
    or exists (
      select 1
      from public.buklod_scope_memberships sm
      where sm.scope_id = _scope_id
        and sm.user_id = auth.uid()
        and sm.membership_status = 'ACTIVE'
    )
  ) then
    raise exception 'Active membership in this Connect room is required';
  end if;

  insert into public.buklod_connect_scope_reads (
    scope_id,
    user_id,
    last_read_at
  )
  values (
    _scope_id,
    auth.uid(),
    now()
  )
  on conflict (scope_id, user_id)
  do update set last_read_at = excluded.last_read_at;
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
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in is required';
  end if;

  if not (
    public.buklod_is_system_admin()
    or exists (
      select 1
      from public.buklod_scope_memberships sm
      where sm.scope_id = _scope_id
        and sm.user_id = auth.uid()
        and sm.membership_status = 'ACTIVE'
    )
  ) then
    raise exception 'Active membership in this Connect room is required';
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
revoke all on function public.buklod_connect_mark_scope_read_v2(uuid) from public, anon;
revoke all on function public.buklod_connect_scope_readers_v1(uuid) from public, anon;

grant execute on function public.buklod_connect_direct_messages_page_v2(uuid, integer, timestamptz, uuid) to authenticated;
grant execute on function public.buklod_connect_scope_messages_page_v2(uuid, integer, timestamptz, uuid) to authenticated;
grant execute on function public.buklod_connect_mark_scope_read_v2(uuid) to authenticated;
grant execute on function public.buklod_connect_scope_readers_v1(uuid) to authenticated;
