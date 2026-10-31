-- Read-only invariants: RGB thumbnail processing must not weaken Storage access.
DO $rgb_preview_guard$
BEGIN
  IF has_table_privilege('anon','public.community_wall_legacy_previews','SELECT')
    OR has_table_privilege('authenticated','private.buklod_legacy_preview_queue','UPDATE')
    OR has_function_privilege('authenticated','public.buklod_legacy_preview_claim_v1()','EXECUTE')
  THEN RAISE EXCEPTION 'RGB thumbnail worker security regression'; END IF;
END
$rgb_preview_guard$;
