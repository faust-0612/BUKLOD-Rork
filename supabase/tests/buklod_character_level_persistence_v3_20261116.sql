-- Read-only post-migration contract regression. Safe against live data and does not switch any user.
DO $character_v3_contract$
DECLARE v_getter text;
DECLARE v_setter text;
BEGIN
  IF to_regclass('private.buklod_character_progress_v3') IS NULL THEN
    RAISE EXCEPTION 'Per-character progression table missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid='private.buklod_character_progress_v3'::regclass AND relrowsecurity
  ) THEN
    RAISE EXCEPTION 'Per-character progress RLS disabled';
  END IF;
  IF has_table_privilege('anon','private.buklod_character_progress_v3','SELECT')
     OR has_table_privilege('authenticated','private.buklod_character_progress_v3','SELECT')
     OR has_table_privilege('authenticated','private.buklod_character_progress_v3','UPDATE') THEN
    RAISE EXCEPTION 'Per-character progress directly writable/readable from client roles';
  END IF;
  IF has_function_privilege('anon','public.set_my_buklod_character_active_v2(text)','EXECUTE')
     OR has_function_privilege('anon','public.get_my_buklod_character_selection_v2()','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.set_my_buklod_character_active_v2(text)','EXECUTE') THEN
    RAISE EXCEPTION 'Character RPC grants incorrect';
  END IF;
  IF private.buklod_character_level_for_delta_v2(522) <> 5
     OR private.buklod_character_level_for_delta_v2(0) <> 1 THEN
    RAISE EXCEPTION 'Character thresholds changed';
  END IF;
  SELECT pg_get_functiondef('public.get_my_buklod_character_selection_v2()'::regprocedure)
  INTO v_getter;
  SELECT pg_get_functiondef('public.set_my_buklod_character_active_v2(text)'::regprocedure)
  INTO v_setter;
  IF position('PER_CHARACTER_PERSISTED_V3' in v_getter)=0
    OR position('buklod_character_progress_v3' in v_getter)=0
    OR position('v_previous = v_character' in v_setter)=0
    OR position('pg_advisory_xact_lock' in v_setter)=0 THEN
    RAISE EXCEPTION 'Production Character per-user checkpoint contract regressed';
  END IF;
END;
$character_v3_contract$;
