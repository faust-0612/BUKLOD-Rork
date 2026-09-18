-- BUKLOD KINGDOM LEVEL DETAILS V1
-- Read-only per-level mastery details for Training Grounds and progression UI.

create or replace function public.get_my_buklod_kingdom_level_details_v1(
  p_game_id text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_game text := nullif(lower(btrim(coalesce(p_game_id,''))), '');
  v_state jsonb;
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if v_game is not null and not exists (
    select 1
    from (values
      ('phan-enterprise-builder'),('vhen-farm-to-market'),('jawo-forest-trail'),
      ('trudice-playground-memory'),('mitch-restore-mural'),('christian-civic-leadership'),
      ('ace-rescue-grid'),('van-living-city-dispatch'),('lhen-rhythm-journey'),
      ('angel-kingdom-treasury'),('niel-mission-trail'),('elesur-village-builder'),
      ('quin-discovery-expedition')
    ) g(game_id)
    where g.game_id = v_game
  ) then
    raise exception 'Unsupported BUKLOD Kingdom game';
  end if;

  v_state := public.get_my_buklod_kingdom_v1();

  with station_rows as (
    select value as station
    from jsonb_array_elements(v_state->'stations')
    where v_game is null or value->>'game_id' = v_game
  ),
  expanded as (
    select
      s.station->>'game_id' as game_id,
      gs.level_no,
      (s.station->>'unlocked')::boolean as region_unlocked,
      (s.station->>'current_level')::integer as current_level,
      (s.station->>'cleared_levels')::integer as cleared_levels,
      p.attempts,
      p.wins,
      p.best_score,
      p.best_stars,
      p.first_cleared_at,
      p.last_status,
      p.last_played_at
    from station_rows s
    cross join lateral generate_series(1,20) gs(level_no)
    left join private.buklod_kingdom_level_progress_v1 p
      on p.user_id = v_uid
     and p.game_id = s.station->>'game_id'
     and p.level_no = gs.level_no
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'game_id', e.game_id,
        'level_no', e.level_no,
        'region_unlocked', e.region_unlocked,
        'level_unlocked',
          e.region_unlocked
          and (
            e.level_no <= e.cleared_levels
            or e.level_no = e.current_level
          ),
        'cleared', e.first_cleared_at is not null,
        'attempts', coalesce(e.attempts,0),
        'wins', coalesce(e.wins,0),
        'best_score', coalesce(e.best_score,0),
        'best_stars', coalesce(e.best_stars,0),
        'last_status', coalesce(e.last_status,'ready'),
        'first_cleared_at', e.first_cleared_at,
        'last_played_at', e.last_played_at
      )
      order by e.game_id, e.level_no
    ),
    '[]'::jsonb
  )
  into v_result
  from expanded e;

  return v_result;
end;
$function$;

revoke all on function public.get_my_buklod_kingdom_level_details_v1(text) from public, anon;
grant execute on function public.get_my_buklod_kingdom_level_details_v1(text) to authenticated;

comment on function public.get_my_buklod_kingdom_level_details_v1(text)
is 'Authenticated read-only per-level Kingdom details for Training Grounds: 13 regions x 20 levels, stars, scores, attempts and clear state.';
