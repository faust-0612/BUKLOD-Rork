-- Raise the Community photo ceiling from the legacy 5 MiB RPC limit to 20 MiB.
-- Keep v7 as the poster-aware entry point; it delegates original media validation to v5.
-- This changes only the per-photo product cap. Ownership, scope membership,
-- private bucket checks, MIME validation and the 1 GiB video limit stay intact.
DO $community_photo_quality$
DECLARE
  v_definition text;
BEGIN
  SELECT pg_get_functiondef(
    'public.set_buklod_post_media_v5(uuid,jsonb)'::regprocedure
  ) INTO v_definition;

  IF position('v_size>5242880' IN v_definition) = 0
     OR position('Each photo must be 5 MB or smaller' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Unexpected set_buklod_post_media_v5 definition; refusing an unsafe automatic rewrite';
  END IF;

  v_definition := replace(v_definition, 'v_size>5242880', 'v_size>20971520');
  v_definition := replace(
    v_definition,
    'Each photo must be 5 MB or smaller',
    'Each photo must be 20 MB or smaller'
  );

  EXECUTE v_definition;
END;
$community_photo_quality$;

-- Anonymous Community living posts have their own legacy 5 MiB RPC guard.
DO $anonymous_community_photo_quality$
DECLARE
  v_definition text;
BEGIN
  SELECT pg_get_functiondef(
    'public.create_buklod_community_living_post_v2(text,text,text,text,text,boolean,jsonb,jsonb,jsonb,text,text,bigint)'::regprocedure
  ) INTO v_definition;

  IF position('p_media_size_bytes>5242880' IN v_definition) = 0
     OR position('Anonymous photos are limited to 5 MB' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Unexpected anonymous Community RPC definition; refusing an unsafe automatic rewrite';
  END IF;

  v_definition := replace(v_definition, 'p_media_size_bytes>5242880', 'p_media_size_bytes>20971520');
  v_definition := replace(
    v_definition,
    'Anonymous photos are limited to 5 MB',
    'Anonymous photos are limited to 20 MB'
  );

  EXECUTE v_definition;
END;
$anonymous_community_photo_quality$;

COMMENT ON FUNCTION public.set_buklod_post_media_v5(uuid,jsonb) IS
  'Canonical Community media attachment validation. Photos up to 20 MiB; videos up to 1 GiB. Preserves author ownership, scope membership, private storage path validation and provider restrictions.';
