-- BUKLOD KINGDOM E2E V1
-- Server-authoritative 13-region / 20-level Kingdom progression.
-- Kingdom XP is independent from Circle Points. Circle Rank is used only as a Special-region gate.

create table if not exists private.buklod_kingdom_level_progress_v1 (
  user_id uuid not null,
  game_id text not null,
  level_no smallint not null check (level_no between 1 and 20),
  attempts integer not null default 0 check (attempts >= 0),
  wins integer not null default 0 check (wins >= 0),
  best_score integer not null default 0 check (best_score >= 0),
  best_stars smallint not null default 0 check (best_stars between 0 and 3),
  first_cleared_at timestamptz,
  last_status text not null default 'lost' check (last_status in ('won','lost')),
  last_played_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, game_id, level_no)
);

create index if not exists buklod_kingdom_level_progress_v1_user_idx
  on private.buklod_kingdom_level_progress_v1(user_id, game_id, level_no);

create table if not exists private.buklod_kingdom_wallet_v1 (
  user_id uuid primary key,
  kingdom_xp bigint not null default 0 check (kingdom_xp >= 0),
  game_xp bigint not null default 0 check (game_xp >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists private.buklod_kingdom_collectibles_v1 (
  user_id uuid not null,
  game_id text not null,
  collectible_key text not null,
  earned_level smallint not null check (earned_level between 1 and 20),
  earned_at timestamptz not null default now(),
  primary key (user_id, collectible_key)
);

create index if not exists buklod_kingdom_collectibles_v1_user_idx
  on private.buklod_kingdom_collectibles_v1(user_id, game_id);

create table if not exists private.buklod_kingdom_result_events_v1 (
  user_id uuid not null,
  client_result_id text not null,
  game_id text not null,
  level_no smallint not null check (level_no between 1 and 20),
  status text not null check (status in ('won','lost')),
  score integer not null check (score >= 0),
  stars smallint not null check (stars between 0 and 3),
  kingdom_xp_awarded integer not null default 0,
  game_xp_awarded integer not null default 0,
  collectible_awarded text,
  response jsonb,
  created_at timestamptz not null default now(),
  primary key (user_id, client_result_id)
);

create or replace function private.buklod_kingdom_required_rank_v1(p_game_id text)
returns smallint
language sql
immutable
set search_path = ''
as $function$
  select case lower(coalesce(p_game_id,''))
    when 'jawo-forest-trail' then 3
    when 'trudice-playground-memory' then 5
    when 'ace-rescue-grid' then 7
    when 'mitch-restore-mural' then 9
    when 'niel-mission-trail' then 11
    when 'angel-kingdom-treasury' then 13
    when 'vhen-farm-to-market' then 15
    when 'elesur-village-builder' then 17
    else null
  end::smallint;
$function$;

create or replace function private.buklod_kingdom_collectible_key_v1(p_game_id text)
returns text
language sql
immutable
set search_path = ''
as $function$
  select case lower(coalesce(p_game_id,''))
    when 'jawo-forest-trail' then 'jawo-forest-first-light'
    when 'trudice-playground-memory' then 'trudice-bright-memory-star'
    when 'ace-rescue-grid' then 'ace-grid-command-emblem'
    when 'mitch-restore-mural' then 'mitch-master-restorer-mark'
    when 'niel-mission-trail' then 'niel-pathfinder-compass'
    when 'angel-kingdom-treasury' then 'angel-balanced-steward-seal'
    when 'vhen-farm-to-market' then 'vhen-golden-harvest-crate'
    when 'elesur-village-builder' then 'elesur-highland-service-seal'
    when 'phan-enterprise-builder' then 'phan-enterprise-founder-seal'
    when 'van-living-city-dispatch' then 'van-city-service-medal'
    when 'christian-civic-leadership' then 'christian-civic-trust-seal'
    when 'lhen-rhythm-journey' then 'lhen-rhythm-master-note'
    when 'quin-discovery-expedition' then 'quin-first-discovery-relic'
    else null
  end;
$function$;

create or replace function private.buklod_kingdom_game_base_xp_v1(p_game_id text)
returns table(kingdom_base integer, game_base integer)
language sql
immutable
set search_path = ''
as $function$
  select
    case lower(coalesce(p_game_id,''))
      when 'jawo-forest-trail' then 60
      when 'trudice-playground-memory' then 55
      when 'ace-rescue-grid' then 60
      when 'mitch-restore-mural' then 55
      when 'niel-mission-trail' then 65
      when 'angel-kingdom-treasury' then 60
      when 'vhen-farm-to-market' then 55
      when 'elesur-village-builder' then 60
      when 'phan-enterprise-builder' then 60
      when 'van-living-city-dispatch' then 60
      when 'christian-civic-leadership' then 60
      when 'lhen-rhythm-journey' then 60
      when 'quin-discovery-expedition' then 60
      else 55
    end,
    case lower(coalesce(p_game_id,''))
      when 'jawo-forest-trail' then 140
      when 'trudice-playground-memory' then 125
      when 'ace-rescue-grid' then 135
      when 'mitch-restore-mural' then 130
      when 'niel-mission-trail' then 145
      when 'angel-kingdom-treasury' then 135
      when 'vhen-farm-to-market' then 125
      when 'elesur-village-builder' then 130
      when 'phan-enterprise-builder' then 135
      when 'van-living-city-dispatch' then 130
      when 'christian-civic-leadership' then 135
      when 'lhen-rhythm-journey' then 130
      when 'quin-discovery-expedition' then 135
      else 125
    end;
$function$;

create or replace function public.get_my_buklod_kingdom_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_lifetime bigint := 0;
  v_rank record;
  v_rank_order integer := 1;
  v_rank_name text := 'Circle Starter V';
  v_admin boolean := false;
  v_kingdom_xp bigint := 0;
  v_game_xp bigint := 0;
  v_stations jsonb := '[]'::jsonb;
  v_cleared_regions integer := 0;
  v_mastered_regions integer := 0;
  v_stage integer := 1;
  v_stage_title text := 'A SMALL BEGINNING';
  v_stage_subtitle text := 'A greater tomorrow starts here';
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  v_admin := public.buklod_is_system_admin();

  select coalesce(b.lifetime_points,0)::bigint
  into v_lifetime
  from public.buklod_user_points_balances b
  where b.user_id = v_uid;

  if not found then v_lifetime := 0; end if;

  select * into v_rank
  from public.get_buklod_rank_for_points_v2(greatest(v_lifetime,0));

  v_rank_order := coalesce(v_rank.rank_order,1);
  v_rank_name := coalesce(v_rank.rank_name,'Circle Starter V');

  select coalesce(w.kingdom_xp,0), coalesce(w.game_xp,0)
  into v_kingdom_xp, v_game_xp
  from private.buklod_kingdom_wallet_v1 w
  where w.user_id = v_uid;

  if not found then
    v_kingdom_xp := 0;
    v_game_xp := 0;
  end if;

  with game_registry(game_id, character_key, character_name, region_name, game_name, reveal_order, required_rank) as (
    values
      ('phan-enterprise-builder','phan','Phan','Farm / Enterprise','Enterprise Builder',1,null::smallint),
      ('vhen-farm-to-market','vhen','Vhen','Agricultural Valley','Farm to Market',2,15::smallint),
      ('jawo-forest-trail','jawo','Jawo','Explorer Forest','Forest Trail',3,3::smallint),
      ('trudice-playground-memory','trudice','Trudice','Children''s Haven','Wonder Path',4,5::smallint),
      ('mitch-restore-mural','mitch','Mitch','Art Village','Restore the Mural',5,9::smallint),
      ('christian-civic-leadership','christian','Christian','Civic Academy','Leadership Council',6,null::smallint),
      ('ace-rescue-grid','ace','Ace','Strategy / Rescue','Rescue Grid',7,7::smallint),
      ('van-living-city-dispatch','van','Van','Living City','City Dispatch',8,null::smallint),
      ('lhen-rhythm-journey','lhen','Lhen','Music City','Rhythm Journey',9,null::smallint),
      ('angel-kingdom-treasury','angel','Angel','Treasury City','Kingdom Treasury',10,13::smallint),
      ('niel-mission-trail','niel','Niel','Mission Frontier','Mission Trail',11,11::smallint),
      ('elesur-village-builder','elesur','ELESUR','Highland Community','Village Builder',12,17::smallint),
      ('quin-discovery-expedition','quin','Quin','Discovery World','Discovery Expedition',13,null::smallint)
  ),
  summaries as (
    select
      g.*,
      (v_admin or g.required_rank is null or g.required_rank <= v_rank_order) as unlocked,
      coalesce((
        select count(*)::integer
        from private.buklod_kingdom_level_progress_v1 p
        where p.user_id=v_uid and p.game_id=g.game_id and p.first_cleared_at is not null
      ),0) as cleared_levels,
      coalesce((
        select sum(p.wins)::integer
        from private.buklod_kingdom_level_progress_v1 p
        where p.user_id=v_uid and p.game_id=g.game_id
      ),0) as clears,
      coalesce((
        select sum(p.attempts)::integer
        from private.buklod_kingdom_level_progress_v1 p
        where p.user_id=v_uid and p.game_id=g.game_id
      ),0) as attempts,
      coalesce((
        select max(p.best_score)
        from private.buklod_kingdom_level_progress_v1 p
        where p.user_id=v_uid and p.game_id=g.game_id
      ),0) as best_score,
      coalesce((
        select max(p.best_stars)
        from private.buklod_kingdom_level_progress_v1 p
        where p.user_id=v_uid and p.game_id=g.game_id
      ),0)::smallint as best_stars,
      coalesce((
        select p.last_status
        from private.buklod_kingdom_level_progress_v1 p
        where p.user_id=v_uid and p.game_id=g.game_id
        order by p.last_played_at desc
        limit 1
      ),'ready') as last_status,
      exists(
        select 1
        from private.buklod_kingdom_collectibles_v1 c
        where c.user_id=v_uid
          and c.collectible_key=private.buklod_kingdom_collectible_key_v1(g.game_id)
      ) as collectible_earned
    from game_registry g
  ),
  shaped as (
    select
      s.*,
      case when s.cleared_levels >= 20 then 20 else least(20,s.cleared_levels+1) end as current_level,
      (s.cleared_levels >= 20) as mastered,
      case
        when s.cleared_levels >= 20 then 5
        when s.cleared_levels >= 15 then 4
        when s.cleared_levels >= 10 then 3
        when s.cleared_levels >= 5 then 2
        when s.cleared_levels >= 1 then 1
        else 0
      end as world_tier
    from summaries s
  )
  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'game_id', s.game_id,
        'character_key', s.character_key,
        'character_name', s.character_name,
        'region_name', s.region_name,
        'game_name', s.game_name,
        'reveal_order', s.reveal_order,
        'required_rank_order', s.required_rank,
        'unlocked', s.unlocked,
        'current_level', s.current_level,
        'cleared_levels', s.cleared_levels,
        'mastered', s.mastered,
        'clears', s.clears,
        'attempts', s.attempts,
        'best_score', s.best_score,
        'best_stars', s.best_stars,
        'last_status', s.last_status,
        'world_tier', s.world_tier,
        'collectible_key', private.buklod_kingdom_collectible_key_v1(s.game_id),
        'collectible_earned', s.collectible_earned
      )
      order by s.reveal_order
    ),'[]'::jsonb),
    count(*) filter (where s.cleared_levels > 0)::integer,
    count(*) filter (where s.mastered)::integer
  into v_stations, v_cleared_regions, v_mastered_regions
  from shaped s;

  if v_cleared_regions >= 13 then
    v_stage := 5;
    v_stage_title := 'KINGDOM UNITED';
    v_stage_subtitle := 'Every region is alive; mastery now shapes the world';
  elsif v_cleared_regions >= 10 then
    v_stage := 4;
    v_stage_title := 'A BRIGHTER TOMORROW';
    v_stage_subtitle := 'A united people, a living world';
  elsif v_cleared_regions >= 7 then
    v_stage := 3;
    v_stage_title := 'A GROWING KINGDOM';
    v_stage_subtitle := 'More paths, people and purpose';
  elsif v_cleared_regions >= 4 then
    v_stage := 2;
    v_stage_title := 'STRONGER TOGETHER';
    v_stage_subtitle := 'The kingdom begins to awaken';
  else
    v_stage := 1;
  end if;

  return jsonb_build_object(
    'version', 2,
    'server_backed', true,
    'circle_rank_order', v_rank_order,
    'circle_rank_name', v_rank_name,
    'system_admin_override', v_admin,
    'kingdom_xp', v_kingdom_xp,
    'game_xp', v_game_xp,
    'cleared_regions', v_cleared_regions,
    'mastered_regions', v_mastered_regions,
    'stage', v_stage,
    'stage_title', v_stage_title,
    'stage_subtitle', v_stage_subtitle,
    'landmarks', jsonb_build_object(
      'training_grounds', v_stage >= 2,
      'igpat_arena', v_stage >= 3,
      'mentor_tower', v_stage >= 3,
      'kingdom_united', v_stage >= 5
    ),
    'stations', v_stations,
    'progression_model', 'SERVER_13_REGIONS_20_LEVELS_SEQUENTIAL_V1',
    'economy_model', 'KINGDOM_XP_SEPARATE_FROM_CIRCLE_POINTS_V1'
  );
