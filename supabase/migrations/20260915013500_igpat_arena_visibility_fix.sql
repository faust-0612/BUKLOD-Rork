-- BUKLOD IGPAT Arena visibility correction.
-- Participants always retain access to their own challenge. Outside Arena viewers
-- may see/vote on ACTIVE or COMPLETED two-person matches only after both verified
-- submissions exist and every submitted IGPAT remains visible to the viewer.

create or replace function public.can_view_igpat_arena_challenge_v2(
  p_challenge_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  row_data public.igpat_arena_challenges%rowtype;
  verified_count integer := 0;
begin
  if actor is null then
    return false;
  end if;

  select * into row_data
  from public.igpat_arena_challenges c
  where c.id = p_challenge_id;

  if row_data.id is null then
    return false;
  end if;

  if row_data.creator_user_id = actor or row_data.opponent_user_id = actor then
    return true;
  end if;

  if row_data.post_id is not null
     and not public.can_view_community_post_v2(row_data.post_id) then
    return false;
  end if;

  if row_data.status = 'OPEN' and row_data.opponent_user_id is null then
    return true;
  end if;

  if row_data.status in ('ACTIVE','COMPLETED') then
    select count(*)::integer into verified_count
    from public.igpat_arena_results r
    where r.challenge_id = p_challenge_id
      and r.verified = true;

    if row_data.opponent_user_id is not null and verified_count < 2 then
      return false;
    end if;

    if exists (
      select 1
      from public.igpat_arena_results r
      where r.challenge_id = p_challenge_id
        and r.verified = true
        and r.post_id is not null
        and not public.can_view_community_post_v2(r.post_id)
    ) then
      return false;
    end if;

    return verified_count > 0;
  end if;

  return false;
end;
$$;

create or replace function public.get_buklod_igpat_arena_rankings_v1(
  p_limit integer default 50
)
returns table(
  user_id uuid,
  display_name text,
  completed_entries integer,
  wins integer,
  respect_received integer,
  arena_score integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  safe_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  return query
  with entries as (
    select
      r.submitted_by as user_id,
      count(*)::integer as completed_entries,
      count(*) filter (where c.winner_user_id = r.submitted_by)::integer as wins,
      coalesce(sum(r.respect_received), 0)::integer as respect_received
    from public.igpat_arena_results r
    join public.igpat_arena_challenges c on c.id = r.challenge_id
    where r.verified = true
      and c.status = 'COMPLETED'
      and public.can_view_igpat_arena_challenge_v2(c.id)
      and (r.post_id is null or public.can_view_community_post_v2(r.post_id))
    group by r.submitted_by
  )
  select
    e.user_id,
    coalesce(p.full_name, p.first_name, p.username, 'BUKLOD Member')::text,
    e.completed_entries,
    e.wins,
    e.respect_received,
    (e.wins * 10 + e.respect_received + e.completed_entries)::integer as arena_score
  from entries e
  join public.profiles p on p.id = e.user_id
  order by (e.wins * 10 + e.respect_received + e.completed_entries) desc,
           e.respect_received desc,
           e.completed_entries desc,
           e.user_id asc
  limit safe_limit;
end;
$$;

revoke all on function public.can_view_igpat_arena_challenge_v2(uuid) from public;
revoke all on function public.can_view_igpat_arena_challenge_v2(uuid) from anon;
grant execute on function public.can_view_igpat_arena_challenge_v2(uuid) to authenticated;
grant execute on function public.can_view_igpat_arena_challenge_v2(uuid) to service_role;

revoke all on function public.get_buklod_igpat_arena_rankings_v1(integer) from public;
revoke all on function public.get_buklod_igpat_arena_rankings_v1(integer) from anon;
grant execute on function public.get_buklod_igpat_arena_rankings_v1(integer) to authenticated;
grant execute on function public.get_buklod_igpat_arena_rankings_v1(integer) to service_role;
