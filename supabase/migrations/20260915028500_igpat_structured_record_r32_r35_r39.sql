-- BUKLOD IGPAT R32/R35/R39 — one private structured competition record.
-- Includes completed individual Arena matches, completed Squad matches using the
-- match-start roster snapshot, and completed Last Man Standing events.
-- Normal social IGPATs never receive W/L records.

create or replace function public.get_my_buklod_igpat_arena_record_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  row_data record;
  wins integer := 0;
  losses integer := 0;
  draws integer := 0;
  current_streak integer := 0;
  best_streak integer := 0;
  running_streak integer := 0;
  current_open boolean := true;
  total integer := 0;
  individual_completed integer := 0;
  squad_completed integer := 0;
  elimination_completed integer := 0;
begin
  if actor is null then raise exception 'Authentication required'; end if;

  select count(*)::integer into individual_completed
  from public.igpat_arena_challenges c
  where c.status='COMPLETED' and (c.creator_user_id=actor or c.opponent_user_id=actor);

  select count(*)::integer into squad_completed
  from public.igpat_arena_squad_match_members mm
  join public.igpat_arena_squad_matches sm on sm.id=mm.match_id
  where mm.user_id=actor and sm.status='COMPLETED';

  select count(*)::integer into elimination_completed
  from public.igpat_arena_lms_participants p
  join public.igpat_arena_lms_events e on e.id=p.event_id
  where p.user_id=actor and e.status='COMPLETED' and p.status in ('ELIMINATED','CHAMPION');

  for row_data in
    with outcomes as (
      select c.completed_at as completed_at,c.id::text as stable_id,
        case when c.winner_user_id=actor then 'W' when c.winner_user_id is null then 'D' else 'L' end outcome
      from public.igpat_arena_challenges c
      where c.status='COMPLETED' and (c.creator_user_id=actor or c.opponent_user_id=actor)

      union all

      select sm.completed_at,sm.id::text,
        case when sm.winner_squad_id=mm.squad_id then 'W' when sm.winner_squad_id is null then 'D' else 'L' end
      from public.igpat_arena_squad_match_members mm
      join public.igpat_arena_squad_matches sm on sm.id=mm.match_id
      where mm.user_id=actor and sm.status='COMPLETED'

      union all

      select e.completed_at,e.id::text,
        case when e.champion_user_id=actor then 'W' else 'L' end
      from public.igpat_arena_lms_participants p
      join public.igpat_arena_lms_events e on e.id=p.event_id
      where p.user_id=actor and e.status='COMPLETED' and p.status in ('ELIMINATED','CHAMPION')
    )
    select * from outcomes order by completed_at desc nulls last,stable_id desc
  loop
    total := total + 1;
    if row_data.outcome='W' then
      wins := wins + 1;
      running_streak := running_streak + 1;
      best_streak := greatest(best_streak,running_streak);
      if current_open then current_streak := current_streak + 1; end if;
    elsif row_data.outcome='L' then
      losses := losses + 1;
      running_streak := 0;
      current_open := false;
    else
      draws := draws + 1;
      running_streak := 0;
      current_open := false;
    end if;
  end loop;

  return jsonb_build_object(
    'wins',wins,
    'losses',losses,
    'draws',draws,
    'completed',total,
    'win_rate',case when wins+losses=0 then 0 else round((wins::numeric*100)/(wins+losses),1) end,
    'current_win_streak',current_streak,
    'best_win_streak',best_streak,
    'individual_completed',individual_completed,
    'squad_completed',squad_completed,
    'elimination_completed',elimination_completed
  );
end;
$$;

revoke all on function public.get_my_buklod_igpat_arena_record_v1() from public,anon;
grant execute on function public.get_my_buklod_igpat_arena_record_v1() to authenticated,service_role;
