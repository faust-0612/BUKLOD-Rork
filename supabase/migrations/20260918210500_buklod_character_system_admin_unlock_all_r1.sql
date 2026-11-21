-- BUKLOD Character System Admin Unlock All R1
-- Scope: system_admin only. Member/pastor/leader/local-admin Character gates remain unchanged.
-- Behavior:
--   1) System Admin sees all 8 Special Characters regardless of Circle Rank.
--   2) System Admin may activate any Special Character.
--   3) System Admin may inspect that Special Character's collectible/journey payload.
--   4) Character level reset/progression semantics remain unchanged.
--   5) This override does not mutate rank, points, or ordinary member unlock state.

create or replace function public.get_my_buklod_character_selection_v2()
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
  v_selection record;
  v_character text := 'phan';
  v_baseline bigint := 0;
  v_level smallint := 1;
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

  if not found then
    v_lifetime := 0;
  end if;

  select * into v_rank
  from public.get_buklod_rank_for_points_v2(greatest(v_lifetime,0));

  select s.* into v_selection
  from private.buklod_character_selection_v2 s
  where s.user_id = v_uid;

  if found then
    v_character := v_selection.character_id;
    v_baseline := greatest(coalesce(v_selection.baseline_lifetime_points,0),0);
    v_level := private.buklod_character_level_for_delta_v2(
      greatest(v_lifetime - v_baseline, 0)
    );
  else
    v_baseline := v_lifetime;
    v_level := 1;
  end if;

  if v_is_system_admin then
    select coalesce(
      jsonb_agg(x.character_id order by x.required_rank_order),
      '[]'::jsonb
    )
    into v_visible_specials
    from (
      values
        ('jawo'::text,3::smallint),
        ('trudice',5::smallint),
        ('ace',7::smallint),
        ('mitch',9::smallint),
        ('niel',11::smallint),
        ('angel',13::smallint),
        ('vhen',15::smallint),
        ('ellusur',17::smallint)
    ) as x(character_id, required_rank_order);
  else
    select coalesce(
      jsonb_agg(x.character_id order by x.required_rank_order),
      '[]'::jsonb
    )
    into v_visible_specials
    from (
      values
        ('jawo'::text,3::smallint),
        ('trudice',5::smallint),
        ('ace',7::smallint),
        ('mitch',9::smallint),
        ('niel',11::smallint),
        ('angel',13::smallint),
        ('vhen',15::smallint),
        ('ellusur',17::smallint)
    ) as x(character_id, required_rank_order)
    where x.required_rank_order <= coalesce(v_rank.rank_order,1);
  end if;

  return jsonb_build_object(
    'active_character_id', v_character,
    'character_level', v_level,
    'character_points_since_selection', greatest(v_lifetime - v_baseline,0),
    'baseline_lifetime_points', v_baseline,
    'lifetime_points', v_lifetime,
    'circle_rank_order', coalesce(v_rank.rank_order,1),
    'circle_rank_name', coalesce(v_rank.rank_name,'Circle Starter V'),
    'visible_special_character_ids', v_visible_specials,
    'selection_model', 'ATOMIC_RESET_LEVEL_1_V2',
    'special_gate_model',
      case
        when v_is_system_admin then 'SYSTEM_ADMIN_ALL_CHARACTERS_R1'
        else 'CANONICAL_CIRCLE_RANK_PLUS_2_STEPS'
      end,
    'system_admin_character_override', v_is_system_admin
  );
end;
$function$;

