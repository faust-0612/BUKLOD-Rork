-- SALIKSIK R2 — source-verified written Master +35 and full series +50.
-- Additive to R1. One immutable written challenge created only when all eight
-- source-grounded objective investigations have passed Admin publication review.
-- Full collection: Discover 4x10, Investigate 4x20, Master 1x35, Series 1x50.
-- The source owner/document remains private; review is restricted to System Admin.

CREATE TABLE IF NOT EXISTS public.saliksik_master_submissions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 investigation_id uuid NOT NULL REFERENCES public.saliksik_investigations(id),
 version int NOT NULL CHECK(version>=1),
 user_id uuid NOT NULL REFERENCES auth.users(id),
 scope_id uuid NOT NULL REFERENCES public.buklod_scopes(id),
 attempt_no int NOT NULL CHECK(attempt_no BETWEEN 1 AND 20),
 answers jsonb NOT NULL CHECK(jsonb_typeof(answers)='array' AND jsonb_array_length(answers)=3),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rework')),
 score int CHECK(score BETWEEN 0 AND 100),
 competency_scores jsonb,
 citations_verified boolean,
 reviewed_by uuid REFERENCES auth.users(id),
 feedback text,
 submitted_at timestamptz NOT NULL DEFAULT now(),
 reviewed_at timestamptz,
 UNIQUE(user_id,investigation_id,version,attempt_no)
);
CREATE UNIQUE INDEX IF NOT EXISTS saliksik_master_pending_uniq
 ON public.saliksik_master_submissions(user_id,investigation_id,version) WHERE status='pending';
CREATE INDEX IF NOT EXISTS saliksik_master_review_idx
 ON public.saliksik_master_submissions(submitted_at) WHERE status='pending';
ALTER TABLE public.saliksik_master_submissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.saliksik_master_submissions FROM PUBLIC,anon,authenticated;

