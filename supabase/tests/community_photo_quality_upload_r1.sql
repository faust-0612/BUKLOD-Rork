-- Focused production schema contract for the 25 MiB Community photo ceiling.
DO $community_photo_quality_test$
DECLARE
  v_definition text;
BEGIN
  v_definition := pg_get_functiondef(
    'public.set_buklod_post_media_v5(uuid,jsonb)'::regprocedure
  );

  IF position('v_size>26214400' IN v_definition) = 0
     OR position('v_size>5242880' IN v_definition) > 0
     OR position('Each photo must be 25 MB or smaller' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Community photo RPC does not expose the canonical 25 MiB limit';
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

DO $anonymous_community_photo_quality_test$
DECLARE
  v_definition text;
BEGIN
  v_definition := pg_get_functiondef(
    'public.create_buklod_community_living_post_v2(text,text,text,text,text,boolean,jsonb,jsonb,jsonb,text,text,bigint)'::regprocedure
  );

  IF position('p_media_size_bytes>26214400' IN v_definition) = 0
     OR position('p_media_size_bytes>5242880' IN v_definition) > 0
     OR position('Anonymous photos are limited to 25 MB' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Anonymous Community RPC does not expose the canonical 25 MiB limit';
  END IF;

  IF position('Anonymous media must use an opaque BUKLOD path' IN v_definition) = 0
     OR position('Anonymous Community photo was not found' IN v_definition) = 0
     OR position('Authentication required' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Anonymous media privacy, existence or authentication checks regressed';
  END IF;
END;
$anonymous_community_photo_quality_test$;

DO $legacy_surface_photo_quality_test$
DECLARE
  v_name text;
  v_definition text;
BEGIN
  FOREACH v_name IN ARRAY ARRAY['set_buklod_post_media_v1','set_buklod_post_media_v4','set_buklod_post_media_v6']
  LOOP
    v_definition := pg_get_functiondef(to_regprocedure(format('public.%I(uuid,jsonb)',v_name)));
    IF position('26214400' IN v_definition)=0 OR position('5242880' IN v_definition)>0 THEN
      RAISE EXCEPTION 'Legacy fallback % does not use the 25 MiB limit',v_name;
    END IF;
    IF v_name='set_buklod_post_media_v1' AND position('Maximum of 10 photos per post' IN v_definition)=0 THEN
      RAISE EXCEPTION 'Legacy v1 fallback still limits posts to five photos';
    END IF;
  END LOOP;

  v_definition := pg_get_functiondef('public.create_buklod_dugtong_v1(uuid,uuid,text,text,text,text,text,bigint)'::regprocedure);
  IF position('p_media_size_bytes>26214400' IN v_definition)=0 OR position('5242880' IN v_definition)>0 THEN
    RAISE EXCEPTION 'Dugtong does not use the 25 MiB photo limit';
  END IF;

  v_definition := pg_get_functiondef('public.send_direct_message_v3(uuid,text,text,text,bigint,uuid)'::regprocedure);
  IF position('26214400' IN v_definition)=0 OR position('5242880' IN v_definition)>0 THEN
    RAISE EXCEPTION 'Personal Connect photo RPC does not use the 25 MiB limit';
  END IF;

  IF NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='direct-message-media' AND file_size_limit=26214400 AND NOT public) THEN
    RAISE EXCEPTION 'Private direct-message-media bucket does not allow 25 MiB uploads';
  END IF;
END;
$legacy_surface_photo_quality_test$;
