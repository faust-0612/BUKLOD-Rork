
-- Additive, account-scoped reactions for the 24-hour public Connect/Wall status Note.
-- No point/QMP rewards and no access to private Smart Drawer notes.
create table if not exists public.buklod_connect_note_reactions (
  owner_id uuid not null references auth.users(id) on delete cascade,
  reactor_id uuid not null references auth.users(id) on delete cascade,
  note_revision timestamptz not null,
  reaction text not null check (reaction in ('amen','with_you','praying','love','haha','sad','care')),
  updated_at timestamptz not null default now(),
  primary key (owner_id, reactor_id),
  constraint buklod_note_react_distinct_users check (owner_id <> reactor_id)
);
create index if not exists buklod_connect_note_reactions_count_idx
  on public.buklod_connect_note_reactions(owner_id, note_revision);
alter table public.buklod_connect_note_reactions enable row level security;
-- No direct Data API writes or reads; only the validated RPC functions below.
revoke all on public.buklod_connect_note_reactions from public, anon, authenticated;

create or replace function public.get_buklod_connect_note_reactions_v1(p_owner_ids uuid[])
returns table(owner_id uuid, total_reactions bigint, my_reaction text)
language plpgsql stable security definer set search_path = ''
as $$
declare v_actor uuid := (select auth.uid());
begin
  if v_actor is null or p_owner_ids is null or cardinality(p_owner_ids) > 80 then
    return;
  end if;
  return query
    select s.user_id, coalesce(r.total, 0)::bigint, r.mine
    from public.buklod_profile_status s
    left join lateral (
      select count(*)::bigint as total,
        max(x.reaction) filter (where x.reactor_id = v_actor) as mine
      from public.buklod_connect_note_reactions x
      where x.owner_id = s.user_id
        and x.note_revision = coalesce(s.quick_note_expires_at, s.updated_at)
    ) r on true
    where s.user_id = any(p_owner_ids)
      and nullif(btrim(s.quick_note), '') is not null
      and (s.quick_note_expires_at is null or s.quick_note_expires_at > now());
end;$$;

create or replace function public.set_buklod_connect_note_reaction_v1(
  p_owner_id uuid, p_reaction text
) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_revision timestamptz;
  v_old text;
  v_old_revision timestamptz;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if p_owner_id is null or p_owner_id = v_actor then
    raise exception 'Cannot react to this note';
  end if;
  if p_reaction is null or p_reaction not in ('amen','with_you','praying','love','haha','sad','care') then
    raise exception 'Invalid reaction';
  end if;

  select coalesce(s.quick_note_expires_at, s.updated_at) into v_revision
  from public.buklod_profile_status s
  where s.user_id = p_owner_id
    and nullif(btrim(s.quick_note), '') is not null
    and (s.quick_note_expires_at is null or s.quick_note_expires_at > now())
  for share;
  if v_revision is null then raise exception 'Note no longer available'; end if;

  -- Serialize the same viewer/author pair, including first-time reactions.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_actor::text || ':' || p_owner_id::text, 0)
  );
  select reaction, note_revision into v_old, v_old_revision
  from public.buklod_connect_note_reactions
  where owner_id = p_owner_id and reactor_id = v_actor;

  if v_old = p_reaction and v_old_revision = v_revision then
    delete from public.buklod_connect_note_reactions
    where owner_id = p_owner_id and reactor_id = v_actor;
    return null;
  end if;

  insert into public.buklod_connect_note_reactions
    (owner_id, reactor_id, note_revision, reaction, updated_at)
  values (p_owner_id, v_actor, v_revision, p_reaction, now())
  on conflict (owner_id, reactor_id) do update
    set note_revision = excluded.note_revision,
        reaction = excluded.reaction,
        updated_at = excluded.updated_at;
  return p_reaction;
end;$$;

revoke all on function public.get_buklod_connect_note_reactions_v1(uuid[]) from public, anon;
revoke all on function public.set_buklod_connect_note_reaction_v1(uuid, text) from public, anon;
grant execute on function public.get_buklod_connect_note_reactions_v1(uuid[]) to authenticated;
grant execute on function public.set_buklod_connect_note_reaction_v1(uuid, text) to authenticated;
