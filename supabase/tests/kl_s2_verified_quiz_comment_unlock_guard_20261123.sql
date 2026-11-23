-- Read-only staging-only verification. Run after the preceding three S2
-- migrations and 20261123224000. Never apply or run on live Season 1.
DO $checks$
DECLARE
 v_fn text;
BEGIN
 IF to_regprocedure('private.kl_s2_verified_comment_v1(uuid,uuid)') IS NULL
    OR to_regprocedure('private.kl_s2_previous_chapter_complete_v1(uuid,uuid)') IS NULL
    OR to_regprocedure('public.kl_s2_reader_progress_v1(integer)') IS NULL
    OR to_regprocedure('public.kl_quiz_begin_v1(uuid)') IS NULL
 THEN RAISE EXCEPTION 'Missing KL S2 quiz + comment verification RPC'; END IF;

 IF has_function_privilege('anon',
      'private.kl_s2_verified_comment_v1(uuid,uuid)','EXECUTE')
    OR has_function_privilege('authenticated',
      'private.kl_s2_verified_comment_v1(uuid,uuid)','EXECUTE')
    OR has_function_privilege('anon',
      'private.kl_s2_previous_chapter_complete_v1(uuid,uuid)','EXECUTE')
    OR has_function_privilege('anon',
      'public.kl_s2_reader_progress_v1(integer)','EXECUTE')
 THEN RAISE EXCEPTION 'Private progression / public RPC permissions incorrect'; END IF;

 SELECT pg_get_functiondef('private.kl_s2_verified_comment_v1(uuid,uuid)'::regprocedure)
 INTO v_fn;
 IF position('comment.author_id=p_user' IN v_fn)=0
    OR position('comment.parent_id IS NULL' IN v_fn)=0
    OR position('comment.deleted_at IS NULL' IN v_fn)=0
    OR position('comment.created_at>=attempt.verified_at' IN v_fn)=0
    OR position('session.completed_at IS NOT NULL' IN v_fn)=0
    OR position('attempt.verified_at IS NOT NULL' IN v_fn)=0
    OR position('BETWEEN 20 AND 500' IN v_fn)=0
 THEN RAISE EXCEPTION 'Qualified comment or verified quiz requirement bypassable'; END IF;

 SELECT pg_get_functiondef('private.kl_s2_previous_chapter_complete_v1(uuid,uuid)'::regprocedure)
 INTO v_fn;
 IF position('private.kl_s2_verified_comment_v1' IN v_fn)=0
    OR position('generate_series(1,30)' IN v_fn)=0
 THEN RAISE EXCEPTION 'Per chapter or cross-series comment unlock gate missing'; END IF;

 SELECT pg_get_functiondef('public.kl_post_comment_v1(uuid,text,uuid)'::regprocedure)
 INTO v_fn;
 IF position('private.kl_s2_previous_chapter_complete_v1' IN v_fn)=0
 THEN RAISE EXCEPTION 'Old client can post out-of-order KL chapter comments'; END IF;

 SELECT pg_get_functiondef('public.kl_quiz_begin_v1(uuid)'::regprocedure)
 INTO v_fn;
 IF position('NOT v_s2 OR EXISTS' IN v_fn)=0
    OR position('private.kl_s2_previous_chapter_complete_v1' IN v_fn)=0
 THEN RAISE EXCEPTION 'Legacy completed reading can bypass or block quiz verification'; END IF;

 SELECT pg_get_functiondef('private.kl_s2_comment_reward_v1()'::regprocedure)
 INTO v_fn;
 IF position('NEW.author_id' IN v_fn)=0
    OR position('NEW.created_at>=a.verified_at' IN v_fn)=0
    OR position('kl:comment:s2:' IN v_fn)=0
 THEN RAISE EXCEPTION 'Comment reward not tied to actual author and verified quiz'; END IF;
END $checks$;
