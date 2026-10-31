-- Read-only security and schema contract for the released KL comment endpoints.
DO $assert$
BEGIN
  IF to_regprocedure('public.kl_post_comment_v1(uuid,text,uuid)') IS NULL
     OR to_regprocedure('public.kl_reader_comments_v2(uuid,integer)') IS NULL
     OR to_regprocedure('public.kl_list_readers_v1(uuid)') IS NULL THEN
    RAISE EXCEPTION 'KL comment or reader RPC missing';
  END IF;
  IF has_function_privilege('anon','public.kl_post_comment_v1(uuid,text,uuid)','EXECUTE')
     OR has_function_privilege('anon','public.kl_reader_comments_v2(uuid,integer)','EXECUTE')
     OR has_function_privilege('anon','public.kl_list_readers_v1(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'KL comment endpoints must deny anonymous access';
  END IF;
  IF NOT has_function_privilege('authenticated','public.kl_post_comment_v1(uuid,text,uuid)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.kl_reader_comments_v2(uuid,integer)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.kl_list_readers_v1(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'KL endpoints must allow authenticated readers';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE oid='public.kl_episode_comments'::regclass AND relrowsecurity
  ) THEN
    RAISE EXCEPTION 'KL comments table must retain RLS';
  END IF;
  IF position('release_at' in pg_get_functiondef('public.kl_post_comment_v1(uuid,text,uuid)'::regprocedure)) = 0
     OR position('release_at' in pg_get_functiondef('public.kl_reader_comments_v2(uuid,integer)'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'KL comments must be restricted to released chapters';
  END IF;
END
$assert$;
