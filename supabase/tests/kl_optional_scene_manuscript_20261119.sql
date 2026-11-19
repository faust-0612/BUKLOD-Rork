-- Run on an isolated staging database AFTER applying the optional-scene
-- migration. Read-only introspection; does not create/release chapters.
DO $kl_optional_scene_guard$
DECLARE
  f text := pg_get_functiondef('public.kl_admin_prepare_preview_v1(uuid)'::regprocedure);
  n integer;
  valid integer;
  unique_n integer;
BEGIN
  IF position('v_total > 12' IN f) = 0
    OR position('v_valid <> v_total' IN f) = 0
    OR position('v_unique <> v_total' IN f) = 0
    OR position('count(DISTINCT m.paragraph_anchor)' IN f) = 0
    OR position('PERFORM public.kl_admin_unlock_unread_release_v1' IN f) = 0
    OR position('SECURITY DEFINER' IN f) = 0
    OR position('SET search_path TO' IN f) = 0
    OR position('auth.uid()' IN f) = 0
    OR position('system_admin' IN f) = 0
    OR position('is_active = true' IN f) = 0
    OR position('v_count < 2' IN f) <> 0 THEN
      RAISE EXCEPTION 'Optional-scene preview contract or access guard missing';
  END IF;
  IF has_function_privilege('anon', 'public.kl_admin_prepare_preview_v1(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Anonymous user can execute KL admin preview';
  END IF;

  -- PostgreSQL fixtures: zero media is eligible; one valid photo is eligible.
  SELECT count(*), count(*) FILTER (WHERE anchor IS NOT NULL
      AND length(btrim(anchor)) >= 12
      AND length('A unique scene passage here.') - length(replace('A unique scene passage here.', anchor, '')) = length(anchor)),
      count(DISTINCT anchor)
    INTO n, valid, unique_n
    FROM unnest(ARRAY[]::text[]) AS photos(anchor);
  IF n <> 0 OR valid <> 0 OR unique_n <> 0 THEN
    RAISE EXCEPTION 'Zero-scene manuscript fixture failed';
  END IF;
  SELECT count(*), count(*) FILTER (WHERE anchor IS NOT NULL
      AND length(btrim(anchor)) >= 12
      AND length('A unique scene passage here.') - length(replace('A unique scene passage here.', anchor, '')) = length(anchor)),
      count(DISTINCT anchor)
    INTO n, valid, unique_n
    FROM unnest(ARRAY['A unique scene passage here.']::text[]) AS photos(anchor);
  IF n <> 1 OR valid <> 1 OR unique_n <> 1 THEN
    RAISE EXCEPTION 'Single-scene manuscript fixture failed';
  END IF;
END;
$kl_optional_scene_guard$;
