-- BUKLOD KINGDOM LEVEL REPLAY V2
-- Adds explicit level selection for Training Grounds while preserving sequential first-clear progression.

create or replace function public.submit_my_buklod_kingdom_result_v2(
  p_client_result_id text,
  p_game_id text,
  p_status text,
  p_score integer,
  p_stars integer,
  p_level_no integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_client_id text := btrim(coalesce(p_client_result_id,''));
  v_game text := lower(btrim(coalesce(p_game_id,'')));
  v_status text := lower(btrim(coalesce(p_status,'')));
  v_score integer := greatest(coalesce(p_score,0),0);
  v_stars smallint := greatest(0,least(3,coalesce(p_stars,0)))::smallint;
  v_required_rank smallint;
  v_lifetime bigint := 0;
  v_rank record;
  v_rank_order integer := 1;
  v_admin boolean := false;
  v_cleared integer := 0;
  v_next_level smallint := 1;
  v_level smallint := 1;
  v_existing record;
  v_first_clear boolean := false;
  v_old_stars smallint := 0;
  v_kingdom_base integer := 55;
  v_game_base integer := 125;
  v_kingdom_award integer := 0;
  v_game_award integer := 0;
  v_collectible text;
  v_collectible_awarded text := null;
  v_state jsonb;
  v_response jsonb;
  v_valid_game boolean := false;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if length(v_client_id) < 8 or length(v_client_id) > 180 then
    raise exception 'Invalid Kingdom result id';
  end if;
  if v_status not in ('won','lost') then raise exception 'Invalid Kingdom result status'; end if;
  if v_score > 10000000 then raise exception 'Invalid Kingdom score'; end if;
  if p_level_no is not null and (p_level_no < 1 or p_level_no > 20) then
    raise exception 'Invalid Kingdom level';
  end if;

  select exists(
    select 1
    from (values
      ('phan-enterprise-builder'),('vhen-farm-to-market'),('jawo-forest-trail'),
      ('trudice-playground-memory'),('mitch-restore-mural'),('christian-civic-leadership'),
      ('ace-rescue-grid'),('van-living-city-dispatch'),('lhen-rhythm-journey'),
      ('angel-kingdom-treasury'),('niel-mission-trail'),('elesur-village-builder'),
      ('quin-discovery-expedition')
    ) g(game_id)
    where g.game_id=v_game
  ) into v_valid_game;

  if not v_valid_game then raise exception 'Unsupported BUKLOD Kingdom game'; end if;

  perform pg_advisory_xact_lock(hashtext(v_uid::text));

  select e.response into v_response
  from private.buklod_kingdom_result_events_v1 e
  where e.user_id=v_uid and e.client_result_id=v_client_id;

  if found and v_response is not null then return v_response; end if;

  v_admin := public.buklod_is_system_admin();
  v_required_rank := private.buklod_kingdom_required_rank_v1(v_game);

  select coalesce(b.lifetime_points,0)::bigint
  into v_lifetime
  from public.buklod_user_points_balances b
  where b.user_id=v_uid;
  if not found then v_lifetime := 0; end if;

  select * into v_rank
  from public.get_buklod_rank_for_points_v2(greatest(v_lifetime,0));
  v_rank_order := coalesce(v_rank.rank_order,1);

  if v_required_rank is not null and not v_admin and v_rank_order < v_required_rank then
    raise exception 'Kingdom region is locked until Circle Rank %', v_required_rank;
  end if;

  select count(*)::integer
  into v_cleared
  from private.buklod_kingdom_level_progress_v1 p
  where p.user_id=v_uid and p.game_id=v_game and p.first_cleared_at is not null;

  v_next_level := case when v_cleared >= 20 then 20 else (v_cleared+1)::smallint end;
  v_level := coalesce(p_level_no, v_next_level)::smallint;

  if v_level > v_next_level then
    raise exception 'Kingdom level % is not unlocked yet; current level is %', v_level, v_next_level;
  end if;

  select p.* into v_existing
  from private.buklod_kingdom_level_progress_v1 p
  where p.user_id=v_uid and p.game_id=v_game and p.level_no=v_level;

  if v_level < v_next_level and (not found or v_existing.first_cleared_at is null) then
    raise exception 'Kingdom replay level % was not previously cleared', v_level;
  end if;

  if found then
    v_old_stars := coalesce(v_existing.best_stars,0);
    v_first_clear := v_status='won'
      and v_level=v_next_level
      and v_existing.first_cleared_at is null;
  else
    v_old_stars := 0;
    v_first_clear := v_status='won' and v_level=v_next_level;
  end if;

  insert into private.buklod_kingdom_level_progress_v1(
    user_id,game_id,level_no,attempts,wins,best_score,best_stars,
    first_cleared_at,last_status,last_played_at,updated_at
  ) values (
    v_uid,v_game,v_level,1,case when v_status='won' then 1 else 0 end,
    v_score,v_stars,case when v_first_clear then now() else null end,
    v_status,now(),now()
  )
  on conflict(user_id,game_id,level_no) do update
  set attempts=private.buklod_kingdom_level_progress_v1.attempts+1,
      wins=private.buklod_kingdom_level_progress_v1.wins + case when excluded.last_status='won' then 1 else 0 end,
      best_score=greatest(private.buklod_kingdom_level_progress_v1.best_score,excluded.best_score),
      best_stars=greatest(private.buklod_kingdom_level_progress_v1.best_stars,excluded.best_stars),
      first_cleared_at=coalesce(private.buklod_kingdom_level_progress_v1.first_cleared_at,excluded.first_cleared_at),
      last_status=excluded.last_status,
      last_played_at=excluded.last_played_at,
      updated_at=now();

  select kingdom_base, game_base
  into v_kingdom_base, v_game_base
  from private.buklod_kingdom_game_base_xp_v1(v_game);

  if v_first_clear then
    v_kingdom_award := v_kingdom_base + v_stars*20 + v_level*3;
    v_game_award := v_game_base + v_stars*25 + v_level*5;

    insert into private.buklod_kingdom_wallet_v1(user_id,kingdom_xp,game_xp,updated_at)
    values(v_uid,v_kingdom_award,v_game_award,now())
    on conflict(user_id) do update
    set kingdom_xp=private.buklod_kingdom_wallet_v1.kingdom_xp+excluded.kingdom_xp,
        game_xp=private.buklod_kingdom_wallet_v1.game_xp+excluded.game_xp,
        updated_at=now();
  end if;

  v_collectible := private.buklod_kingdom_collectible_key_v1(v_game);
  if v_status='won' and v_stars=3 and v_collectible is not null then
    insert into private.buklod_kingdom_collectibles_v1(
      user_id,game_id,collectible_key,earned_level,earned_at
    ) values(v_uid,v_game,v_collectible,v_level,now())
    on conflict(user_id,collectible_key) do nothing;

    if found then v_collectible_awarded := v_collectible; end if;
  end if;

  v_state := public.get_my_buklod_kingdom_v1();
  v_response := v_state || jsonb_build_object(
    'last_result',jsonb_build_object(
      'client_result_id',v_client_id,
      'game_id',v_game,
      'level_no',v_level,
      'status',v_status,
      'score',v_score,
      'stars',v_stars,
      'first_clear',v_first_clear,
      'replay',v_level < v_next_level or (v_cleared >= 20 and v_level=20),
      'star_improved',v_stars > v_old_stars,
      'kingdom_xp_awarded',v_kingdom_award,
      'game_xp_awarded',v_game_award,
      'collectible_awarded',v_collectible_awarded
    )
  );

  insert into private.buklod_kingdom_result_events_v1(
    user_id,client_result_id,game_id,level_no,status,score,stars,
    kingdom_xp_awarded,game_xp_awarded,collectible_awarded,response,created_at
  ) values (
    v_uid,v_client_id,v_game,v_level,v_status,v_score,v_stars,
    v_kingdom_award,v_game_award,v_collectible_awarded,v_response,now()
  )
  on conflict(user_id,client_result_id) do update
  set response=coalesce(private.buklod_kingdom_result_events_v1.response,excluded.response);

  return v_response;
end;
$function$;

revoke all on function public.submit_my_buklod_kingdom_result_v2(text,text,text,integer,integer,integer) from public, anon;
grant execute on function public.submit_my_buklod_kingdom_result_v2(text,text,text,integer,integer,integer) to authenticated;

create or replace function public.submit_my_buklod_kingdom_result_v1(
  p_client_result_id text,
  p_game_id text,
  p_status text,
  p_score integer,
  p_stars integer
)
returns jsonb
language sql
security definer
set search_path = ''
as $function$
  select public.submit_my_buklod_kingdom_result_v2(
    p_client_result_id,
    p_game_id,
    p_status,
    p_score,
    p_stars,
    null
  );
$function$;

revoke all on function public.submit_my_buklod_kingdom_result_v1(text,text,text,integer,integer) from public, anon;
grant execute on function public.submit_my_buklod_kingdom_result_v1(text,text,text,integer,integer) to authenticated;

comment on function public.submit_my_buklod_kingdom_result_v2(text,text,text,integer,integer,integer)
is 'Level-aware idempotent Kingdom result submission. Explicit prior levels are replayable; only a first clear of the current sequential level advances and awards Kingdom/Game XP.';
