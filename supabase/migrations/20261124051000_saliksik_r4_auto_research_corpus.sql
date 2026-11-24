-- SALIKSIK R4: autonomous canonical Bible-corpus research, gated OFF in inherited rollout.
-- Apply AFTER R1, R2, R3 in an ISOLATED staging DB only. No live mutation authorized.
ALTER TABLE public.saliksik_collections ALTER COLUMN source_id DROP NOT NULL;
ALTER TABLE public.saliksik_collections
  ADD COLUMN IF NOT EXISTS source_mode text NOT NULL DEFAULT 'ADMIN_MANUSCRIPT'
    CHECK (source_mode IN ('ADMIN_MANUSCRIPT','CANONICAL_BIBLE_CORPUS')),
  ADD COLUMN IF NOT EXISTS topic_key text UNIQUE,
  ADD COLUMN IF NOT EXISTS research_method text,
  ADD COLUMN IF NOT EXISTS scripture_anchor text,
  ADD COLUMN IF NOT EXISTS source_checksum text;
ALTER TABLE public.saliksik_collections
  ADD CONSTRAINT saliksik_auto_source_exclusive_r4 CHECK (
    (source_mode='ADMIN_MANUSCRIPT' AND source_id IS NOT NULL)
     OR (source_mode='CANONICAL_BIBLE_CORPUS' AND source_id IS NULL AND topic_key IS NOT NULL)
  );

CREATE TABLE public.saliksik_auto_requests(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id),
 scope_id uuid NOT NULL REFERENCES public.buklod_scopes(id),
 topic_key text NOT NULL CHECK (topic_key ~ '^[0-9a-f]{32}$'),
 question text NOT NULL CHECK (length(question) BETWEEN 12 AND 180),
 research_method text NOT NULL CHECK (research_method IN
 ('exegetical','biblical_theology','systematic','historical',
  'comparative','practical','education','mission_leadership')),
 scripture_anchor text NOT NULL,
 book_no integer NOT NULL,
 chapter_no integer NOT NULL,
 first_verse integer NOT NULL,
 last_verse integer NOT NULL,
 translation_code text NOT NULL CHECK(translation_code='KJV'),
 source_text text NOT NULL CHECK(length(source_text) BETWEEN 150 AND 12000),
 source_checksum text NOT NULL CHECK(source_checksum ~ '^[0-9a-f]{32}$'),
 status text NOT NULL DEFAULT 'queued' CHECK(status IN('queued','processing','ready','held')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 12),
 lease_token uuid,
 lease_expires_at timestamptz,
 collection_id uuid UNIQUE REFERENCES public.saliksik_collections(id),
 last_error text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,topic_key)
);
CREATE INDEX saliksik_auto_requests_status_r4 ON public.saliksik_auto_requests(status,updated_at);
ALTER TABLE public.saliksik_auto_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.saliksik_auto_requests FROM PUBLIC,anon,authenticated;

-- Database-service boundary: a PostgREST service-role JWT is mandatory for
-- internal draft writes. SECURITY DEFINER alone is not a permission check.
CREATE OR REPLACE FUNCTION public.saliksik_internal_service_r4()
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $fn$
 SELECT coalesce(current_setting('request.jwt.claim.role',true),'')='service_role';
$fn$;