-- Explicit competency score and citation-verification contract. Assessor must
-- document the precise reasoning and citation check. AI cannot issue credit.
CREATE OR REPLACE FUNCTION public.saliksik_master_score_v1(p_scores jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_key text; v_value text; v_score numeric;
BEGIN
 IF jsonb_typeof(p_scores)<>'object' OR
   (SELECT count(*) FROM jsonb_object_keys(p_scores))<>5 THEN
   RAISE EXCEPTION 'five_competency_scores_required'; END IF;
 FOREACH v_key IN ARRAY ARRAY['understanding','evidence','context','reasoning','transfer'] LOOP
   v_value:=p_scores->>v_key;
   IF v_value IS NULL OR v_value !~ '^[0-9]{1,3}$'
     OR v_value::int<0 OR v_value::int>100 THEN
     RAISE EXCEPTION 'invalid_master_competency_score: %',v_key; END IF;
 END LOOP;
 v_score:=(p_scores->>'understanding')::numeric*0.20+
          (p_scores->>'evidence')::numeric*0.25+
          (p_scores->>'context')::numeric*0.20+
          (p_scores->>'reasoning')::numeric*0.25+
          (p_scores->>'transfer')::numeric*0.10;
 RETURN jsonb_build_object('score',round(v_score)::int,
   'core_pass', ((p_scores->>'evidence')::int>=70
    AND (p_scores->>'context')::int>=70 AND (p_scores->>'reasoning')::int>=70));
END $fn$;

-- R1 publication is overridden only within the isolated SALIKSIK namespace.
CREATE OR REPLACE FUNCTION public.saliksik_admin_publish_v1(p_collection_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE c public.saliksik_collections%ROWTYPE; v_count int;
 v_refs jsonb; v_excerpts text; v_master uuid;
 v_master_text text:=
 'Write three independent essays in your own words. 1) Present a clear thesis and substantiate it using exact cited Scripture with surrounding context. 2) Present the strongest reasonable objection fairly, then address it with accurate source evidence and logical reasoning. 3) Apply the thesis to a new realistic situation with a careful explanation, including limitations. The review evaluates understanding (20%), evidence (25%), context (20%), reasoning (25%), and transfer (10%), not denominational agreement. A verified score of at least 80 and 70 each in evidence, context and reasoning is required. False or unverified biblical citations cannot pass. System Admin checks the original manuscript, arguments and citations before awarding +35.';
BEGIN
 IF NOT public.is_system_admin() THEN RAISE EXCEPTION 'admin_required' USING ERRCODE='42501'; END IF;
 SELECT * INTO c FROM public.saliksik_collections WHERE id=p_collection_id FOR UPDATE;
 IF NOT FOUND OR c.status<>'draft' THEN RAISE EXCEPTION 'collection_not_draft'; END IF;
 SELECT count(*) INTO v_count FROM public.saliksik_investigations i
   JOIN public.saliksik_question_keys k ON k.investigation_id=i.id
   WHERE i.collection_id=c.id AND i.status='draft' AND i.tier IN('discover','investigate');
 IF v_count<>8 OR EXISTS (
    SELECT 1 FROM public.saliksik_investigations WHERE collection_id=c.id AND tier='master')
   OR (SELECT count(*) FROM public.saliksik_investigations
      WHERE collection_id=c.id AND tier='discover')<>4
   OR (SELECT count(*) FROM public.saliksik_investigations
      WHERE collection_id=c.id AND tier='investigate')<>4
 THEN RAISE EXCEPTION 'eight_verified_objective_investigations_required'; END IF;
 SELECT left(string_agg(left(i.source_excerpt,1250),E'\n\n' ORDER BY i.sequence),11500)
  INTO v_excerpts FROM public.saliksik_investigations i WHERE i.collection_id=c.id;
 SELECT coalesce(jsonb_agg(DISTINCT x.value),'[]'::jsonb) INTO v_refs
 FROM public.saliksik_investigations i CROSS JOIN LATERAL jsonb_array_elements(i.scripture_refs) x(value)
 WHERE i.collection_id=c.id;
 IF length(coalesce(v_excerpts,''))<150 THEN RAISE EXCEPTION 'source_evidence_missing'; END IF;
 UPDATE public.saliksik_investigations SET status='published',published_at=now()
  WHERE collection_id=c.id AND status='draft';
 INSERT INTO public.saliksik_investigations(
   collection_id,sequence,tier,title,summary,lesson_text,source_excerpt,scripture_refs,
   status,published_at)
 VALUES(c.id,9,'master',left('MASTER: '||c.title,180),
   'Demonstrate authentic Biblical comprehension using independently written, cited reasoning.',
   v_master_text,v_excerpts,v_refs,'published',now())
 RETURNING id INTO v_master;
 UPDATE public.saliksik_collections SET status='published',published_at=now() WHERE id=c.id;
 RETURN jsonb_build_object('ok',true,'published_count',9,'master_investigation_id',v_master);
END $fn$;

CREATE OR REPLACE FUNCTION public.saliksik_catalog_v1(p_scope_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_user uuid:=auth.uid();
BEGIN
 IF v_user IS NULL OR NOT public.buklod_user_is_active_scope_member(p_scope_id,v_user)
 OR NOT EXISTS(SELECT 1 FROM public.buklod_scopes WHERE id=p_scope_id
   AND scope_type='CLUSTER' AND status='ACTIVE')
 THEN RAISE EXCEPTION 'active_cluster_membership_required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.saliksik_rollout WHERE id AND member_enabled)
 THEN RETURN '[]'::jsonb; END IF;
 RETURN coalesce((
  SELECT jsonb_agg(jsonb_build_object('id',i.id,'collection_id',i.collection_id,
    'collection_title',c.title,'title',i.title,'summary',i.summary,'tier',i.tier,
    'points',CASE i.tier WHEN 'discover' THEN 10 WHEN 'investigate' THEN 20 ELSE 35 END,
    'scripture_refs',i.scripture_refs,
    'completed',EXISTS(SELECT 1 FROM public.saliksik_mastery m
      WHERE m.user_id=v_user AND m.investigation_id=i.id AND m.version=i.version))
    ORDER BY c.published_at,i.sequence)
  FROM public.saliksik_investigations i JOIN public.saliksik_collections c ON c.id=i.collection_id
  WHERE c.status='published' AND i.status='published'
 ),'[]'::jsonb);
END $fn$;

CREATE OR REPLACE FUNCTION public.saliksik_detail_v1(p_scope_id uuid,p_investigation_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_user uuid:=auth.uid();
BEGIN
 IF v_user IS NULL OR NOT public.buklod_user_is_active_scope_member(p_scope_id,v_user)
 OR NOT EXISTS(SELECT 1 FROM public.buklod_scopes
  WHERE id=p_scope_id AND scope_type='CLUSTER' AND status='ACTIVE')
 THEN RAISE EXCEPTION 'active_cluster_membership_required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.saliksik_rollout WHERE id AND member_enabled)
 THEN RAISE EXCEPTION 'saliksik_not_released'; END IF;
 RETURN coalesce((
 SELECT jsonb_build_object('id',i.id,'title',i.title,'summary',i.summary,
 'tier',i.tier,'lesson_text',i.lesson_text,'scripture_refs',i.scripture_refs,
 'author_disclosure',c.author_disclosure)
 FROM public.saliksik_investigations i JOIN public.saliksik_collections c
 ON c.id=i.collection_id WHERE i.id=p_investigation_id AND i.status='published'
 AND c.status='published'
 ),'{}'::jsonb);
END $fn$;

CREATE OR REPLACE FUNCTION public.saliksik_master_get_v1(p_investigation_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_user uuid:=auth.uid();
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'sign_in_required'; END IF;
 RETURN coalesce((
  SELECT jsonb_build_object('id',a.id,'status',a.status,'score',a.score,
    'competencies',a.competency_scores,'feedback',a.feedback,
    'submitted_at',a.submitted_at,'reviewed_at',a.reviewed_at)
  FROM public.saliksik_master_submissions a
  WHERE a.user_id=v_user AND a.investigation_id=p_investigation_id
  ORDER BY a.submitted_at DESC LIMIT 1
 ),'{}'::jsonb);
END $fn$;

CREATE OR REPLACE FUNCTION public.saliksik_master_submit_v1(
 p_scope_id uuid,p_investigation_id uuid,p_answers jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_user uuid:=auth.uid(); i public.saliksik_investigations%ROWTYPE;
 v_count int; v_attempt int; v_id uuid;
BEGIN
 IF v_user IS NULL OR NOT public.buklod_user_is_active_scope_member(p_scope_id,v_user)
 OR NOT EXISTS(SELECT 1 FROM public.buklod_scopes
  WHERE id=p_scope_id AND scope_type='CLUSTER' AND status='ACTIVE')
 THEN RAISE EXCEPTION 'active_cluster_membership_required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.saliksik_rollout WHERE id AND member_enabled)
 THEN RAISE EXCEPTION 'saliksik_not_released'; END IF;
 SELECT * INTO i FROM public.saliksik_investigations
 WHERE id=p_investigation_id AND tier='master' AND status='published';
 IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.saliksik_collections
   WHERE id=i.collection_id AND status='published') THEN RAISE EXCEPTION 'master_not_published'; END IF;
 SELECT count(*) INTO v_count FROM public.saliksik_mastery m
 JOIN public.saliksik_investigations r ON r.id=m.investigation_id
 WHERE m.user_id=v_user AND r.collection_id=i.collection_id AND r.tier<>'master'
 AND m.version=r.version AND r.status='published';
 IF v_count<>8 THEN RAISE EXCEPTION 'complete_all_eight_investigations_first'; END IF;
 IF jsonb_typeof(p_answers)<>'array' OR jsonb_array_length(p_answers)<>3
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_answers) a
    WHERE jsonb_typeof(a.value)<>'string'
       OR length(btrim(a.value #>> '{}')) NOT BETWEEN 220 AND 4000)
 OR (SELECT count(DISTINCT lower(btrim(x.value #>> '{}')))
     FROM jsonb_array_elements(p_answers) x)<>3
 THEN RAISE EXCEPTION 'three_distinct_substantive_written_responses_required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(v_user::text||i.id::text,1));
 IF EXISTS (SELECT 1 FROM public.saliksik_mastery m
 WHERE m.user_id=v_user AND m.investigation_id=i.id AND m.version=i.version)
 THEN RETURN jsonb_build_object('completed',true,'points',0); END IF;
 IF EXISTS (SELECT 1 FROM public.saliksik_master_submissions a
 WHERE a.user_id=v_user AND a.investigation_id=i.id AND a.version=i.version
 AND a.status='pending') THEN
 RETURN jsonb_build_object('pending',true,'points',0); END IF;
 SELECT coalesce(max(attempt_no),0)+1 INTO v_attempt
 FROM public.saliksik_master_submissions a WHERE a.user_id=v_user
 AND a.investigation_id=i.id AND a.version=i.version;
 IF v_attempt>20 THEN RAISE EXCEPTION 'master_submission_limit'; END IF;
 INSERT INTO public.saliksik_master_submissions(
   investigation_id,version,user_id,scope_id,attempt_no,answers)
 VALUES(i.id,i.version,v_user,p_scope_id,v_attempt,p_answers)
 RETURNING id INTO v_id;
 RETURN jsonb_build_object('pending',true,'submission_id',v_id,'points',0);
END $fn$;

CREATE OR REPLACE FUNCTION public.saliksik_admin_master_queue_v1()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF NOT public.is_system_admin() THEN RAISE EXCEPTION 'admin_required' USING ERRCODE='42501'; END IF;
 RETURN coalesce((
  SELECT jsonb_agg(jsonb_build_object(
    'id',a.id,'user_id',a.user_id,'submitted_at',a.submitted_at,
    'investigation_title',i.title,'answers',a.answers,
    'scripture_refs',i.scripture_refs,'source_excerpt',i.source_excerpt)
    ORDER BY a.submitted_at)
  FROM (SELECT * FROM public.saliksik_master_submissions
    WHERE status='pending' ORDER BY submitted_at LIMIT 50) a
  JOIN public.saliksik_investigations i ON i.id=a.investigation_id
 ),'[]'::jsonb);
END $fn$;

CREATE OR REPLACE FUNCTION public.saliksik_admin_master_review_v1(
 p_submission_id uuid,p_scores jsonb,p_citations_verified boolean,p_feedback text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE a public.saliksik_master_submissions%ROWTYPE;
 i public.saliksik_investigations%ROWTYPE;
 v_grade jsonb; v_pass boolean; v_id uuid; v_new boolean;
 v_required int; v_earned int; v_series uuid; v_pts int:=0; v_collection_version int;
BEGIN
 IF NOT public.is_system_admin() THEN RAISE EXCEPTION 'admin_required' USING ERRCODE='42501'; END IF;
 IF length(btrim(coalesce(p_feedback,''))) NOT BETWEEN 80 AND 2000
 THEN RAISE EXCEPTION 'detailed_written_feedback_required'; END IF;
 v_grade:=public.saliksik_master_score_v1(p_scores);
 SELECT * INTO a FROM public.saliksik_master_submissions WHERE id=p_submission_id FOR UPDATE;
 IF NOT FOUND OR a.status<>'pending' THEN RAISE EXCEPTION 'master_submission_not_pending'; END IF;
 IF a.user_id=auth.uid() THEN RAISE EXCEPTION 'self_review_forbidden'; END IF;
 IF NOT public.buklod_user_is_active_scope_member(a.scope_id,a.user_id)
 OR NOT EXISTS(SELECT 1 FROM public.saliksik_rollout WHERE id AND member_enabled)
 THEN RAISE EXCEPTION 'member_inactive_or_feature_not_released'; END IF;
 SELECT * INTO i FROM public.saliksik_investigations
 WHERE id=a.investigation_id AND tier='master' AND status='published';
 IF NOT FOUND THEN RAISE EXCEPTION 'master_content_unavailable'; END IF;
 v_pass:=((v_grade->>'score')::int>=80 AND (v_grade->>'core_pass')::boolean
 AND coalesce(p_citations_verified,false));
 IF v_pass AND NOT EXISTS(SELECT 1 FROM public.buklod_point_rules r
 WHERE r.activity_type='saliksik_master' AND r.is_active
 AND r.base_points=35 AND r.max_points_per_event>=35)
 THEN RAISE EXCEPTION 'master_point_rule_unavailable'; END IF;
 IF v_pass AND NOT EXISTS(SELECT 1 FROM public.buklod_point_rules r
 WHERE r.activity_type='saliksik_series' AND r.is_active
 AND r.base_points=50 AND r.max_points_per_event>=50)
 THEN RAISE EXCEPTION 'series_point_rule_unavailable'; END IF;
 UPDATE public.saliksik_master_submissions SET status=CASE WHEN v_pass THEN 'approved' ELSE 'rework' END,
 score=(v_grade->>'score')::int,competency_scores=p_scores,
 citations_verified=coalesce(p_citations_verified,false),feedback=btrim(p_feedback),
 reviewed_by=auth.uid(),reviewed_at=now() WHERE id=a.id;
 IF v_pass THEN
  INSERT INTO public.saliksik_mastery(user_id,investigation_id,version)
  VALUES(a.user_id,i.id,i.version)
  ON CONFLICT DO NOTHING RETURNING true INTO v_new;
  IF coalesce(v_new,false) THEN
   INSERT INTO public.buklod_points_ledger(
    user_id,direction,points,activity_type,source_key,source_id,description)
   VALUES(a.user_id,'credit',35,'saliksik_master',
     'saliksik:'||i.id||':v'||i.version,i.id,
     'SALIKSIK written mastery: verified citations and independent Admin rubric')
   ON CONFLICT(user_id,source_key) DO NOTHING RETURNING id INTO v_id;
   UPDATE public.saliksik_mastery SET points_ledger_id=v_id
    WHERE user_id=a.user_id AND investigation_id=i.id AND version=i.version;
   IF v_id IS NOT NULL THEN v_pts:=35; END IF;
  END IF;
  SELECT count(*) INTO v_required FROM public.saliksik_investigations r
   WHERE r.collection_id=i.collection_id AND r.status='published';
  SELECT count(*) INTO v_earned FROM public.saliksik_mastery m
   JOIN public.saliksik_investigations r ON r.id=m.investigation_id
   WHERE m.user_id=a.user_id AND r.collection_id=i.collection_id
    AND m.version=r.version AND r.status='published';
  IF v_required=9 AND v_earned=9 THEN
    SELECT version INTO v_collection_version FROM public.saliksik_collections WHERE id=i.collection_id;
    v_new:=false;
    INSERT INTO public.saliksik_series_mastery(user_id,collection_id,version)
    SELECT a.user_id,c.id,c.version
    FROM public.saliksik_collections c WHERE c.id=i.collection_id AND c.status='published'
    ON CONFLICT DO NOTHING RETURNING true INTO v_new;
    IF coalesce(v_new,false) THEN
      INSERT INTO public.buklod_points_ledger(
        user_id,direction,points,activity_type,source_key,source_id,description)
      VALUES(a.user_id,'credit',50,'saliksik_series',
       'saliksik:series:'||i.collection_id||':v'||v_collection_version,i.collection_id,
       'SALIKSIK nine-part verified source and written mastery')
      ON CONFLICT(user_id,source_key) DO NOTHING RETURNING id INTO v_series;
      UPDATE public.saliksik_series_mastery SET points_ledger_id=v_series
       WHERE user_id=a.user_id AND collection_id=i.collection_id AND version=v_collection_version;
    END IF;
  END IF;
 END IF;
 RETURN jsonb_build_object('approved',v_pass,'score',v_grade->>'score',
    'core_pass',v_grade->>'core_pass','citations_verified',coalesce(p_citations_verified,false),
    'points',v_pts,'series_points',CASE WHEN v_series IS NULL THEN 0 ELSE 50 END,
    'claim_state',CASE WHEN v_pts>0 OR v_series IS NOT NULL THEN 'pending' ELSE null END);
END $fn$;

-- Written mastery becomes available only via the still-false member rollout
-- after a System Admin has published eight source-checked objective lessons.
UPDATE public.buklod_point_rules
 SET is_active=true,notes='Human-verified written argument, citations and competency rubric; one +35 per approved immutable Master.'
 WHERE activity_type='saliksik_master'
 AND base_points=35 AND max_points_per_event>=35;

DO $grant$
DECLARE f record;
BEGIN
 FOR f IN SELECT p.proname,pg_get_function_identity_arguments(p.oid) args
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN(
  'saliksik_master_score_v1','saliksik_admin_publish_v1','saliksik_catalog_v1',
  'saliksik_detail_v1','saliksik_master_get_v1','saliksik_master_submit_v1',
  'saliksik_admin_master_queue_v1','saliksik_admin_master_review_v1'
 ) LOOP
   EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC,anon,authenticated',f.proname,f.args);
   EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated',f.proname,f.args);
 END LOOP;
END $grant$;
