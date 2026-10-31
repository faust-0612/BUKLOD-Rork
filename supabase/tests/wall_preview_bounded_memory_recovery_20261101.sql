-- Read-only legacy preview recovery guard.
-- Do not weaken existing authorization or expose failed preview jobs.
DO $wall_memory_guard$
BEGIN
 IF has_table_privilege('anon','public.community_wall_legacy_previews','SELECT')
    OR has_table_privilege('authenticated','private.buklod_legacy_preview_queue','UPDATE')
    OR has_function_privilege('authenticated','public.buklod_legacy_preview_claim_v1()','EXECUTE')
 THEN RAISE EXCEPTION 'Legacy preview recovery authorization regression'; END IF;
END
$wall_memory_guard$;

-- 2026-11-01 one-image controlled pilot with 168 MB did not recover memory-limit
-- preview; production worker rolled back and requeue disabled. No write needed.
