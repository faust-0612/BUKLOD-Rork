-- BUKLOD Character default Phan progression recovery.
-- Production migration version 20261109105129 is already applied.
-- This file preserves the exact live definitions to prevent repo/database drift.
-- Existing explicit selection baselines and character switch Level-1 reset remain authoritative.
CREATE OR REPLACE FUNCTION public.get_my_buklod_character_selection_v2()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    -- Implicit default Phan receives earned verified lifetime points.
    v_baseline := 0;
    v_level := private.buklod_character_level_for_delta_v2(greatest(v_lifetime, 0));
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

CREATE OR REPLACE FUNCTION private.buklod_character_collectible_progress_v1(p_user_id uuid, p_character_id text)
 RETURNS TABLE(is_active boolean, character_level integer, points_on_character bigint, lifetime_points bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_character text := lower(btrim(coalesce(p_character_id, '')));
  v_lifetime bigint := 0;
  v_baseline bigint := 0;
  v_active text := null;
BEGIN
  v_lifetime := public.buklod_lifetime_points_for(p_user_id);

  SELECT s.character_id, greatest(coalesce(s.baseline_lifetime_points, 0), 0)
  INTO v_active, v_baseline
  FROM private.buklod_character_selection_v2 s
  WHERE s.user_id = p_user_id;

  IF v_active IS NULL THEN
    -- Default Phan is active until the first explicit character selection.
    IF v_character = 'phan' THEN
      RETURN QUERY SELECT
        true,
        private.buklod_character_level_for_delta_v2(greatest(v_lifetime, 0))::integer,
        greatest(v_lifetime, 0),
        v_lifetime;
    ELSE
      RETURN QUERY SELECT false, 1, 0::bigint, v_lifetime;
    END IF;
    RETURN;
  END IF;

  IF v_active IS DISTINCT FROM v_character THEN
    RETURN QUERY SELECT false, 1, 0::bigint, v_lifetime;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    true,
    private.buklod_character_level_for_delta_v2(greatest(v_lifetime - v_baseline, 0))::integer,
    greatest(v_lifetime - v_baseline, 0),
    v_lifetime;
END;
$function$;
