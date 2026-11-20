-- DEV CHANGESET ONLY — not a deployed migration.
-- Generate a numbered migration using the Supabase CLI after staging DB validation.
-- NEVER run this against live production until owner-approved RC/release gates pass.
-- Canonical: Circle Rank = BP; Character BP opens eligibility; verified task items gate visual level.
-- Show Faith is never required. Existing earned Character levels are grandfathered at cutover.
CREATE TABLE IF NOT EXISTS private.buklod_character_evolution_legacy_v1 (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  character_id text NOT NULL CHECK (character_id IN ('phan','quin','van','christian','lhen','jawo','trudice','ace','mitch','niel','angel','vhen','ellusur')),
  legacy_level smallint NOT NULL CHECK (legacy_level BETWEEN 1 AND 20),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,character_id)
);
CREATE TABLE IF NOT EXISTS private.buklod_character_evolution_activity_v1 (
  source_kind text NOT NULL CHECK (source_kind IN ('verified_public_event','verified_kingdom_mastery')),
  source_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  character_id text NOT NULL CHECK (character_id IN ('phan','quin','van','christian','lhen','jawo','trudice','ace','mitch','niel','angel','vhen','ellusur')),
  metric_key text NOT NULL CHECK (metric_key IN (
    'character_public_post','character_public_comment','character_public_reaction',
    'character_public_share','character_public_active_week','character_kingdom_mastery'
  )),
  occurred_at timestamptz NOT NULL,
  PRIMARY KEY(source_kind,source_id)
);
CREATE INDEX IF NOT EXISTS buklod_character_evolution_activity_lookup_idx
  ON private.buklod_character_evolution_activity_v1(user_id,character_id,metric_key,occurred_at);
CREATE TABLE IF NOT EXISTS private.buklod_character_evolution_items_v1 (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  character_id text NOT NULL CHECK (character_id IN ('phan','quin','van','christian','lhen','jawo','trudice','ace','mitch','niel','angel','vhen','ellusur')),
  from_level smallint NOT NULL CHECK (from_level BETWEEN 1 AND 19),
  item_index smallint NOT NULL CHECK (item_index BETWEEN 1 AND 5),
  -- Stable inventory asset identifier; the 13x20x5 story collection is not
  -- equivalent to the old BP-auto-redeemed cosmetic collectible grants.
  asset_key text GENERATED ALWAYS AS
    (character_id || ':L' || pg_catalog.lpad(from_level::text,2,'0') || ':I' || item_index::text) STORED,
  earned_at timestamptz NOT NULL DEFAULT now(),
  verified_metric_key text NOT NULL,
  observed_event_count integer NOT NULL CHECK (observed_event_count>=1),
  primary_event_count integer NOT NULL DEFAULT 0 CHECK (primary_event_count>=0),
  kingdom_event_count integer NOT NULL DEFAULT 0 CHECK (kingdom_event_count>=0),
  PRIMARY KEY(user_id,character_id,from_level,item_index)
);
ALTER TABLE private.buklod_character_evolution_legacy_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.buklod_character_evolution_activity_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.buklod_character_evolution_items_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.buklod_character_evolution_legacy_v1 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON TABLE private.buklod_character_evolution_activity_v1 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON TABLE private.buklod_character_evolution_items_v1 FROM PUBLIC,anon,authenticated;

-- One-time cutover snapshot must execute BEFORE the getter is switched to gated levels.
-- Stored Character XP and the current active earning window remain intact.
WITH legacy_candidates AS (
  SELECT p.user_id,p.character_id,
     p.earned_points + CASE WHEN s.character_id=p.character_id
       THEN greatest(coalesce(b.lifetime_points,0)-coalesce(s.baseline_lifetime_points,0),0)
       ELSE 0 END AS earned
    FROM private.buklod_character_progress_v3 p
    LEFT JOIN private.buklod_character_selection_v2 s ON s.user_id=p.user_id
    LEFT JOIN public.buklod_user_points_balances b ON b.user_id=p.user_id
  UNION ALL
  SELECT s.user_id,s.character_id,
     greatest(coalesce(b.lifetime_points,0)-coalesce(s.baseline_lifetime_points,0),0)
    FROM private.buklod_character_selection_v2 s
    LEFT JOIN public.buklod_user_points_balances b ON b.user_id=s.user_id
  UNION ALL
  SELECT b.user_id,'phan'::text,greatest(coalesce(b.lifetime_points,0),0)
    FROM public.buklod_user_points_balances b
   WHERE NOT EXISTS (SELECT 1 FROM private.buklod_character_selection_v2 s WHERE s.user_id=b.user_id)
)
INSERT INTO private.buklod_character_evolution_legacy_v1(user_id,character_id,legacy_level)
SELECT user_id,character_id,max(private.buklod_character_level_for_delta_v2(earned))
FROM legacy_candidates GROUP BY user_id,character_id
ON CONFLICT(user_id,character_id) DO NOTHING;

