-- SALIKSIK R4: independent AI-assisted, source-verified, server-transactional
-- written research grading. AI never writes Points or academic documents directly.
CREATE TABLE public.saliksik_auto_review_jobs(
 submission_id uuid PRIMARY KEY REFERENCES public.saliksik_master_submissions(id),
 user_id uuid NOT NULL REFERENCES auth.users(id),
 status text NOT NULL DEFAULT 'queued' CHECK(status IN('queued','processing','settled','held')),
 lease_token uuid,
 lease_expires_at timestamptz,
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 6),
 reviewer_a jsonb,
 reviewer_b jsonb,
 evidence_checks jsonb,
 model_versions jsonb,
 reviewed_at timestamptz,
 last_error text,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.saliksik_auto_review_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.saliksik_auto_review_jobs FROM PUBLIC,anon,authenticated;
CREATE TABLE public.saliksik_research_academic_evidence(
 user_id uuid NOT NULL REFERENCES auth.users(id),
 collection_id uuid NOT NULL REFERENCES public.saliksik_collections(id),
 collection_version int NOT NULL,
 master_submission_id uuid NOT NULL REFERENCES public.saliksik_master_submissions(id),
 research_method text NOT NULL,
 scripture_anchor text NOT NULL,
 rubric_scores jsonb NOT NULL,
 evidence_snapshot_hash text NOT NULL CHECK(evidence_snapshot_hash ~ '^[0-9a-f]{32}$'),
 verified_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,collection_id,collection_version)
);
ALTER TABLE public.saliksik_research_academic_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.saliksik_research_academic_evidence FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.saliksik_auto_master_lease_r4(
 p_submission_id uuid,p_user_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE a public.saliksik_master_submissions%ROWTYPE;
 j public.saliksik_auto_review_jobs%ROWTYPE;
 i public.saliksik_investigations%ROWTYPE;
 c public.saliksik_collections%ROWTYPE;
 v_token uuid:=gen_random_uuid();
BEGIN
 IF NOT public.saliksik_internal_service_r4() THEN
   RAISE EXCEPTION 'service_role_required' USING ERRCODE='42501'; END IF;
 SELECT * INTO a FROM public.saliksik_master_submissions
  WHERE id=p_submission_id FOR UPDATE;
 IF NOT FOUND OR a.user_id<>p_user_id THEN
   RAISE EXCEPTION 'submission_not_owned' USING ERRCODE='42501'; END IF;
 IF a.status='approved' THEN RETURN jsonb_build_object('completed',true); END IF;
 IF a.status<>'pending' THEN RAISE EXCEPTION 'submission_not_pending'; END IF;
 IF NOT public.buklod_user_is_active_scope_member(a.scope_id,a.user_id)
 OR NOT EXISTS(SELECT 1 FROM public.saliksik_rollout WHERE id AND member_enabled)
 THEN RAISE EXCEPTION 'member_or_rollout_inactive'; END IF;
 SELECT * INTO i FROM public.saliksik_investigations
 WHERE id=a.investigation_id AND status='published' AND tier='master';
 IF NOT FOUND OR i.version<>a.version THEN RAISE EXCEPTION 'master_version_changed'; END IF;
 SELECT * INTO c FROM public.saliksik_collections WHERE id=i.collection_id
  AND status='published' AND source_mode='CANONICAL_BIBLE_CORPUS';
 IF NOT FOUND THEN RAISE EXCEPTION 'not_auto_research_collection'; END IF;
 IF (SELECT count(*) FROM public.saliksik_mastery m
 JOIN public.saliksik_investigations x ON x.id=m.investigation_id
 WHERE m.user_id=a.user_id AND x.collection_id=i.collection_id
 AND x.tier IN('discover','investigate') AND x.status='published' AND m.version=x.version)<>8
 THEN RAISE EXCEPTION 'eight_objective_prerequisites_required'; END IF;
 INSERT INTO public.saliksik_auto_review_jobs(submission_id,user_id)
 VALUES(a.id,a.user_id) ON CONFLICT DO NOTHING;
 SELECT * INTO j FROM public.saliksik_auto_review_jobs
  WHERE submission_id=a.id FOR UPDATE;
 IF j.status='settled' THEN RETURN jsonb_build_object('completed',true); END IF;
 IF j.status='held' OR j.attempts>=6 THEN RAISE EXCEPTION 'auto_review_held'; END IF;
 IF j.status='processing' AND j.lease_expires_at>now() THEN
  RETURN jsonb_build_object('busy',true); END IF;
 UPDATE public.saliksik_auto_review_jobs SET status='processing',
  lease_token=v_token,lease_expires_at=now()+interval '3 minutes',
  attempts=attempts+1 WHERE submission_id=a.id;
 RETURN jsonb_build_object('token',v_token,'submission_id',a.id,
  'answers',a.answers,'source_text',i.source_excerpt,
  'scripture_anchor',c.scripture_anchor,'research_method',c.research_method,
  'question',c.title,'collection_id',c.id,'version',c.version);
END $fn$;

CREATE OR REPLACE FUNCTION public.saliksik_auto_master_hold_r4(
 p_submission_id uuid,p_token uuid,p_reason text,p_terminal boolean DEFAULT false
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF NOT public.saliksik_internal_service_r4() THEN
  RAISE EXCEPTION 'service_role_required' USING ERRCODE='42501'; END IF;
 UPDATE public.saliksik_auto_review_jobs SET
  status=CASE WHEN p_terminal OR attempts>=5 THEN 'held' ELSE 'queued' END,
  lease_token=NULL,lease_expires_at=NULL,last_error=left(coalesce(p_reason,'review_unavailable'),180)
 WHERE submission_id=p_submission_id AND lease_token=p_token AND status='processing';
END $fn$;

CREATE OR REPLACE FUNCTION public.saliksik_auto_master_settle_r4(
 p_submission_id uuid,p_token uuid,p_judge_a jsonb,p_judge_b jsonb,
 p_citations_verified boolean,p_feedback text,p_evidence jsonb,p_models jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 a public.saliksik_master_submissions%ROWTYPE; i public.saliksik_investigations%ROWTYPE;
 c public.saliksik_collections%ROWTYPE; j public.saliksik_auto_review_jobs%ROWTYPE;
 v_grade_a jsonb; v_grade_b jsonb; v_scores jsonb:='{}'::jsonb; v_grade jsonb;
 v_key text; v_first int; v_second int; v_score int; v_pass boolean; v_gap boolean:=false;
 v_new boolean; v_id uuid; v_series uuid;
 v_pts int:=0; v_required int; v_earned int;
BEGIN
 IF NOT public.saliksik_internal_service_r4() THEN
  RAISE EXCEPTION 'service_role_required' USING ERRCODE='42501'; END IF;
 SELECT * INTO a FROM public.saliksik_master_submissions
 WHERE id=p_submission_id FOR UPDATE;
 SELECT * INTO j FROM public.saliksik_auto_review_jobs
 WHERE submission_id=p_submission_id FOR UPDATE;
 IF NOT FOUND OR j.status<>'processing' OR j.lease_token IS DISTINCT FROM p_token
 OR j.lease_expires_at<=now() OR a.status<>'pending'
 THEN RAISE EXCEPTION 'stale_auto_review_lease'; END IF;
 SELECT * INTO i FROM public.saliksik_investigations
  WHERE id=a.investigation_id AND tier='master' AND status='published';
 IF NOT FOUND OR a.version<>i.version THEN RAISE EXCEPTION 'master_version_mismatch'; END IF;
 SELECT * INTO c FROM public.saliksik_collections
 WHERE id=i.collection_id AND source_mode='CANONICAL_BIBLE_CORPUS' AND status='published';
 IF NOT FOUND THEN RAISE EXCEPTION 'not_auto_research_collection'; END IF;
 IF NOT public.buklod_user_is_active_scope_member(a.scope_id,a.user_id)
 OR NOT EXISTS(SELECT 1 FROM public.saliksik_rollout WHERE id AND member_enabled)
 THEN RAISE EXCEPTION 'member_inactive_or_feature_not_released'; END IF;
 IF length(btrim(coalesce(p_feedback,''))) NOT BETWEEN 80 AND 2000
 OR jsonb_typeof(p_evidence)<>'array' OR jsonb_array_length(p_evidence)<3
 OR jsonb_typeof(p_models)<>'object'
 THEN RAISE EXCEPTION 'inadequate_verifier_evidence_or_feedback'; END IF;
 v_grade_a:=public.saliksik_master_score_v1(p_judge_a);
 v_grade_b:=public.saliksik_master_score_v1(p_judge_b);
 FOR v_key IN SELECT unnest(ARRAY['understanding','evidence','context','reasoning','transfer']) LOOP
   v_first:=(p_judge_a->>v_key)::int;v_second:=(p_judge_b->>v_key)::int;
   IF abs(v_first-v_second)>15 THEN v_gap:=true; END IF;
   v_scores:=jsonb_set(v_scores,ARRAY[v_key],to_jsonb((v_first+v_second)/2));
 END LOOP;
 v_grade:=public.saliksik_master_score_v1(v_scores);
 IF abs((v_grade_a->>'score')::int-(v_grade_b->>'score')::int)>10
 THEN v_gap:=true; END IF;
 v_score:=(v_grade->>'score')::int;
 v_pass:=NOT v_gap AND coalesce(p_citations_verified,false)
   AND v_score>=80 AND (v_grade->>'core_pass')::boolean
   AND (v_grade_a->>'score')::int>=80 AND (v_grade_b->>'score')::int>=80
   AND (v_grade_a->>'core_pass')::boolean AND (v_grade_b->>'core_pass')::boolean;
 IF v_pass AND NOT EXISTS(SELECT 1 FROM public.buklod_point_rules r
 WHERE r.activity_type='saliksik_master' AND r.is_active
 AND r.base_points=35 AND r.max_points_per_event>=35)
 THEN RAISE EXCEPTION 'master_point_rule_unavailable'; END IF;
 IF v_pass AND NOT EXISTS(SELECT 1 FROM public.buklod_point_rules r
 WHERE r.activity_type='saliksik_series' AND r.is_active
 AND r.base_points=50 AND r.max_points_per_event>=50)
 THEN RAISE EXCEPTION 'series_point_rule_unavailable'; END IF;
 UPDATE public.saliksik_master_submissions
 SET status=CASE WHEN v_pass THEN 'approved' ELSE 'rework' END,
  score=v_score,competency_scores=v_scores,citations_verified=p_citations_verified,
  feedback=btrim(p_feedback),reviewed_at=now(),reviewed_by=NULL
 WHERE id=a.id;
 UPDATE public.saliksik_auto_review_jobs
 SET status='settled',reviewer_a=p_judge_a,reviewer_b=p_judge_b,
  evidence_checks=p_evidence,model_versions=p_models,reviewed_at=now(),
  lease_token=NULL,lease_expires_at=NULL,last_error=CASE
    WHEN v_gap THEN 'independent_verifier_disagreement' ELSE NULL END
 WHERE submission_id=a.id;
 IF v_pass THEN
  INSERT INTO public.saliksik_mastery(user_id,investigation_id,version)
  VALUES(a.user_id,i.id,i.version)
  ON CONFLICT DO NOTHING RETURNING true INTO v_new;
  IF coalesce(v_new,false) THEN
    INSERT INTO public.buklod_points_ledger(
      user_id,direction,points,activity_type,source_key,source_id,description)
    VALUES(a.user_id,'credit',35,'saliksik_master',
      'saliksik:'||i.id||':v'||i.version,i.id,
      'SALIKSIK independent source-verified written research')
    ON CONFLICT(user_id,source_key) DO NOTHING RETURNING id INTO v_id;
    UPDATE public.saliksik_mastery SET points_ledger_id=v_id
    WHERE user_id=a.user_id AND investigation_id=i.id AND version=i.version;
    IF v_id IS NOT NULL THEN v_pts:=35; END IF;
  END IF;
  SELECT count(*),count(m.investigation_id) INTO v_required,v_earned
  FROM public.saliksik_investigations x
  LEFT JOIN public.saliksik_mastery m ON m.investigation_id=x.id
   AND m.user_id=a.user_id AND m.version=x.version
  WHERE x.collection_id=i.collection_id AND x.status='published';
  IF v_required=9 AND v_earned=9 THEN
    v_new:=false;
    INSERT INTO public.saliksik_series_mastery(user_id,collection_id,version)
    VALUES(a.user_id,c.id,c.version)
    ON CONFLICT DO NOTHING RETURNING true INTO v_new;
    IF coalesce(v_new,false) THEN
      INSERT INTO public.buklod_points_ledger(
       user_id,direction,points,activity_type,source_key,source_id,description)
      VALUES(a.user_id,'credit',50,'saliksik_series',
       'saliksik:series:'||c.id||':v'||c.version,c.id,
       'SALIKSIK nine-part source-verified research completion')
      ON CONFLICT(user_id,source_key) DO NOTHING RETURNING id INTO v_series;
      UPDATE public.saliksik_series_mastery SET points_ledger_id=v_series
      WHERE user_id=a.user_id AND collection_id=c.id AND version=c.version;
    END IF;
    -- Academic research evidence is audited, not a fabricated UC or degree.
    INSERT INTO public.saliksik_research_academic_evidence(
      user_id,collection_id,collection_version,master_submission_id,
      research_method,scripture_anchor,rubric_scores,evidence_snapshot_hash)
    VALUES(a.user_id,c.id,c.version,a.id,c.research_method,c.scripture_anchor,v_scores,
      md5(a.answers::text||i.source_excerpt||i.version::text))
    ON CONFLICT(user_id,collection_id,collection_version) DO NOTHING;
  END IF;
 END IF;
 RETURN jsonb_build_object('approved',v_pass,'score',v_score,
  'core_pass',v_grade->'core_pass','citations_verified',p_citations_verified,
  'verifier_disagreement',v_gap,'points',v_pts,
  'series_points',CASE WHEN v_series IS NOT NULL THEN 50 ELSE 0 END,
  'claim_state',CASE WHEN v_pts>0 OR v_series IS NOT NULL THEN 'pending' ELSE NULL END);
END $fn$;

-- Owner-only data access remains direct admin-free for ordinary members.
-- Students see only a small receipt, never private reviews or another answer.
CREATE OR REPLACE FUNCTION public.saliksik_academic_evidence_receipt_r4(p_collection_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'sign_in_required' USING ERRCODE='42501'; END IF;
 RETURN coalesce((
 SELECT jsonb_build_object('collection_id',e.collection_id,
 'verified_at',e.verified_at,'research_method',e.research_method,
 'scripture_anchor',e.scripture_anchor,'version',e.collection_version,
 'academic_evidence_verified',true,'university_credits','awaiting_authorized_registrar_policy')
 FROM public.saliksik_research_academic_evidence e
 WHERE e.user_id=auth.uid() AND e.collection_id=p_collection_id
 LIMIT 1),'{}'::jsonb);
END $fn$;

-- R3 source-rights/manuscript entitlement assumed every collection had an
-- uploaded private source. Automatic canonical-corpus collections do not.
CREATE OR REPLACE FUNCTION public.saliksik_manuscript_access_v1(p_collection_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_user uuid:=auth.uid(); c public.saliksik_collections%ROWTYPE;
 v_original_allowed boolean:=false;v_original_path text;v_original_name text;
 v_count int;v_completed int;v_chapters jsonb;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'sign_in_required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.saliksik_rollout r WHERE r.id AND r.member_enabled)
 THEN RAISE EXCEPTION 'saliksik_not_released' USING ERRCODE='42501'; END IF;
 SELECT * INTO c FROM public.saliksik_collections
 WHERE id=p_collection_id AND status='published';
 IF NOT FOUND THEN RAISE EXCEPTION 'collection_not_available' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(
   SELECT 1 FROM public.saliksik_series_mastery m
   WHERE m.collection_id=c.id AND m.version=c.version AND m.user_id=v_user
 ) THEN RAISE EXCEPTION 'complete_collection_first' USING ERRCODE='42501'; END IF;
 SELECT count(*),count(m.investigation_id) INTO v_count,v_completed
 FROM public.saliksik_investigations i
 LEFT JOIN public.saliksik_mastery m ON m.investigation_id=i.id
  AND m.user_id=v_user AND m.version=i.version
 WHERE i.collection_id=c.id AND i.status='published';
 IF v_count<>9 OR v_completed<>9 OR
 (SELECT count(*) FROM public.saliksik_investigations i
  WHERE i.collection_id=c.id AND i.status='published' AND i.tier='master')<>1
 THEN RAISE EXCEPTION 'complete_collection_first' USING ERRCODE='42501'; END IF;
 IF c.source_mode='ADMIN_MANUSCRIPT' THEN
 SELECT s.original_member_download_allowed,s.storage_path,s.file_name
 INTO v_original_allowed,v_original_path,v_original_name
 FROM public.saliksik_sources s WHERE s.id=c.source_id;
 END IF;
 SELECT jsonb_agg(jsonb_build_object(
  'sequence',i.sequence,'title',i.title,'summary',i.summary,
  'lesson_text',i.lesson_text,'scripture_refs',i.scripture_refs
 ) ORDER BY i.sequence) INTO v_chapters
 FROM public.saliksik_investigations i
 WHERE i.collection_id=c.id AND i.status='published';
 RETURN jsonb_build_object('collection_id',c.id,'title',c.title,
  'version',c.version,'author_disclosure',c.author_disclosure,
  'source_mode',c.source_mode,
  'original_available',coalesce(v_original_allowed,false),
  'original_storage_path',CASE WHEN coalesce(v_original_allowed,false)
    THEN v_original_path ELSE NULL END,
  'original_file_name',CASE WHEN coalesce(v_original_allowed,false)
    THEN v_original_name ELSE NULL END,'chapters',v_chapters);
END $fn$;

DO $grant$
DECLARE fn record;
BEGIN
 FOR fn IN SELECT p.proname,pg_get_function_identity_arguments(p.oid) args
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN
 ('saliksik_auto_master_lease_r4','saliksik_auto_master_hold_r4',
  'saliksik_auto_master_settle_r4','saliksik_academic_evidence_receipt_r4')
 LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC,anon,authenticated',
  fn.proname,fn.args);
 IF fn.proname='saliksik_academic_evidence_receipt_r4'
 THEN EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated',
   fn.proname,fn.args);
 ELSE EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO service_role',
   fn.proname,fn.args);
 END IF;
 END LOOP;
END $grant$;
