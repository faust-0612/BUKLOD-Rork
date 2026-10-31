-- Read-only production boundary test; no data or policy writes.
DO $preview_guard$
BEGIN
  IF has_table_privilege('anon','public.community_wall_legacy_previews','SELECT')
    OR has_table_privilege('authenticated','private.buklod_legacy_preview_queue','UPDATE')
    OR has_function_privilege('authenticated','public.buklod_legacy_preview_claim_v1()','EXECUTE')
    OR has_function_privilege('anon','public.buklod_legacy_preview_worker_auth_v1(text)','EXECUTE')
  THEN
    RAISE EXCEPTION 'Legacy preview authorization boundary failed';
  END IF;
END;
$preview_guard$;
