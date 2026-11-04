-- Raise every active and fallback Community photo RPC to the 25 MiB contract.
-- Updating v1/v4/v5/v6 prevents the client compatibility fallback chain from
-- reintroducing the retired 5 MiB cap or the old five-photo limit.
DO $community_photo_quality$
DECLARE
  v_name text;
  v_signature regprocedure;
  v_definition text;
BEGIN
  FOREACH v_name IN ARRAY ARRAY[
    'set_buklod_post_media_v1',
    'set_buklod_post_media_v4',
    'set_buklod_post_media_v5',
    'set_buklod_post_media_v6'
  ]
  LOOP
    v_signature := to_regprocedure(format('public.%I(uuid,jsonb)', v_name));
    IF v_signature IS NULL THEN
      RAISE EXCEPTION 'Required Community media RPC % is missing', v_name;
    END IF;

    SELECT pg_get_functiondef(v_signature) INTO v_definition;
    IF position('5242880' IN v_definition) = 0
       OR position('5 MB or smaller' IN v_definition) = 0 THEN
      RAISE EXCEPTION 'Unexpected definition for %; refusing an unsafe automatic rewrite', v_name;
    END IF;

    v_definition := replace(v_definition, '5242880', '26214400');
    v_definition := replace(v_definition, '5 MB or smaller', '25 MB or smaller');

    IF v_name = 'set_buklod_post_media_v1' THEN
      IF position('jsonb_array_length(media_array) > 5' IN v_definition) = 0
         OR position('media_index > 4' IN v_definition) = 0
         OR position('Maximum of 5 photos per post' IN v_definition) = 0 THEN
        RAISE EXCEPTION 'Unexpected legacy photo-count contract in %', v_name;
      END IF;
      v_definition := replace(v_definition, 'jsonb_array_length(media_array) > 5', 'jsonb_array_length(media_array) > 10');
      v_definition := replace(v_definition, 'media_index > 4', 'media_index > 9');
      v_definition := replace(v_definition, 'Maximum of 5 photos per post', 'Maximum of 10 photos per post');
    END IF;

    EXECUTE v_definition;
  END LOOP;
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

  IF position('p_media_size_bytes>26214400' IN v_definition) = 0
     OR position('Anonymous photos are limited to 25 MB' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Unexpected anonymous Community RPC definition; refusing an unsafe automatic rewrite';
  END IF;

  v_definition := replace(v_definition, 'p_media_size_bytes>5242880', 'p_media_size_bytes>26214400');
  v_definition := replace(
    v_definition,
    'Anonymous photos are limited to 5 MB',
    'Anonymous photos are limited to 20 MB'
  );

  EXECUTE v_definition;
END;
$anonymous_community_photo_quality$;

-- Dugtong and personal Connect direct-photo RPCs had independent 5 MiB gates.
DO $community_surface_photo_quality$
DECLARE
  v_dugtong text;
  v_direct text;
  v_bucket_limit bigint;
BEGIN
  SELECT pg_get_functiondef(
    'public.create_buklod_dugtong_v1(uuid,uuid,text,text,text,text,text,bigint)'::regprocedure
  ) INTO v_dugtong;
  IF position('p_media_size_bytes>5242880' IN v_dugtong)=0
     OR position('5 MB or smaller' IN v_dugtong)=0 THEN
    RAISE EXCEPTION 'Unexpected Dugtong photo contract; refusing an unsafe automatic rewrite';
  END IF;
  v_dugtong := replace(v_dugtong,'p_media_size_bytes>5242880','p_media_size_bytes>26214400');
  v_dugtong := replace(v_dugtong,'5 MB or smaller','25 MB or smaller');
  EXECUTE v_dugtong;

  SELECT pg_get_functiondef(
    'public.send_direct_message_v3(uuid,text,text,text,bigint,uuid)'::regprocedure
  ) INTO v_direct;
  IF position('5242880' IN v_direct)=0
     OR position('Photo exceeds 5 MB' IN v_direct)=0 THEN
    RAISE EXCEPTION 'Unexpected direct-message photo contract; refusing an unsafe automatic rewrite';
  END IF;
  v_direct := replace(v_direct,'5242880','26214400');
  v_direct := replace(v_direct,'Photo exceeds 5 MB','Photo exceeds 25 MB');
  EXECUTE v_direct;

  UPDATE storage.buckets
  SET file_size_limit=26214400
  WHERE id='direct-message-media' AND file_size_limit=5242880;

  SELECT file_size_limit INTO v_bucket_limit
  FROM storage.buckets WHERE id='direct-message-media';
  IF v_bucket_limit IS DISTINCT FROM 26214400 THEN
    RAISE EXCEPTION 'direct-message-media bucket must have a 25 MiB limit';
  END IF;
END;
$community_surface_photo_quality$;

COMMENT ON FUNCTION public.set_buklod_post_media_v5(uuid,jsonb) IS
  'Canonical Community media attachment validation. Photos up to 25 MiB; videos up to 1 GiB. Preserves author ownership, scope membership, private storage path validation and provider restrictions.';