CREATE OR REPLACE FUNCTION private.buklod_character_evolution_item_count_v1(p_from_level integer)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT CASE WHEN p_from_level BETWEEN 1 AND 4 THEN 2
              WHEN p_from_level BETWEEN 5 AND 9 THEN 3
              WHEN p_from_level BETWEEN 10 AND 14 THEN 4
              WHEN p_from_level BETWEEN 15 AND 19 THEN 5
              ELSE 0 END;
$$;

CREATE OR REPLACE FUNCTION private.buklod_character_evolution_task_metric_v1(p_item_index integer)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT CASE p_item_index
    WHEN 1 THEN 'character_public_post'
    WHEN 2 THEN 'character_public_comment'
    WHEN 3 THEN 'character_public_reaction'
    WHEN 4 THEN 'character_public_share'
    WHEN 5 THEN 'character_public_active_week'
    ELSE NULL END;
$$;

-- Targets are cumulative only from each character's protected legacy floor.
-- A historical Level 15 member is not asked to redo 14 levels of activity.
CREATE OR REPLACE FUNCTION private.buklod_character_evolution_task_target_v1(
  p_floor integer,p_from_level integer,p_item_index integer)
RETURNS integer LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE v_step integer; v_total integer:=0;
BEGIN
  IF p_floor NOT BETWEEN 1 AND 20 OR p_from_level NOT BETWEEN p_floor AND 19
     OR p_item_index NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'Invalid Character evolution task target';
  END IF;
  FOR v_step IN p_floor..p_from_level LOOP
    -- Do not charge requirements retroactively for slots which did not
    -- exist in earlier tiers (reaction L5, share L10, active week L15).
    IF v_step >= CASE p_item_index
      WHEN 1 THEN 1 WHEN 2 THEN 1 WHEN 3 THEN 5
      WHEN 4 THEN 10 WHEN 5 THEN 15 END THEN
      v_total:=v_total+CASE p_item_index
        WHEN 1 THEN 1+(v_step-1)/4
        WHEN 2 THEN 2+(v_step-1)/4
        WHEN 3 THEN 3+(v_step-1)/3
        WHEN 4 THEN 1+(v_step-1)/5
        WHEN 5 THEN 1+(v_step-1)/6
      END;
    END IF;
  END LOOP;
  RETURN v_total;
END;
$$;

-- A server-authored event is attributed to the currently active character.
-- Existing event-source deduplication, meaningful-content checks and daily caps remain authoritative.
CREATE OR REPLACE FUNCTION private.buklod_character_evolution_capture_public_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_char text:='phan';
BEGIN
  IF NEW.metric_key NOT IN ('character_public_post','character_public_comment',
     'character_public_reaction','character_public_share','character_public_active_week') THEN
    RETURN NEW;
  END IF;
  -- Match the Character switch serialization so task credit cannot be attributed
  -- to a stale Character in parallel with a switch.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('buklod_character_switch_v3'),
    pg_catalog.hashtext(NEW.user_id::text));
  SELECT s.character_id INTO v_char
    FROM private.buklod_character_selection_v2 s WHERE s.user_id=NEW.user_id;
  v_char:=coalesce(v_char,'phan');
  INSERT INTO private.buklod_character_evolution_activity_v1
    (source_kind,source_id,user_id,character_id,metric_key,occurred_at)
  VALUES ('verified_public_event',NEW.id::text,NEW.user_id,v_char,NEW.metric_key,NEW.occurred_at)
  ON CONFLICT(source_kind,source_id) DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_buklod_character_evolution_capture_public_v1
  ON private.buklod_character_public_events_v3;
CREATE TRIGGER trg_buklod_character_evolution_capture_public_v1
AFTER INSERT ON private.buklod_character_public_events_v3
FOR EACH ROW EXECUTE FUNCTION private.buklod_character_evolution_capture_public_v1();

