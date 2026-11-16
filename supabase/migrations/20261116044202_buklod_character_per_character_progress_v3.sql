-- Preserve each user's BUKLOD Character progress independently.
-- Former V2 behavior overwrote a single lifetime-points baseline on every switch.
-- This migration is additive and retains the existing public RPC signatures.
create table if not exists private.buklod_character_progress_v3 (
  user_id uuid not null references auth.users(id) on delete cascade,
  character_id text not null check (character_id in (
    'phan','quin','van','christian','lhen',
    'jawo','trudice','ace','mitch','niel','angel','vhen','ellusur'
  )),
  earned_points bigint not null default 0 check (earned_points >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, character_id)
);
alter table private.buklod_character_progress_v3 enable row level security;
revoke all on table private.buklod_character_progress_v3 from public, anon, authenticated;

-- Every RPC call derives identity from the current signed-in session, never
-- a client-provided user id. Caller cannot read or write other users' levels.
create or replace function public.get_my_buklod_character_selection_v2()
returns jsonb
language plpgsql
stable security definer
set search_path to ''
as $fn$
declare
  v_uid uuid := (select auth.uid());
  v_lifetime bigint := 0;
  v_rank record;
  v_selection record;
  v_character text := 'phan';
  v_baseline bigint := 0;
  v_earned bigint := 0;
  v_level smallint := 1;
  v_levels jsonb := '{}'::jsonb;
  v_visible_specials jsonb := '[]'::jsonb;
  v_is_system_admin boolean := false;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  v_is_system_admin := public.buklod_is_system_admin();
  select coalesce(b.lifetime_points,0)::bigint
    into v_lifetime
  from public.buklod_user_points_balances b
  where b.user_id = v_uid;
  if not found then v_lifetime := 0; end if;

  select * into v_rank
  from public.get_buklod_rank_for_points_v2(greatest(v_lifetime,0));

  select s.* into v_selection
  from private.buklod_character_selection_v2 s
  where s.user_id = v_uid;

  if found then
    v_character := v_selection.character_id;
    v_baseline := greatest(coalesce(v_selection.baseline_lifetime_points,0),0);
  end if;

  select coalesce(p.earned_points,0)::bigint into v_earned
  from private.buklod_character_progress_v3 p
  where p.user_id = v_uid and p.character_id = v_character;
  if not found then v_earned := 0; end if;

  -- Saved points plus the active window's verified points. Inactive characters
  -- retain their checkpoint unchanged; lifetime Circle Rank never decreases.
  v_earned := v_earned + greatest(v_lifetime-v_baseline,0);
  v_level := private.buklod_character_level_for_delta_v2(v_earned);

  select coalesce(jsonb_object_agg(p.character_id,
    private.buklod_character_level_for_delta_v2(p.earned_points)), '{}'::jsonb)
    into v_levels
  from private.buklod_character_progress_v3 p
  where p.user_id = v_uid;
  v_levels := v_levels || jsonb_build_object(v_character,v_level);

  if v_is_system_admin then
    select coalesce(jsonb_agg(x.character_id order by x.required_rank_order),'[]'::jsonb)
      into v_visible_specials
    from (values
      ('jawo'::text,3::smallint),('trudice',5::smallint),
      ('ace',7::smallint),('mitch',9::smallint),('niel',11::smallint),
      ('angel',13::smallint),('vhen',15::smallint),('ellusur',17::smallint)
    ) as x(character_id,required_rank_order);
  else
    select coalesce(jsonb_agg(x.character_id order by x.required_rank_order),'[]'::jsonb)
      into v_visible_specials
    from (values
      ('jawo'::text,3::smallint),('trudice',5::smallint),
      ('ace',7::smallint),('mitch',9::smallint),('niel',11::smallint),
      ('angel',13::smallint),('vhen',15::smallint),('ellusur',17::smallint)
    ) as x(character_id,required_rank_order)
    where x.required_rank_order <= coalesce(v_rank.rank_order,1);
  end if;

  return jsonb_build_object(
    'active_character_id',v_character,
    'character_level',v_level,
    'character_points_since_selection',v_earned,
    'character_points_total',v_earned,
    'character_levels',v_levels,
    'baseline_lifetime_points',v_baseline,
    'lifetime_points',v_lifetime,
    'circle_rank_order',coalesce(v_rank.rank_order,1),
    'circle_rank_name',coalesce(v_rank.rank_name,'Circle Starter V'),
    'visible_special_character_ids',v_visible_specials,
    'selection_model','PER_CHARACTER_PERSISTED_V3',
    'special_gate_model',case
      when v_is_system_admin then 'SYSTEM_ADMIN_ALL_CHARACTERS_R1'
      else 'CANONICAL_CIRCLE_RANK_PLUS_2_STEPS' end,
    'system_admin_character_override',v_is_system_admin
  );