create or replace function public.set_my_buklod_character_active_v2(p_character_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_character text := lower(btrim(coalesce(p_character_id,'')));
  v_lifetime bigint := 0;
  v_rank record;
  v_required_rank smallint;
  v_previous text;
  v_is_system_admin boolean := false;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  v_is_system_admin := public.buklod_is_system_admin();

  if v_character not in (
    'phan','quin','van','christian','lhen',
    'jawo','trudice','ace','mitch','niel','angel','vhen','ellusur'
  ) then
    raise exception 'Unsupported BUKLOD Character';
  end if;

  select coalesce(b.lifetime_points,0)::bigint
  into v_lifetime
  from public.buklod_user_points_balances b
  where b.user_id = v_uid;

  if not found then
    v_lifetime := 0;
  end if;

  select * into v_rank
  from public.get_buklod_rank_for_points_v2(greatest(v_lifetime,0));

  v_required_rank := private.buklod_character_special_required_rank_v2(v_character);

  if v_required_rank is not null
     and not v_is_system_admin
     and coalesce(v_rank.rank_order,1) < v_required_rank then
    raise exception 'Special Character is not yet available at your Circle Rank';
  end if;

  select s.character_id into v_previous
  from private.buklod_character_selection_v2 s
  where s.user_id = v_uid;

  insert into private.buklod_character_selection_v2(
    user_id, character_id, baseline_lifetime_points, selected_at, updated_at
  ) values (
    v_uid, v_character, greatest(v_lifetime,0), now(), now()
  )
  on conflict (user_id) do update
  set character_id = excluded.character_id,
      baseline_lifetime_points = excluded.baseline_lifetime_points,
      selected_at = excluded.selected_at,
      updated_at = excluded.updated_at;

  if v_required_rank is not null then
    insert into private.buklod_special_character_selection(user_id, character_id, selected_at)
    values(v_uid, v_character, now())
    on conflict (user_id) do update
    set character_id = excluded.character_id,
        selected_at = excluded.selected_at;
  else
    delete from private.buklod_special_character_selection
    where user_id = v_uid;
  end if;

  insert into private.buklod_special_character_audit(
    user_id, character_id, event_type, source_key, metadata
  ) values (
    v_uid,
    v_character,
    'ACTIVATED',
    'character_selection_v2',
    jsonb_build_object(
      'previous', v_previous,
      'reset_character_level_to', 1,
      'circle_rank_order', coalesce(v_rank.rank_order,1),
      'baseline_lifetime_points', greatest(v_lifetime,0),
      'system_admin_override', v_is_system_admin
    )
  );

  return public.get_my_buklod_character_selection_v2();
end;
$function$;

create or replace function public.get_my_buklod_special_collectibles_v2(p_character_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_character text := lower(btrim(coalesce(p_character_id,'')));
  v_unlocked boolean := false;
  v_current integer := 1;
  v_items jsonb;
  v_is_system_admin boolean := false;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  v_is_system_admin := public.buklod_is_system_admin();

  perform private.buklod_reconcile_special_character_unlocks_v2(v_uid);

  select exists(
    select 1
    from private.buklod_special_character_user_state s
    where s.user_id = v_uid
      and s.character_id = v_character
      and s.unlocked_at is not null
  )
  into v_unlocked;

  if not v_unlocked and not v_is_system_admin then
    raise exception 'Special Character is not unlocked';
  end if;

  v_current := private.buklod_special_current_level_v2(v_uid,v_character);
  perform private.buklod_eval_special_collectibles_v2(v_uid,null);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'level_no', d.level_no,
        'collectible_id', d.collectible_id,
        'collectible_name',
          case when d.is_secret and a.earned_at is null then '???' else d.collectible_name end,
        'badge_name',
          case when d.is_secret and a.earned_at is null then '???' else d.badge_name end,
        'difficulty_tier', d.difficulty_tier,
        'secret', d.is_secret,
        'earned', (a.earned_at is not null),
        'earned_at', a.earned_at,
        'earned_early', (a.earned_at is not null and d.level_no > v_current),
        'level_viewable', (d.level_no <= v_current),
        'requirement',
          case when d.is_secret and a.earned_at is null then null else d.requirement end
      )
      order by d.level_no
    ),
    '[]'::jsonb
  )
  into v_items
  from private.buklod_special_collectible_definitions_v2 d
  left join private.buklod_special_collectible_awards_v2 a
    on a.user_id = v_uid
   and a.collectible_id = d.collectible_id
  where d.character_id = v_character
    and d.is_active = true;

  return jsonb_build_object(
    'character_id', v_character,
    'unlocked', true,
    'current_level', v_current,
    'level1_always_viewable', false,
    'collectible_metric_scope', 'GENERAL_PUBLIC_WALL_ONLY',
    'system_admin_character_override', v_is_system_admin,
    'collectibles', v_items
  );
end;
$function$;

comment on function public.get_my_buklod_character_selection_v2()
is 'BUKLOD Character V2 state. System Admin sees all Special Characters; all other users keep canonical Circle Rank gating.';

comment on function public.set_my_buklod_character_active_v2(text)
is 'BUKLOD Character V2 activation. System Admin may activate any Character; all other users keep canonical Circle Rank gating.';

comment on function public.get_my_buklod_special_collectibles_v2(text)
is 'BUKLOD Special Character collectible payload. System Admin may inspect any Special Character without mutating ordinary unlock state.';
