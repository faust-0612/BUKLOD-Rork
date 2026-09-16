-- BUKLOD IGPAT R36
-- Boss Challenge is a Cluster community objective. No wagering, no paid mechanics.
-- One verified contribution per member prevents volume farming.

create table if not exists public.igpat_boss_challenges (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.buklod_groups(id) on delete cascade,
  creator_user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 3 and 160),
  target_count integer not null check (target_count between 2 and 1000),
  status text not null default 'OPEN' check (status in ('OPEN','COMPLETED','CANCELLED')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.igpat_boss_contributions (
  boss_id uuid not null references public.igpat_boss_challenges(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.community_posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (boss_id, user_id),
  unique (boss_id, post_id)
);

alter table public.igpat_boss_challenges enable row level security;
alter table public.igpat_boss_contributions enable row level security;
revoke all on table public.igpat_boss_challenges from public;
revoke all on table public.igpat_boss_challenges from anon;
revoke all on table public.igpat_boss_challenges from authenticated;
revoke all on table public.igpat_boss_contributions from public;
revoke all on table public.igpat_boss_contributions from anon;
revoke all on table public.igpat_boss_contributions from authenticated;
grant all on table public.igpat_boss_challenges to service_role;
grant all on table public.igpat_boss_contributions to service_role;

create or replace function public.get_my_buklod_igpat_boss_groups_v1()
returns table(
  group_id uuid,
  group_name text,
  is_leader boolean,
  active_member_count integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  return query
  select
    g.id,
    g.name::text,
    g.leader_id = actor,
    (
      select count(*)::integer
      from public.group_members gm2
      where gm2.group_id = g.id
        and gm2.is_active = true
    )
  from public.group_members gm
  join public.buklod_groups g on g.id = gm.group_id
  where gm.user_id = actor
    and gm.is_active = true
    and g.is_active = true
  order by lower(g.name), g.id;
end;
$$;

create or replace function public.igpat_create_boss_challenge_v1(
  p_group_id uuid,
  p_title text,
  p_target_count integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  member_count integer := 0;
  new_id uuid;
  safe_title text := trim(coalesce(p_title, ''));
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.buklod_groups g
    where g.id = p_group_id
      and g.is_active = true
      and g.leader_id = actor
  ) then
    raise exception 'Only the active Cluster leader can create a Boss Challenge';
  end if;

  if exists (
    select 1
    from public.igpat_boss_challenges b
    where b.group_id = p_group_id
      and b.status = 'OPEN'
  ) then
    raise exception 'This Cluster already has an open Boss Challenge';
  end if;

  select count(*)::integer into member_count
  from public.group_members gm
  where gm.group_id = p_group_id
    and gm.is_active = true;

  if p_target_count is null or p_target_count < 2 or p_target_count > member_count then
    raise exception 'Boss target must be between 2 and the current active Cluster member count';
  end if;

  if char_length(safe_title) < 3 or char_length(safe_title) > 160 then
    raise exception 'Boss Challenge title must be 3 to 160 characters';
  end if;

  insert into public.igpat_boss_challenges(group_id, creator_user_id, title, target_count)
  values(p_group_id, actor, safe_title, p_target_count)
  returning id into new_id;

  return new_id;
end;
$$;

create or replace function public.get_my_buklod_igpat_boss_challenges_v1(
  p_limit integer default 30
)
returns table(
  id uuid,
  group_id uuid,
  group_name text,
  title text,
  target_count integer,
  completion_count integer,
  status text,
  is_leader boolean,
  has_contributed boolean,
  created_at timestamptz,
  completed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  safe_limit integer := least(greatest(coalesce(p_limit, 30), 1), 100);
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  return query
  select
    b.id,
    b.group_id,
    g.name::text,
    b.title,
    b.target_count,
    (
      select count(*)::integer
      from public.igpat_boss_contributions c
      where c.boss_id = b.id
    ),
    b.status,
    g.leader_id = actor,
    exists (
      select 1
      from public.igpat_boss_contributions c
      where c.boss_id = b.id
        and c.user_id = actor
    ),
    b.created_at,
    b.completed_at
  from public.igpat_boss_challenges b
  join public.buklod_groups g on g.id = b.group_id
  where exists (
    select 1
    from public.group_members gm
    where gm.group_id = b.group_id
      and gm.user_id = actor
      and gm.is_active = true
  )
  order by case when b.status = 'OPEN' then 0 else 1 end,
           b.created_at desc,
           b.id desc
  limit safe_limit;
end;
$$;

create or replace function public.igpat_submit_boss_contribution_v1(
  p_boss_id uuid,
  p_post_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  boss public.igpat_boss_challenges%rowtype;
  current_count integer := 0;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  select * into boss
  from public.igpat_boss_challenges b
  where b.id = p_boss_id
    and b.status = 'OPEN'
  for update;

  if boss.id is null then
    raise exception 'Boss Challenge is not open';
  end if;

  if not exists (
    select 1
    from public.group_members gm
    where gm.group_id = boss.group_id
      and gm.user_id = actor
      and gm.is_active = true
  ) then
    raise exception 'Only active Cluster members can contribute';
  end if;

  if not exists (
    select 1
    from public.community_posts cp
    where cp.id = p_post_id
      and cp.user_id = actor
      and cp.is_reel = true
      and cp.is_hidden = false
      and cp.deleted_at is null
      and cp.media_mime_type like 'video/%'
      and public.can_view_community_post_v2(cp.id)
  ) then
    raise exception 'Boss contribution must be your own visible IGPAT';
  end if;

  insert into public.igpat_boss_contributions(boss_id, user_id, post_id)
  values(p_boss_id, actor, p_post_id)
  on conflict(boss_id, user_id) do update
    set post_id = excluded.post_id,
        created_at = now();

  select count(*)::integer into current_count
  from public.igpat_boss_contributions c
  where c.boss_id = p_boss_id;

  if current_count >= boss.target_count then
    update public.igpat_boss_challenges
    set status = 'COMPLETED', completed_at = now()
    where id = p_boss_id
      and status = 'OPEN';
  end if;

  return jsonb_build_object(
    'completion_count', current_count,
    'target_count', boss.target_count,
    'completed', current_count >= boss.target_count
  );
end;
$$;

create or replace function public.igpat_cancel_boss_challenge_v1(
  p_boss_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  update public.igpat_boss_challenges b
  set status = 'CANCELLED'
  where b.id = p_boss_id
    and b.status = 'OPEN'
    and exists (
      select 1 from public.buklod_groups g
      where g.id = b.group_id and g.leader_id = actor
    );

  if not found then
    raise exception 'Only the Cluster leader can cancel an open Boss Challenge';
  end if;
end;
$$;

revoke all on function public.get_my_buklod_igpat_boss_groups_v1() from public;
revoke all on function public.get_my_buklod_igpat_boss_groups_v1() from anon;
grant execute on function public.get_my_buklod_igpat_boss_groups_v1() to authenticated;
grant execute on function public.get_my_buklod_igpat_boss_groups_v1() to service_role;

revoke all on function public.igpat_create_boss_challenge_v1(uuid,text,integer) from public;
revoke all on function public.igpat_create_boss_challenge_v1(uuid,text,integer) from anon;
grant execute on function public.igpat_create_boss_challenge_v1(uuid,text,integer) to authenticated;
grant execute on function public.igpat_create_boss_challenge_v1(uuid,text,integer) to service_role;

revoke all on function public.get_my_buklod_igpat_boss_challenges_v1(integer) from public;
revoke all on function public.get_my_buklod_igpat_boss_challenges_v1(integer) from anon;
grant execute on function public.get_my_buklod_igpat_boss_challenges_v1(integer) to authenticated;
grant execute on function public.get_my_buklod_igpat_boss_challenges_v1(integer) to service_role;

revoke all on function public.igpat_submit_boss_contribution_v1(uuid,uuid) from public;
revoke all on function public.igpat_submit_boss_contribution_v1(uuid,uuid) from anon;
grant execute on function public.igpat_submit_boss_contribution_v1(uuid,uuid) to authenticated;
grant execute on function public.igpat_submit_boss_contribution_v1(uuid,uuid) to service_role;

revoke all on function public.igpat_cancel_boss_challenge_v1(uuid) from public;
revoke all on function public.igpat_cancel_boss_challenge_v1(uuid) from anon;
grant execute on function public.igpat_cancel_boss_challenge_v1(uuid) to authenticated;
grant execute on function public.igpat_cancel_boss_challenge_v1(uuid) to service_role;