end;
$fn$;

create or replace function public.set_my_buklod_character_active_v2(p_character_id text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  v_uid uuid := (select auth.uid());
  v_character text := lower(btrim(coalesce(p_character_id,'')));
  v_lifetime bigint := 0;
  v_rank record;
  v_required_rank smallint;
  v_previous text := 'phan';
  v_baseline bigint := 0;
  v_active_delta bigint := 0;
  v_is_system_admin boolean := false;
  v_existing boolean := false;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  if v_character not in (
    'phan','quin','van','christian','lhen',
    'jawo','trudice','ace','mitch','niel','angel','vhen','ellusur'
  ) then
    raise exception 'Unsupported BUKLOD Character';
  end if;

  -- Serialize two rapid/retried switches for the same user.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('buklod_character_switch_v3'),
    pg_catalog.hashtext(v_uid::text)
  );

  v_is_system_admin := public.buklod_is_system_admin();
  select coalesce(b.lifetime_points,0)::bigint into v_lifetime
  from public.buklod_user_points_balances b where b.user_id = v_uid;
  if not found then v_lifetime := 0; end if;
  select * into v_rank
  from public.get_buklod_rank_for_points_v2(greatest(v_lifetime,0));

  v_required_rank := private.buklod_character_special_required_rank_v2(v_character);
  if v_required_rank is not null
     and not v_is_system_admin
     and coalesce(v_rank.rank_order,1) < v_required_rank then
    raise exception 'Special Character is not yet available at your Circle Rank';
  end if;

  select s.character_id,s.baseline_lifetime_points
    into v_previous,v_baseline
  from private.buklod_character_selection_v2 s
  where s.user_id = v_uid
  for update;
  v_existing := found;
  if not v_existing then
    -- A member who has never explicitly switched was always playing Phan.
    v_previous := 'phan';
    v_baseline := 0;
  end if;

  -- Idempotent: tapping the already-active character must never reset XP.
  if v_previous = v_character then
    return public.get_my_buklod_character_selection_v2();
  end if;

  -- Freeze previously active character's earned points before switching.
  v_active_delta := greatest(v_lifetime-greatest(v_baseline,0),0);
  insert into private.buklod_character_progress_v3 (
    user_id,character_id,earned_points,created_at,updated_at
  ) values (v_uid,v_previous,v_active_delta,now(),now())
  on conflict (user_id,character_id) do update
    set earned_points = private.buklod_character_progress_v3.earned_points
                        + excluded.earned_points,
        updated_at = now();

  insert into private.buklod_character_selection_v2(
    user_id,character_id,baseline_lifetime_points,selected_at,updated_at
  ) values(v_uid,v_character,greatest(v_lifetime,0),now(),now())
  on conflict (user_id) do update
    set character_id=excluded.character_id,
        baseline_lifetime_points=excluded.baseline_lifetime_points,
        selected_at=excluded.selected_at,
        updated_at=excluded.updated_at;

  if v_required_rank is not null then
    insert into private.buklod_special_character_selection(
      user_id,character_id,selected_at
    ) values(v_uid,v_character,now())
    on conflict(user_id) do update
      set character_id=excluded.character_id, selected_at=excluded.selected_at;

    insert into private.buklod_special_character_audit(
      user_id,character_id,event_type,source_key,metadata
    ) values(v_uid,v_character,'ACTIVATED','character_selection_v3',
      jsonb_build_object(
        'previous',v_previous,
        'previous_window_points_saved',v_active_delta,
        'restored_saved_character_level',(
          select private.buklod_character_level_for_delta_v2(p.earned_points)
          from private.buklod_character_progress_v3 p
          where p.user_id=v_uid and p.character_id=v_character
        ),
        'circle_rank_order',coalesce(v_rank.rank_order,1),
        'system_admin_override',v_is_system_admin
      )
    );
  else
    delete from private.buklod_special_character_selection
    where user_id=v_uid;
  end if;

  return public.get_my_buklod_character_selection_v2();
end;
$fn$;

revoke all on function public.get_my_buklod_character_selection_v2() from public, anon;
revoke all on function public.set_my_buklod_character_active_v2(text) from public, anon;
grant execute on function public.get_my_buklod_character_selection_v2() to authenticated;
grant execute on function public.set_my_buklod_character_active_v2(text) to authenticated;