-- Alternative non-faith route: first verified Kingdom game mastery credited by canonical reward backend.
-- Never trust a client-submitted game score; claimed reward ledger is the source.
CREATE OR REPLACE FUNCTION private.buklod_character_evolution_capture_kingdom_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_char text:='phan';
BEGIN
  IF NEW.direction IS DISTINCT FROM 'credit'
     OR NEW.claim_state IS DISTINCT FROM 'claimed'
     OR NEW.activity_type IS DISTINCT FROM 'game_first_qualified'
     OR NEW.source_key NOT LIKE 'kingdom:mastery:v1:%' THEN RETURN NEW; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('buklod_character_switch_v3'),
    pg_catalog.hashtext(NEW.user_id::text));
  SELECT s.character_id INTO v_char
    FROM private.buklod_character_selection_v2 s WHERE s.user_id=NEW.user_id;
  v_char:=coalesce(v_char,'phan');
  INSERT INTO private.buklod_character_evolution_activity_v1
    (source_kind,source_id,user_id,character_id,metric_key,occurred_at)
  VALUES ('verified_kingdom_mastery',NEW.id::text,NEW.user_id,v_char,
          'character_kingdom_mastery',now())
  ON CONFLICT(source_kind,source_id) DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_buklod_character_evolution_capture_kingdom_v1
  ON public.buklod_points_ledger;
CREATE TRIGGER trg_buklod_character_evolution_capture_kingdom_v1
AFTER INSERT OR UPDATE OF claim_state ON public.buklod_points_ledger
FOR EACH ROW EXECUTE FUNCTION private.buklod_character_evolution_capture_kingdom_v1();

-- Public metric OR independent verified Kingdom mastery counts for items 1–4.
-- Active-week gate (item 5) remains weekly and cannot be farmed by replaying a game.
CREATE OR REPLACE FUNCTION private.buklod_character_evolution_task_count_v1(
  p_user_id uuid,p_character_id text,p_item_index integer)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT count(*)::integer
  FROM private.buklod_character_evolution_activity_v1 e
  WHERE e.user_id=p_user_id AND e.character_id=p_character_id
    AND (e.metric_key=private.buklod_character_evolution_task_metric_v1(p_item_index)
      OR (p_item_index BETWEEN 1 AND 4 AND e.metric_key='character_kingdom_mastery'));
$$;

CREATE OR REPLACE FUNCTION private.buklod_character_evolution_level_v1(
  p_user_id uuid,p_character_id text,p_earned_points bigint)
RETURNS smallint LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_floor integer:=1;
  v_bp integer:=private.buklod_character_level_for_delta_v2(greatest(p_earned_points,0));
  v_level integer;
BEGIN
  SELECT l.legacy_level INTO v_floor
    FROM private.buklod_character_evolution_legacy_v1 l
   WHERE l.user_id=p_user_id AND l.character_id=p_character_id;
  v_floor:=least(20,greatest(1,coalesce(v_floor,1)));
  -- Never downgrade a pre-cutover Character even if a legacy BP snapshot
  -- is inconsistent or points are later corrected downwards.
  v_level:=v_floor;
  IF v_level>=v_bp THEN RETURN v_level::smallint; END IF;

  -- Single indexed grouped lookup, not 19 queries × 13 characters per screen.
  -- First incomplete transition blocks every future visual level.
  SELECT coalesce(min(missing.step),v_bp) INTO v_level
  FROM (
    SELECT g.step
    FROM pg_catalog.generate_series(v_level,v_bp-1) AS g(step)
    LEFT JOIN private.buklod_character_evolution_items_v1 i
      ON i.user_id=p_user_id AND i.character_id=p_character_id
         AND i.from_level=g.step
         AND i.item_index<=private.buklod_character_evolution_item_count_v1(g.step)
    GROUP BY g.step
    HAVING count(i.item_index)<private.buklod_character_evolution_item_count_v1(g.step)
  ) missing;
  RETURN v_level::smallint;
END;
$$;

-- Existing core collectible APIs previously derived levels directly from BP.
-- Align the cosmetic-sync helper to the verified visual level so points alone
-- never manufacture future cosmetics. Historical owned cosmetics are untouched.
CREATE OR REPLACE FUNCTION private.buklod_character_collectible_progress_v1(
  p_user_id uuid,p_character_id text)