end;
$function$;

create or replace function public.submit_my_buklod_kingdom_result_v1(
  p_client_result_id text,
  p_game_id text,
  p_status text,
  p_score integer,
  p_stars integer
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

  v_level := case when v_cleared >= 20 then 20 else (v_cleared+1)::smallint end;

  select p.* into v_existing
  from private.buklod_kingdom_level_progress_v1 p
  where p.user_id=v_uid and p.game_id=v_game and p.level_no=v_level;

  if found then
    v_old_stars := coalesce(v_existing.best_stars,0);
    v_first_clear := v_status='won' and v_existing.first_cleared_at is null;
  else
    v_old_stars := 0;
    v_first_clear := v_status='won';
  end if;

  insert into private.buklod_kingdom_level_progress_v1(
    user_id,game_id,level_no,attempts,wins,best_score,best_stars,
    first_cleared_at,last_status,last_played_at,updated_at
  ) values (
    v_uid,v_game,v_level,1,case when v_status='won' then 1 else 0 end,
    v_score,v_stars,case when v_status='won' then now() else null end,
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

revoke all on function public.get_my_buklod_kingdom_v1() from public, anon;
grant execute on function public.get_my_buklod_kingdom_v1() to authenticated;

revoke all on function public.submit_my_buklod_kingdom_result_v1(text,text,text,integer,integer) from public, anon;
grant execute on function public.submit_my_buklod_kingdom_result_v1(text,text,text,integer,integer) to authenticated;

comment on function public.get_my_buklod_kingdom_v1()
is 'Server-authoritative BUKLOD Kingdom state: 13 visible regions, Circle-Rank gates, 20 sequential levels, world growth and separate Kingdom XP.';

comment on function public.submit_my_buklod_kingdom_result_v1(text,text,text,integer,integer)
is 'Idempotent BUKLOD Kingdom result submission. First clear advances one level and awards non-farmable Kingdom/Game XP; 3-star collectible is unique.';