-- The existing member catalog now identifies source mode and uses the
-- same personal faith opt-in gate as the Cluster Home doorway.
CREATE OR REPLACE FUNCTION public.saliksik_catalog_v1(p_scope_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_user uuid:=auth.uid();
BEGIN
 IF v_user IS NULL OR NOT public.buklod_user_is_active_scope_member(p_scope_id,v_user)
 OR NOT EXISTS(SELECT 1 FROM public.buklod_scopes s WHERE s.id=p_scope_id
   AND s.scope_type='CLUSTER' AND s.status='ACTIVE')
 OR NOT EXISTS(SELECT 1 FROM public.buklod_my_scopes_p0_v2() own
    WHERE own.scope_id=p_scope_id AND own.show_faith_content IS TRUE)
 THEN RAISE EXCEPTION 'active_faith_cluster_required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.saliksik_rollout WHERE id AND member_enabled)
 THEN RETURN '[]'::jsonb; END IF;
 RETURN coalesce((
 SELECT jsonb_agg(jsonb_build_object(
   'id',i.id,'collection_id',i.collection_id,
   'collection_title',c.title,'source_mode',c.source_mode,
   'research_method',c.research_method,'title',i.title,'summary',i.summary,
   'tier',i.tier,'points',CASE i.tier WHEN 'discover' THEN 10
     WHEN 'investigate' THEN 20 ELSE 35 END,
   'scripture_refs',i.scripture_refs,
   'completed',EXISTS(SELECT 1 FROM public.saliksik_mastery m
      WHERE m.user_id=v_user AND m.investigation_id=i.id AND m.version=i.version))
   ORDER BY c.published_at,i.sequence)
 FROM public.saliksik_investigations i
 JOIN public.saliksik_collections c ON c.id=i.collection_id
 WHERE c.status='published' AND i.status='published'
 ),'[]'::jsonb);
END $fn$;

-- A research QUESTION + selected canonical reference, not a new lesson.
-- Member never uploads a source, approves a generated question or spends points.
CREATE OR REPLACE FUNCTION public.saliksik_research_request_r4(
 p_scope_id uuid,p_question text,p_reference text,p_method text DEFAULT 'exegetical'
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 v_user uuid:=auth.uid(); v_q text:=btrim(coalesce(p_question,''));
 v_ref text:=btrim(coalesce(p_reference,'')); v_match text[];
 v_book text; v_book_row record; v_chapter int; v_first int; v_last int;
 v_source text; v_count int; v_checksum text; v_key text;
 v_existing uuid; v_collection uuid; v_request uuid;
BEGIN
 IF v_user IS NULL OR NOT public.buklod_user_is_active_scope_member(p_scope_id,v_user)
 OR NOT EXISTS(SELECT 1 FROM public.buklod_scopes s WHERE s.id=p_scope_id
    AND s.scope_type='CLUSTER' AND s.status='ACTIVE')
 OR NOT EXISTS(SELECT 1 FROM public.buklod_my_scopes_p0_v2() own
     WHERE own.scope_id=p_scope_id AND own.show_faith_content IS TRUE)
 THEN RAISE EXCEPTION 'active_faith_cluster_required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.saliksik_rollout WHERE id AND member_enabled)
 THEN RAISE EXCEPTION 'saliksik_not_released' USING ERRCODE='42501'; END IF;
 IF length(v_q) NOT BETWEEN 12 AND 180 OR v_q ~ '[[:cntrl:]]'
 OR coalesce(p_method,'') NOT IN
  ('exegetical','biblical_theology','systematic','historical','comparative',
   'practical','education','mission_leadership')
 THEN RAISE EXCEPTION 'research_question_or_method_invalid'; END IF;
 IF length(v_ref)>90 OR v_ref ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'research_reference_invalid'; END IF;
 -- Includes Juan 1:1-14; exact canonical English book names are also accepted.
 v_match:=regexp_match(v_ref,'^(.+?)\s+([0-9]{1,3})(?::([0-9]{1,3})(?:\s*[-–]\s*([0-9]{1,3}))?)?$','i');
 IF v_match IS NULL THEN RAISE EXCEPTION 'use_book_chapter_or_verse_range'; END IF;
 v_book:=btrim(v_match[1]);
 v_book:=CASE lower(v_book)
  WHEN 'juan' THEN 'John' WHEN 'mateo' THEN 'Matthew' WHEN 'marcos' THEN 'Mark'
  WHEN 'lucas' THEN 'Luke' WHEN 'genesis' THEN 'Genesis'
  WHEN 'roma' THEN 'Romans' WHEN 'romanos' THEN 'Romans'
  WHEN 'mga gawa' THEN 'Acts' ELSE v_book END;
 SELECT b.book_no,b.book_name INTO v_book_row FROM public.bible_canon_books b
 WHERE lower(b.book_name)=lower(v_book) LIMIT 1;
 IF v_book_row.book_no IS NULL THEN RAISE EXCEPTION 'canonical_book_unavailable'; END IF;
 v_chapter:=v_match[2]::int; v_first:=coalesce(v_match[3]::int,1);
 v_last:=coalesce(v_match[4]::int,CASE WHEN v_match[3] IS NULL THEN v_first+39 ELSE v_first END);
 IF v_chapter<1 OR v_first<1 OR v_last<v_first OR v_last-v_first>39
 THEN RAISE EXCEPTION 'invalid_or_oversized_passage_range'; END IF;
 SELECT count(*),string_agg(
    v_book_row.book_name||' '||x.chapter_no||':'||x.verse_no||' '||x.verse_text,
    E'\n' ORDER BY x.verse_no
 ) INTO v_count,v_source
 FROM public.bible_verses x
 WHERE x.book_no=v_book_row.book_no AND x.chapter_no=v_chapter
 AND x.translation_code='KJV' AND x.verse_no BETWEEN v_first AND v_last;
 IF v_count<3 OR length(coalesce(v_source,'')) NOT BETWEEN 150 AND 12000
 THEN RAISE EXCEPTION 'canonical_passage_not_available_or_too_short'; END IF;
 IF (SELECT max(x.verse_no)-min(x.verse_no)+1
     FROM public.bible_verses x WHERE x.book_no=v_book_row.book_no
     AND x.chapter_no=v_chapter AND x.translation_code='KJV'
     AND x.verse_no BETWEEN v_first AND v_last)<>v_count
 THEN RAISE EXCEPTION 'noncontiguous_canonical_passage'; END IF;
 v_last:=v_first+v_count-1;
 IF NOT EXISTS(SELECT 1 FROM public.bible_verses x
   WHERE x.book_no=v_book_row.book_no AND x.chapter_no=v_chapter
    AND x.translation_code='KJV' AND x.verse_no=v_last)
 THEN RAISE EXCEPTION 'missing_canonical_verse'; END IF;
 v_checksum:=md5(v_source);
 v_key:=md5(lower(v_q)||':'||p_method||':'||v_book_row.book_no||':'||
  v_chapter||':'||v_first||':'||v_last||':'||v_checksum);
 -- Reuse an immutable already published collection rather than paying AI again.
 SELECT c.id INTO v_collection FROM public.saliksik_collections c
 WHERE c.topic_key=v_key AND c.status='published' AND c.source_mode='CANONICAL_BIBLE_CORPUS';
 IF v_collection IS NOT NULL THEN
  RETURN jsonb_build_object('ok',true,'status','ready','collection_id',v_collection);
 END IF;
 SELECT r.id INTO v_existing FROM public.saliksik_auto_requests r
 WHERE r.user_id=v_user AND r.topic_key=v_key;
 IF v_existing IS NOT NULL THEN
  RETURN public.saliksik_research_status_r4(v_existing);
 END IF;
 IF (SELECT count(*) FROM public.saliksik_auto_requests r
 WHERE r.user_id=v_user AND r.created_at>now()-interval '24 hours')>=3
 THEN RAISE EXCEPTION 'daily_research_request_limit'; END IF;
 INSERT INTO public.saliksik_auto_requests(
 user_id,scope_id,topic_key,question,research_method,scripture_anchor,
 book_no,chapter_no,first_verse,last_verse,translation_code,source_text,source_checksum)
 VALUES(v_user,p_scope_id,v_key,v_q,p_method,
    v_book_row.book_name||' '||v_chapter||':'||v_first||'-'||v_last,
    v_book_row.book_no,v_chapter,v_first,v_last,'KJV',v_source,v_checksum)
 RETURNING id INTO v_request;
 RETURN jsonb_build_object('ok',true,'request_id',v_request,'status','queued',
  'progress',0,'scripture_anchor',
  v_book_row.book_name||' '||v_chapter||':'||v_first||'-'||v_last);
END $fn$;

-- Only the request owner gets status. Existing already-published collections
-- can be discovered through the normal faith-cluster catalog.
CREATE OR REPLACE FUNCTION public.saliksik_research_status_r4(p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE r public.saliksik_auto_requests%ROWTYPE; v_progress int:=0;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'sign_in_required' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM public.saliksik_auto_requests WHERE id=p_request_id;
 IF NOT FOUND OR r.user_id<>auth.uid() OR
 NOT public.buklod_user_is_active_scope_member(r.scope_id,auth.uid())
 THEN RAISE EXCEPTION 'research_request_not_owned' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.saliksik_rollout WHERE id AND member_enabled)
 THEN RAISE EXCEPTION 'saliksik_not_released' USING ERRCODE='42501'; END IF;
 IF r.collection_id IS NOT NULL THEN
 SELECT count(*) INTO v_progress FROM public.saliksik_investigations i
 WHERE i.collection_id=r.collection_id AND i.tier<>'master';
 END IF;
 RETURN jsonb_build_object('ok',true,'request_id',r.id,'status',r.status,
   'progress',v_progress,'collection_id',CASE WHEN r.status='ready' THEN r.collection_id END,
   'scripture_anchor',r.scripture_anchor,'error',CASE WHEN r.status='held' THEN r.last_error END);
END $fn$;

CREATE OR REPLACE FUNCTION public.saliksik_my_research_r4(p_scope_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF auth.uid() IS NULL OR NOT public.buklod_user_is_active_scope_member(p_scope_id,auth.uid())
 THEN RAISE EXCEPTION 'active_cluster_member_required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.saliksik_rollout WHERE id AND member_enabled)
 THEN RETURN '[]'::jsonb; END IF;
 RETURN coalesce((
 SELECT jsonb_agg(jsonb_build_object('request_id',r.id,'question',r.question,
 'status',r.status,'scripture_anchor',r.scripture_anchor,
 'progress',(SELECT count(*) FROM public.saliksik_investigations i
   WHERE i.collection_id=r.collection_id AND i.tier<>'master'),
 'collection_id',CASE WHEN r.status='ready' THEN r.collection_id END,
 'created_at',r.created_at) ORDER BY r.created_at DESC)
 FROM (SELECT * FROM public.saliksik_auto_requests
 WHERE user_id=auth.uid() AND scope_id=p_scope_id
 ORDER BY created_at DESC LIMIT 10) r),'[]'::jsonb);
END $fn$;

-- Only a verified Edge request can claim a short processing lease. No member
-- can send privileged generated JSON directly to SQL through authenticated RPC.
CREATE OR REPLACE FUNCTION public.saliksik_auto_lease_r4(p_request_id uuid,p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE r public.saliksik_auto_requests%ROWTYPE; v_seq int:=0; v_token uuid:=gen_random_uuid(); v_existing uuid;
BEGIN
 IF NOT public.saliksik_internal_service_r4() THEN
   RAISE EXCEPTION 'service_role_required' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM public.saliksik_auto_requests WHERE id=p_request_id FOR UPDATE;
 IF NOT FOUND OR r.user_id<>p_user_id THEN RAISE EXCEPTION 'request_mismatch' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.saliksik_rollout WHERE id AND member_enabled)
 THEN RAISE EXCEPTION 'saliksik_not_released'; END IF;
 IF r.status='ready' THEN RETURN jsonb_build_object('ready',true,'collection_id',r.collection_id); END IF;
 IF r.status='held' OR r.attempts>=12 THEN RAISE EXCEPTION 'research_review_held'; END IF;
 IF r.status='processing' AND r.lease_expires_at>now()
 THEN RETURN jsonb_build_object('busy',true,'retry_seconds',20); END IF;
 IF r.collection_id IS NOT NULL THEN
 SELECT count(*) INTO v_seq FROM public.saliksik_investigations
 WHERE collection_id=r.collection_id AND tier<>'master';
 END IF;
 IF v_seq NOT IN(0,2,4,6) THEN RAISE EXCEPTION 'research_sequence_invalid'; END IF;
 UPDATE public.saliksik_auto_requests SET
  status='processing',attempts=attempts+1,lease_token=v_token,
  lease_expires_at=now()+interval '3 minutes',updated_at=now(),last_error=NULL
 WHERE id=r.id;
 RETURN jsonb_build_object('ready',false,'busy',false,'token',v_token,
  'next_sequence',v_seq+1,'question',r.question,'method',r.research_method,
  'source_text',r.source_text,'source_checksum',r.source_checksum,
  'scripture_anchor',r.scripture_anchor);
END $fn$;

CREATE OR REPLACE FUNCTION public.saliksik_auto_store_r4(
 p_request_id uuid,p_token uuid,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE r public.saliksik_auto_requests%ROWTYPE;
 c uuid; v_sequence int:=0; item jsonb; q jsonb; v_i int:=0;
 v_tier text; v_bank jsonb; v_need int; v_counts jsonb; v_quote text;
 v_comp text; v_inv uuid; v_master text; v_source text;
BEGIN
 IF NOT public.saliksik_internal_service_r4() THEN
 RAISE EXCEPTION 'service_role_required' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM public.saliksik_auto_requests WHERE id=p_request_id FOR UPDATE;
 IF NOT FOUND OR r.status<>'processing' OR r.lease_token IS DISTINCT FROM p_token
  OR r.lease_expires_at<=now() THEN RAISE EXCEPTION 'stale_auto_lease'; END IF;
 IF md5(r.source_text)<>r.source_checksum THEN RAISE EXCEPTION 'source_hash_mismatch'; END IF;
 IF jsonb_typeof(p_payload->'verification')<>'object'
  OR (p_payload->'verification'->>'critic_approved') IS DISTINCT FROM 'true'
  OR length(coalesce(p_payload->'verification'->>'critic_model',''))<3
  OR jsonb_typeof(p_payload->'investigations')<>'array'
  OR jsonb_array_length(p_payload->'investigations')<>2
 THEN RAISE EXCEPTION 'two_investigations_required'; END IF;
 SELECT id INTO c FROM public.saliksik_collections
  WHERE topic_key=r.topic_key AND status IN ('draft','published') FOR UPDATE;
 IF c IS NOT NULL AND c.status='published' THEN
   UPDATE public.saliksik_auto_requests SET status='ready',collection_id=c,
     lease_token=NULL,lease_expires_at=NULL,updated_at=now() WHERE id=r.id;
   RETURN jsonb_build_object('ok',true,'status','ready','collection_id',c,'progress',8);
 END IF;
 IF c IS NOT NULL AND EXISTS(
    SELECT 1 FROM public.saliksik_auto_requests other
    WHERE other.collection_id=c AND other.id<>r.id
 ) THEN RAISE EXCEPTION 'another_research_request_owns_draft'; END IF;
 IF c IS NULL THEN
   INSERT INTO public.saliksik_collections(
     source_id,title,source_mode,topic_key,research_method,scripture_anchor,
     source_checksum,status,author_disclosure)
   VALUES(NULL,left(r.question,180),'CANONICAL_BIBLE_CORPUS',r.topic_key,
     r.research_method,r.scripture_anchor,r.source_checksum,'draft',
     'Christ-centered research perspective; grade verified evidence, context and reasoning, not religious agreement.')
   RETURNING id INTO c;
 END IF;
 IF r.collection_id IS NOT NULL AND r.collection_id<>c THEN
 RAISE EXCEPTION 'research_collection_changed'; END IF;
 SELECT count(*) INTO v_sequence FROM public.saliksik_investigations
 WHERE collection_id=c AND tier<>'master';
 IF v_sequence NOT IN(0,2,4,6) THEN RAISE EXCEPTION 'auto_sequence_invalid'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_payload->'investigations') LOOP
   v_i:=v_i+1;
   v_tier:=item->>'tier';
   IF (mod(v_sequence+v_i,2)=1 AND v_tier<>'discover')
      OR (mod(v_sequence+v_i,2)=0 AND v_tier<>'investigate')
   THEN RAISE EXCEPTION 'auto_tier_mismatch'; END IF;
   v_need:=CASE WHEN v_tier='discover' THEN 5 ELSE 10 END;
   v_bank:=item->'questions';
   IF jsonb_typeof(v_bank)<>'array' OR jsonb_array_length(v_bank)<>v_need
      OR length(coalesce(item->>'title','')) NOT BETWEEN 10 AND 180
      OR length(coalesce(item->>'summary','')) NOT BETWEEN 20 AND 600
      OR length(coalesce(item->>'lesson_text','')) NOT BETWEEN 150 AND 12000
      OR coalesce(item->>'source_excerpt','') IS DISTINCT FROM r.source_text
      OR jsonb_typeof(item->'scripture_refs')<>'array'
      OR NOT (item->'scripture_refs' @> jsonb_build_array(r.scripture_anchor))
   THEN RAISE EXCEPTION 'unverified_auto_payload'; END IF;
   v_counts:='{"understanding":0,"evidence":0,"context":0,"reasoning":0,"transfer":0}'::jsonb;
   FOR q IN SELECT value FROM jsonb_array_elements(v_bank) LOOP
     v_comp:=q->>'competency'; v_quote:=q->>'evidence';
     IF v_comp NOT IN('understanding','evidence','context','reasoning','transfer')
       OR length(coalesce(q->>'prompt',''))<15
       OR length(coalesce(q->>'id','')) NOT BETWEEN 1 AND 64
       OR jsonb_typeof(q->'options')<>'array' OR jsonb_array_length(q->'options')<>4
       OR coalesce(q->>'correctIndex','') !~ '^[0-3]$'
       OR length(coalesce(v_quote,''))<20
       OR position(lower(btrim(v_quote)) in lower(r.source_text))=0
     THEN RAISE EXCEPTION 'question_unverifiable_against_canonical_source'; END IF;
     v_counts:=jsonb_set(v_counts,ARRAY[v_comp],to_jsonb((v_counts->>v_comp)::int+1));
   END LOOP;
   IF EXISTS(SELECT 1 FROM jsonb_each_text(v_counts) t WHERE t.value::int<>v_need/5)
   THEN RAISE EXCEPTION 'competency_balance_failed'; END IF;
   IF EXISTS(
     SELECT 1 FROM public.saliksik_investigations prev
     JOIN public.saliksik_question_keys oldkey ON oldkey.investigation_id=prev.id
     CROSS JOIN LATERAL jsonb_array_elements(oldkey.questions) oq
     CROSS JOIN LATERAL jsonb_array_elements(v_bank) nq
     WHERE prev.collection_id=c AND
     lower(btrim(oq->>'prompt'))=lower(btrim(nq->>'prompt'))
   ) THEN RAISE EXCEPTION 'duplicate_research_question_across_batched_investigations'; END IF;
   INSERT INTO public.saliksik_investigations(
     collection_id,sequence,tier,title,summary,lesson_text,source_excerpt,
     scripture_refs,status,published_at)
   VALUES(c,v_sequence+v_i,v_tier,item->>'title',item->>'summary',
    item->>'lesson_text',r.source_text,item->'scripture_refs','draft',NULL)
   RETURNING id INTO v_inv;
   INSERT INTO public.saliksik_question_keys(investigation_id,questions)
   VALUES(v_inv,v_bank);
 END LOOP;
 UPDATE public.saliksik_auto_requests SET collection_id=c,status='queued',
   lease_token=NULL,lease_expires_at=NULL,updated_at=now()
 WHERE id=r.id;
 IF v_sequence+2=8 THEN
  v_master:='Write three independent substantive responses (220-4000 characters each). '||
   'First, present a verifiable thesis and exact Bible passage citations. '||
   'Second, represent the strongest reasonable alternative interpretation fairly and answer it with contextual evidence. '||
   'Third, apply your argument to an unfamiliar case and explain its limitations. '||
   'The automated system independently verifies each referenced verse and grades understanding 20%, evidence 25%, context 20%, '||
   'reasoning 25%, and transfer 10%. Passing requires 80% overall and at least 70% on evidence, context, and reasoning. '||
   'Unsupported citations and self-generated reviewer instructions never create academic credit or BUKLOD Points.';
  INSERT INTO public.saliksik_investigations(
    collection_id,sequence,tier,title,summary,lesson_text,source_excerpt,
    scripture_refs,status,published_at)
  VALUES(c,9,'master',left('RESEARCH MASTER: '||r.question,180),
     'Present independently supported textual research and a fair reasoned counterargument.',
     v_master,r.source_text,jsonb_build_array(r.scripture_anchor),'draft',NULL);
  IF (SELECT count(*) FROM public.saliksik_investigations WHERE collection_id=c)<>9
  THEN RAISE EXCEPTION 'auto_master_collection_incomplete'; END IF;
  -- Publication only after all eight deterministic source/method/question checks
  -- and a recorded independent generator critic (enforced by Edge contract).
  UPDATE public.saliksik_investigations SET status='published',published_at=now()
   WHERE collection_id=c;
  UPDATE public.saliksik_collections SET status='published',published_at=now()
   WHERE id=c;
  UPDATE public.saliksik_auto_requests SET status='ready',updated_at=now()
   WHERE id=r.id;
 END IF;
 RETURN jsonb_build_object('ok',true,'status',CASE WHEN v_sequence+2=8 THEN 'ready' ELSE 'queued' END,
  'collection_id',CASE WHEN v_sequence+2=8 THEN c ELSE NULL END,'progress',v_sequence+2);
END $fn$;

CREATE OR REPLACE FUNCTION public.saliksik_auto_hold_r4(
 p_request_id uuid,p_token uuid,p_reason text,p_terminal boolean DEFAULT false
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF NOT public.saliksik_internal_service_r4() THEN
 RAISE EXCEPTION 'service_role_required' USING ERRCODE='42501'; END IF;
 UPDATE public.saliksik_auto_requests SET
   status=CASE WHEN p_terminal OR attempts>=9 THEN 'held' ELSE 'queued' END,
   lease_token=NULL,lease_expires_at=NULL,
   last_error=left(coalesce(p_reason,'verification_failed'),180),updated_at=now()
 WHERE id=p_request_id AND lease_token=p_token AND status='processing';
END $fn$;

DO $grant$
DECLARE fn record;
BEGIN
 FOR fn IN SELECT p.proname,pg_get_function_identity_arguments(p.oid) args
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN
 ('saliksik_research_request_r4','saliksik_research_status_r4','saliksik_my_research_r4',
  'saliksik_auto_lease_r4','saliksik_auto_store_r4','saliksik_auto_hold_r4')
 LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC,anon,authenticated',
   fn.proname,fn.args);
 IF fn.proname IN('saliksik_research_request_r4','saliksik_research_status_r4','saliksik_my_research_r4') THEN
  EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated',fn.proname,fn.args);
 ELSE
  EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO service_role',fn.proname,fn.args);
 END IF;
 END LOOP;
END $grant$;
