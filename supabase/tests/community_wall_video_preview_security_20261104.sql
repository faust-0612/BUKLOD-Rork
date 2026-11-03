-- Security and compatibility assertions for durable Community Wall video posters.
DO $video_preview_guard$
DECLARE
  v_bucket_public boolean;
  v_v5_definition text;
  v_register_definition text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.community_posts cp
    WHERE cp.deleted_at IS NULL
      AND cp.media_path IS NOT NULL
      AND cp.media_mime_type LIKE 'video/%'
      AND NOT EXISTS (
        SELECT 1 FROM public.community_post_media m
        WHERE m.post_id = cp.id AND m.media_path = cp.media_path
      )
  ) THEN RAISE EXCEPTION 'Legacy single-video posts must be represented in the shared media pipeline'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='community_wall_video_previews'
      AND c.relrowsecurity
  ) THEN RAISE EXCEPTION 'Video preview table must have RLS enabled'; END IF;

  IF has_table_privilege('anon','public.community_wall_video_previews','SELECT')
     OR has_table_privilege('authenticated','public.community_wall_video_previews','INSERT')
     OR has_table_privilege('authenticated','public.community_wall_video_previews','UPDATE')
     OR has_table_privilege('authenticated','public.community_wall_video_previews','DELETE')
  THEN RAISE EXCEPTION 'Video preview table exposes unsafe direct access'; END IF;

  IF NOT has_table_privilege('authenticated','public.community_wall_video_previews','SELECT')
     OR NOT has_function_privilege('authenticated','public.set_buklod_post_media_v6(uuid,jsonb)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.register_buklod_video_preview_v1(uuid,smallint,text,integer)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.get_buklod_post_media_v4(uuid[])','EXECUTE')
  THEN RAISE EXCEPTION 'Authenticated video preview read/attachment contract is missing'; END IF;

  SELECT pg_get_functiondef('public.register_buklod_video_preview_v1(uuid,smallint,text,integer)'::regprocedure)
  INTO v_register_definition;
  IF position('Only the post author may backfill' in v_register_definition)=0
  THEN RAISE EXCEPTION 'Lazy preview backfill must be restricted to the post author'; END IF;

  IF has_function_privilege('anon','public.set_buklod_post_media_v6(uuid,jsonb)','EXECUTE')
     OR has_function_privilege('anon','public.register_buklod_video_preview_v1(uuid,smallint,text,integer)','EXECUTE')
     OR has_function_privilege('anon','public.get_buklod_post_media_v4(uuid[])','EXECUTE')
  THEN RAISE EXCEPTION 'Anonymous video preview RPC access must remain denied'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname='buklod_wall_video_preview_object_read' AND cmd='SELECT'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname='buklod_wall_video_preview_delete_guard' AND cmd='DELETE'
      AND permissive='RESTRICTIVE'
  ) THEN RAISE EXCEPTION 'Private video poster Storage policies are missing'; END IF;

  SELECT b.public INTO v_bucket_public
  FROM storage.buckets b WHERE b.id='community-media';
  IF coalesce(v_bucket_public,true) THEN
    RAISE EXCEPTION 'Community media bucket must remain private';
  END IF;

  SELECT pg_get_functiondef('public.set_buklod_post_media_v5(uuid,jsonb)'::regprocedure)
  INTO v_v5_definition;
  IF position('video/mp4' in v_v5_definition)=0
     OR position('buklod_scope_social_can_access' in v_v5_definition)=0
  THEN RAISE EXCEPTION 'Scoped video attachment must retain membership checks'; END IF;
END
$video_preview_guard$;