RETURNS TABLE(is_active boolean,character_level integer,points_on_character bigint,lifetime_points bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $
DECLARE
  v_character text:=lower(btrim(coalesce(p_character_id,'')));
  v_active text:='phan';
  v_baseline bigint:=0;
  v_lifetime bigint:=0;
  v_saved bigint:=0;
  v_earned bigint:=0;
BEGIN
  v_lifetime:=public.buklod_lifetime_points_for(p_user_id);
  SELECT s.character_id,greatest(coalesce(s.baseline_lifetime_points,0),0)
    INTO v_active,v_baseline
    FROM private.buklod_character_selection_v2 s WHERE s.user_id=p_user_id;
  v_active:=coalesce(v_active,'phan');
  v_baseline:=coalesce(v_baseline,0);
  IF v_character IS DISTINCT FROM v_active THEN
    RETURN QUERY SELECT false,1,0::bigint,v_lifetime;
    RETURN;
  END IF;
  SELECT coalesce(p.earned_points,0) INTO v_saved
    FROM private.buklod_character_progress_v3 p
    WHERE p.user_id=p_user_id AND p.character_id=v_character;
  v_earned:=coalesce(v_saved,0)+greatest(v_lifetime-v_baseline,0);
  RETURN QUERY SELECT true,
    private.buklod_character_evolution_level_v1(p_user_id,v_character,v_earned)::integer,
    v_earned,v_lifetime;
END;
$;

-- Getter is compatible with legacy clients, but the visible level now has server item gates.

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
  v_bp_eligible_level smallint := 1;
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
  v_level := private.buklod_character_evolution_level_v1(v_uid,v_character,v_earned);
  -- Protected legacy floors must never make the client's visible > eligible.
  v_bp_eligible_level := greatest(
    private.buklod_character_level_for_delta_v2(v_earned),v_level
  );

  select coalesce(jsonb_object_agg(p.character_id,
    private.buklod_character_evolution_level_v1(v_uid,p.character_id,
      p.earned_points + case when p.character_id=v_character then greatest(v_lifetime-v_baseline,0) else 0 end)), '{}'::jsonb)
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
    'character_bp_eligible_level',v_bp_eligible_level,
    'character_evolution_model','BP_ELIGIBILITY_VERIFIED_ITEMS_V1',
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

CREATE OR REPLACE FUNCTION public.get_my_buklod_character_evolution_v1()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_uid uuid:=(SELECT auth.uid());
  v_snapshot jsonb; v_char text; v_level integer; v_bp integer;
  v_floor integer:=1; v_required integer; v_i integer; v_have integer;
  v_target integer; v_items jsonb:='[]'::jsonb; v_owned boolean; v_metric text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  v_snapshot:=public.get_my_buklod_character_selection_v2();
  v_char:=v_snapshot->>'active_character_id';
  v_level:=(v_snapshot->>'character_level')::integer;
  v_bp:=(v_snapshot->>'character_bp_eligible_level')::integer;
  SELECT l.legacy_level INTO v_floor FROM private.buklod_character_evolution_legacy_v1 l
    WHERE l.user_id=v_uid AND l.character_id=v_char;
  v_floor:=coalesce(v_floor,1);
  v_required:=private.buklod_character_evolution_item_count_v1(v_level);
  IF v_level<20 THEN
    FOR v_i IN 1..v_required LOOP
      v_metric:=private.buklod_character_evolution_task_metric_v1(v_i);
      v_have:=private.buklod_character_evolution_task_count_v1(v_uid,v_char,v_i);
      v_target:=private.buklod_character_evolution_task_target_v1(v_floor,v_level,v_i);
      SELECT EXISTS(SELECT 1 FROM private.buklod_character_evolution_items_v1 i
        WHERE i.user_id=v_uid AND i.character_id=v_char AND i.from_level=v_level
          AND i.item_index=v_i) INTO v_owned;
      v_items:=v_items||jsonb_build_array(jsonb_build_object(
        'item_index',v_i,
        'asset_key',v_char || ':L' || pg_catalog.lpad(v_level::text,2,'0') || ':I' || v_i::text,
        'task_metric',v_metric,'verified_count',v_have,
        'required_count',v_target,'obtained',v_owned,'ready_to_claim',v_have>=v_target AND NOT v_owned,
        'alternative','Verified Kingdom first mastery (items 1-4); Show Faith not required'));
    END LOOP;
  END IF;
  RETURN jsonb_build_object('active_character_id',v_char,'visible_level',v_level,
    'bp_eligible_level',v_bp,'grandfathered_level',v_floor,'next_level',least(20,v_level+1),
    'bp_ready',v_bp>v_level,'required_item_count',v_required,'items',v_items,
    'model','BP_ELIGIBILITY_VERIFIED_ITEMS_V1');
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_my_buklod_character_evolution_item_v1(
  p_from_level integer,p_item_index integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_uid uuid:=(SELECT auth.uid()); v_state jsonb; v_char text; v_level integer;
  v_floor integer:=1; v_metric text; v_have integer; v_target integer;
  v_primary integer:=0; v_kingdom integer:=0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('buklod_character_switch_v3'),pg_catalog.hashtext(v_uid::text));
  v_state:=public.get_my_buklod_character_selection_v2();
  v_char:=v_state->>'active_character_id';
  -- An interrupted network response may retry a claim after that item has
  -- already advanced the Character. Return the latest state without duplicate rewards.
  IF p_from_level BETWEEN 1 AND 19 AND p_item_index BETWEEN 1 AND 5
     AND EXISTS (
       SELECT 1 FROM private.buklod_character_evolution_items_v1 i
       WHERE i.user_id=v_uid AND i.character_id=v_char
         AND i.from_level=p_from_level AND i.item_index=p_item_index
     ) THEN
     RETURN public.get_my_buklod_character_evolution_v1();
  END IF;
  v_level:=(v_state->>'character_level')::integer;
  IF p_from_level IS DISTINCT FROM v_level OR v_level>=20
    OR p_item_index IS NULL
    OR p_item_index NOT BETWEEN 1 AND private.buklod_character_evolution_item_count_v1(v_level)
    THEN RAISE EXCEPTION 'Item is not in the current Character evolution stage'; END IF;
  SELECT l.legacy_level INTO v_floor FROM private.buklod_character_evolution_legacy_v1 l
    WHERE l.user_id=v_uid AND l.character_id=v_char;
  v_floor:=coalesce(v_floor,1);
  v_metric:=private.buklod_character_evolution_task_metric_v1(p_item_index);
  v_have:=private.buklod_character_evolution_task_count_v1(v_uid,v_char,p_item_index);
  v_target:=private.buklod_character_evolution_task_target_v1(v_floor,v_level,p_item_index);
  IF v_have<v_target THEN RAISE EXCEPTION 'Verified Character item task is incomplete'; END IF;
  SELECT count(*) FILTER (WHERE e.metric_key=v_metric)::integer,
         count(*) FILTER (WHERE e.metric_key='character_kingdom_mastery')::integer
    INTO v_primary,v_kingdom
  FROM private.buklod_character_evolution_activity_v1 e
  WHERE e.user_id=v_uid AND e.character_id=v_char
    AND e.metric_key IN (v_metric,'character_kingdom_mastery');
  IF p_item_index=5 THEN v_kingdom:=0; END IF;
  -- Every receipt preserves how much of the qualifying evidence came from
  -- the native task versus optional verified Kingdom first-mastery.
  IF v_primary+v_kingdom<v_target THEN
    RAISE EXCEPTION 'Verified evidence changed; refresh Character tasks';
  END IF;
  INSERT INTO private.buklod_character_evolution_items_v1
    (user_id,character_id,from_level,item_index,verified_metric_key,
     observed_event_count,primary_event_count,kingdom_event_count)
  VALUES(v_uid,v_char,v_level,p_item_index,v_metric,v_have,v_primary,v_kingdom)
  ON CONFLICT(user_id,character_id,from_level,item_index) DO NOTHING;
  RETURN public.get_my_buklod_character_evolution_v1();
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_buklod_character_selection_v2() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.get_my_buklod_character_evolution_v1() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.claim_my_buklod_character_evolution_item_v1(integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_my_buklod_character_selection_v2() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_buklod_character_evolution_v1() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_my_buklod_character_evolution_item_v1(integer,integer) TO authenticated;
REVOKE ALL ON FUNCTION private.buklod_character_collectible_progress_v1(uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.buklod_character_evolution_task_count_v1(uuid,text,integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.buklod_character_evolution_level_v1(uuid,text,bigint) FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION private.buklod_character_evolution_capture_public_v1() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.buklod_character_evolution_capture_kingdom_v1() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.buklod_character_evolution_task_target_v1(integer,integer,integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.buklod_character_evolution_item_count_v1(integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.buklod_character_evolution_task_metric_v1(integer) FROM PUBLIC,anon,authenticated;
