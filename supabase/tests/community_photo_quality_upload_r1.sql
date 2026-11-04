-- Focused production schema contract for the 20 MiB Community photo ceiling.
DO $community_photo_quality_test$
DECLARE
  v_definition text;
BEGIN
  v_definition := pg_get_functiondef(
    'public.set_buklod_post_media_v5(uuid,jsonb)'::regprocedure
  );

  IF position('v_size>20971520' IN v_definition) = 0
     OR position('v_size>5242880' IN v_definition) > 0
     OR position('Each photo must be 20 MB or smaller' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Community photo RPC does not expose the canonical 20 MiB limit';
  END IF;

  -- Confirm the RPC's authorization checks remain present after the narrow rewrite.
  IF position('Only the post author may attach media' IN v_definition) = 0
     OR position('buklod_scope_social_can_access' IN v_definition) = 0
     OR position('Invalid community media path' IN v_definition) = 0
     OR position('Wall video must be 1 GB or smaller' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Community media authorization or video contract regressed';
  END IF;
END;
$community_photo_quality_test$;
