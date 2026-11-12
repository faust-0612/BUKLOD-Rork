-- SALIKSIK R1. Additive, OFF by default, no existing row deletion.
-- Private originals, admin-only draft authoring, member-only objective mastery.
-- MASTER +35 deliberately disabled pending written independent rubric release gate.

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('saliksik-source-originals','saliksik-source-originals',false,10485760,
  ARRAY['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain'])
ON CONFLICT(id) DO NOTHING;

DROP POLICY IF EXISTS saliksik_source_admin_insert ON storage.objects;
CREATE POLICY saliksik_source_admin_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id='saliksik-source-originals' AND public.is_system_admin()
  AND name ~ '^originals/[0-9a-f-]{36}\.(pdf|docx|txt)$');
DROP POLICY IF EXISTS saliksik_source_admin_read ON storage.objects;
CREATE POLICY saliksik_source_admin_read ON storage.objects FOR SELECT TO authenticated
USING(bucket_id='saliksik-source-originals' AND public.is_system_admin());

DROP POLICY IF EXISTS saliksik_source_admin_delete ON storage.objects;
CREATE POLICY saliksik_source_admin_delete ON storage.objects FOR DELETE TO authenticated
USING (bucket_id='saliksik-source-originals' AND public.is_system_admin());

CREATE TABLE IF NOT EXISTS public.saliksik_rollout (
  id boolean PRIMARY KEY DEFAULT true CHECK(id),
  member_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.saliksik_rollout(id,member_enabled) VALUES(true,false) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.saliksik_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by uuid NOT NULL REFERENCES auth.users(id),
  title text NOT NULL CHECK(length(title) BETWEEN 3 AND 180),
  file_name text NOT NULL CHECK(length(file_name) BETWEEN 3 AND 200),
  mime_type text NOT NULL CHECK(mime_type IN(
    'application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain')),
  storage_path text NOT NULL UNIQUE,
  size_bytes bigint NOT NULL CHECK(size_bytes BETWEEN 1 AND 10485760),
  content_sha256 text NOT NULL CHECK(content_sha256 ~ '^[0-9a-f]{64}$'),
  status text NOT NULL DEFAULT 'queued' CHECK(status IN('queued','processing','draft','failed','archived')),
  attempts int NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 9),
  lease_expires_at timestamptz,
  lease_token uuid,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE(content_sha256)
);
CREATE TABLE IF NOT EXISTS public.saliksik_collections(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL UNIQUE REFERENCES public.saliksik_sources(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK(length(title) BETWEEN 3 AND 180),
  version int NOT NULL DEFAULT 1 CHECK(version >= 1),
  status text NOT NULL DEFAULT 'draft' CHECK(status IN('draft','published','archived')),
  author_disclosure text NOT NULL DEFAULT 'Author interpretation; readers may critically examine other views.',
  published_at timestamptz
);
CREATE TABLE IF NOT EXISTS public.saliksik_investigations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES public.saliksik_collections(id) ON DELETE RESTRICT,
  sequence int NOT NULL CHECK(sequence BETWEEN 1 AND 100),
  tier text NOT NULL CHECK(tier IN('discover','investigate','master')),
  title text NOT NULL CHECK(length(title) BETWEEN 10 AND 180),
  summary text NOT NULL CHECK(length(summary) BETWEEN 20 AND 600),
  lesson_text text NOT NULL CHECK(length(lesson_text) BETWEEN 150 AND 12000),
  source_excerpt text NOT NULL CHECK(length(source_excerpt) BETWEEN 150 AND 12000),
  scripture_refs jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(scripture_refs)='array'),
  version int NOT NULL DEFAULT 1 CHECK(version >= 1),
  status text NOT NULL DEFAULT 'draft' CHECK(status IN('draft','published')),
  published_at timestamptz,
  UNIQUE(collection_id,sequence)
);
CREATE TABLE IF NOT EXISTS public.saliksik_question_keys(
  investigation_id uuid PRIMARY KEY REFERENCES public.saliksik_investigations(id) ON DELETE CASCADE,
  questions jsonb NOT NULL CHECK(jsonb_typeof(questions)='array')
);
CREATE TABLE IF NOT EXISTS public.saliksik_attempts(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  scope_id uuid NOT NULL REFERENCES public.buklod_scopes(id),
  investigation_id uuid NOT NULL REFERENCES public.saliksik_investigations(id),
  question_order integer[] NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT(now()+interval '60 minutes'),
  submitted_at timestamptz,
  answer_indices jsonb,
  score int CHECK(score BETWEEN 0 AND 100),
  competency_scores jsonb,
  passed boolean,
  result_code text
);
CREATE UNIQUE INDEX IF NOT EXISTS saliksik_single_open_attempt
  ON public.saliksik_attempts(user_id,scope_id,investigation_id)
  WHERE submitted_at IS NULL;
CREATE INDEX IF NOT EXISTS saliksik_attempts_owner_recent
  ON public.saliksik_attempts(user_id,started_at DESC);
CREATE TABLE IF NOT EXISTS public.saliksik_mastery(
  user_id uuid NOT NULL REFERENCES auth.users(id),
  investigation_id uuid NOT NULL REFERENCES public.saliksik_investigations(id),
  version int NOT NULL CHECK(version>=1),
  passed_at timestamptz NOT NULL DEFAULT now(),
  points_ledger_id uuid REFERENCES public.buklod_points_ledger(id),
  PRIMARY KEY(user_id,investigation_id,version)
);
CREATE TABLE IF NOT EXISTS public.saliksik_series_mastery(
  user_id uuid NOT NULL REFERENCES auth.users(id),
  collection_id uuid NOT NULL REFERENCES public.saliksik_collections(id),
  version int NOT NULL CHECK(version>=1),
  passed_at timestamptz NOT NULL DEFAULT now(),
  points_ledger_id uuid REFERENCES public.buklod_points_ledger(id),
  PRIMARY KEY(user_id,collection_id,version)
);
DO $$
DECLARE n text;
BEGIN
  FOREACH n IN ARRAY ARRAY[
    'saliksik_rollout','saliksik_sources','saliksik_collections','saliksik_investigations',
    'saliksik_question_keys','saliksik_attempts','saliksik_mastery','saliksik_series_mastery'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',n);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',n);
  END LOOP;
END $$;

INSERT INTO public.buklod_point_rules(activity_type,label,base_points,max_points_per_event,daily_cap_points,weekly_cap_points,is_active,notes)
VALUES
('saliksik_discover','SALIKSIK Discover',10,10,NULL,NULL,true,'Verified unique investigation only'),
('saliksik_investigate','SALIKSIK Investigate',20,20,NULL,NULL,true,'Evidence/context/reasoning mastery gates'),
('saliksik_master','SALIKSIK Master',35,35,NULL,NULL,false,'OFF until independently verified written rubric'),
('saliksik_series','SALIKSIK Series Mastery',50,50,NULL,NULL,true,'Minimum eight verified investigations in the published collection')
ON CONFLICT(activity_type) DO NOTHING;

CREATE OR REPLACE FUNCTION public.saliksik_admin_register_v1(
 p_title text,p_file_name text,p_mime_type text,p_storage_path text,
 p_size_bytes bigint,p_sha256 text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_id uuid; v_file_size bigint;
BEGIN
 IF NOT public.is_system_admin() THEN RAISE EXCEPTION 'admin_required' USING ERRCODE='42501'; END IF;
 IF length(btrim(coalesce(p_title,''))) NOT BETWEEN 3 AND 180
 OR length(btrim(coalesce(p_file_name,''))) NOT BETWEEN 3 AND 200
 OR p_mime_type NOT IN ('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain')
 OR coalesce(p_size_bytes,0) NOT BETWEEN 1 AND 10485760
 OR coalesce(p_sha256,'') !~ '^[0-9a-f]{64}$'
 OR p_storage_path !~ '^originals/[0-9a-f-]{36}\.(pdf|docx|txt)$'
 THEN RAISE EXCEPTION 'invalid_source_metadata'; END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.objects o
   WHERE o.bucket_id='saliksik-source-originals' AND o.name=p_storage_path) THEN
   RAISE EXCEPTION 'uploaded_object_missing';
 END IF;
 SELECT s.id INTO v_id FROM public.saliksik_sources s WHERE s.content_sha256=p_sha256;
 IF v_id IS NOT NULL THEN RETURN v_id; END IF;
 INSERT INTO public.saliksik_sources(uploaded_by,title,file_name,mime_type,storage_path,size_bytes,content_sha256)
 VALUES (auth.uid(),btrim(p_title),btrim(p_file_name),p_mime_type,p_storage_path,p_size_bytes,p_sha256)
 RETURNING id INTO v_id;
 RETURN v_id;
END $fn$;

CREATE OR REPLACE FUNCTION public.saliksik_admin_list_v1()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF NOT public.is_system_admin() THEN RAISE EXCEPTION 'admin_required' USING ERRCODE='42501'; END IF;
 RETURN coalesce((
  SELECT jsonb_agg(jsonb_build_object(
   'id',s.id,'title',s.title,'file_name',s.file_name,'status',s.status,
   'attempts',s.attempts,'last_error',s.last_error,'created_at',s.created_at,
   'content_sha256',s.content_sha256,'storage_path',s.storage_path,
   'collection_id',c.id,'collection_status',c.status,'investigations',(
     SELECT count(*) FROM public.saliksik_investigations i WHERE i.collection_id=c.id))
   ORDER BY s.created_at DESC)
  FROM (SELECT * FROM public.saliksik_sources ORDER BY created_at DESC LIMIT 100) s
  LEFT JOIN public.saliksik_collections c ON c.source_id=s.id
 ),'[]'::jsonb);
END $fn$;

-- Atomic processing lease: stale in-flight invocation cannot overwrite a later attempt.
CREATE OR REPLACE FUNCTION public.saliksik_admin_lease_v1(p_source_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE s public.saliksik_sources%ROWTYPE; t uuid:=gen_random_uuid();
BEGIN
 IF NOT public.is_system_admin() THEN RAISE EXCEPTION 'admin_required' USING ERRCODE='42501'; END IF;
 SELECT * INTO s FROM public.saliksik_sources WHERE id=p_source_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'source_missing'; END IF;
 IF EXISTS(SELECT 1 FROM public.saliksik_collections c WHERE c.source_id=s.id AND c.status='published')
   THEN RAISE EXCEPTION 'published_source_immutable'; END IF;
 IF s.attempts>=9 THEN RAISE EXCEPTION 'retry_limit'; END IF;
 IF s.status='processing' AND coalesce(s.lease_expires_at,now()+interval '1 hour')>now()
   THEN RAISE EXCEPTION 'already_processing'; END IF;
 IF s.status NOT IN('queued','failed','draft','processing') THEN RAISE EXCEPTION 'source_not_processable'; END IF;
 UPDATE public.saliksik_sources SET status='processing',attempts=attempts+1,
 lease_token=t,lease_expires_at=now()+interval '3 minutes',last_error=NULL
 WHERE id=s.id;
 RETURN jsonb_build_object('token',t,'storage_path',s.storage_path,'mime_type',s.mime_type,
   'title',s.title,'size_bytes',s.size_bytes,'content_sha256',s.content_sha256);
END $fn$;

CREATE OR REPLACE FUNCTION public.saliksik_admin_fail_v1(p_source_id uuid,p_token uuid,p_error text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF NOT public.is_system_admin() THEN RAISE EXCEPTION 'admin_required' USING ERRCODE='42501'; END IF;
 UPDATE public.saliksik_sources SET status='failed',last_error=left(coalesce(p_error,'generation_failed'),300),
 lease_token=NULL,lease_expires_at=NULL
 WHERE id=p_source_id AND lease_token=p_token AND status='processing';
END $fn$;

-- Validate manuscript-grounded objective question schema before admin can publish.
CREATE OR REPLACE FUNCTION public.saliksik_admin_store_draft_v1(
 p_source_id uuid,p_token uuid,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE s public.saliksik_sources%ROWTYPE; c uuid; item jsonb; q jsonb; idx int:=0;
 v_inv uuid; v_tier text; v_bank jsonb; v_need int; v_n int;
 v_comp text; counts jsonb; v_options jsonb; v_quote text;
BEGIN
 IF NOT public.is_system_admin() THEN RAISE EXCEPTION 'admin_required' USING ERRCODE='42501'; END IF;
 SELECT * INTO s FROM public.saliksik_sources WHERE id=p_source_id FOR UPDATE;
 IF NOT FOUND OR s.status<>'processing' OR s.lease_token IS DISTINCT FROM p_token
 OR s.lease_expires_at<=now() THEN RAISE EXCEPTION 'stale_processing_lease'; END IF;
 IF jsonb_typeof(p_payload->'investigations')<>'array'
 OR jsonb_array_length(p_payload->'investigations')<>2
 THEN RAISE EXCEPTION 'invalid_investigation_count'; END IF;
 SELECT id INTO c FROM public.saliksik_collections WHERE source_id=p_source_id FOR UPDATE;
 IF c IS NOT NULL AND EXISTS(SELECT 1 FROM public.saliksik_collections
   WHERE id=c AND status<>'draft') THEN RAISE EXCEPTION 'collection_immutable'; END IF;
 IF c IS NULL THEN
   INSERT INTO public.saliksik_collections(source_id,title)
   VALUES(p_source_id,s.title) RETURNING id INTO c;
 ELSE
   DELETE FROM public.saliksik_question_keys k USING public.saliksik_investigations i
     WHERE k.investigation_id=i.id AND i.collection_id=c;
   DELETE FROM public.saliksik_investigations WHERE collection_id=c;
 END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_payload->'investigations') LOOP
   idx:=idx+1;
   v_tier:=item->>'tier';
   IF v_tier IS DISTINCT FROM CASE idx WHEN 1 THEN 'discover' ELSE 'investigate' END
    THEN RAISE EXCEPTION 'unexpected_tier_or_order'; END IF;
   v_bank:=item->'questions'; v_need:=CASE WHEN idx=1 THEN 5 ELSE 10 END;
   IF jsonb_typeof(v_bank)<>'array' OR jsonb_array_length(v_bank)<>v_need
   OR length(coalesce(item->>'title','')) NOT BETWEEN 10 AND 180
   OR length(coalesce(item->>'summary','')) NOT BETWEEN 20 AND 600
   OR length(coalesce(item->>'lesson_text','')) NOT BETWEEN 150 AND 12000
   OR length(coalesce(item->>'source_excerpt','')) NOT BETWEEN 150 AND 12000
   OR jsonb_typeof(item->'scripture_refs')<>'array'
   THEN RAISE EXCEPTION 'invalid_investigation_payload'; END IF;
   counts:='{"understanding":0,"evidence":0,"context":0,"reasoning":0,"transfer":0}'::jsonb;
   FOR q IN SELECT value FROM jsonb_array_elements(v_bank) LOOP
     v_comp:=q->>'competency'; v_options:=q->'options'; v_quote:=q->>'evidence';
     IF v_comp NOT IN('understanding','evidence','context','reasoning','transfer')
     OR length(coalesce(q->>'id','')) NOT BETWEEN 1 AND 64
     OR length(coalesce(q->>'prompt',''))<15
     OR jsonb_typeof(v_options)<>'array' OR jsonb_array_length(v_options)<>4
     OR coalesce(q->>'correctIndex','') !~ '^[0-3]$'
     OR length(coalesce(v_quote,''))<20
     OR position(lower(btrim(v_quote)) in lower(item->>'source_excerpt'))=0
     THEN RAISE EXCEPTION 'unverifiable_question'; END IF;
     counts:=jsonb_set(counts,ARRAY[v_comp],to_jsonb((counts->>v_comp)::int+1));
   END LOOP;
   IF EXISTS(SELECT 1 FROM jsonb_each_text(counts) t WHERE t.value::int<>v_need/5)
      THEN RAISE EXCEPTION 'competency_coverage_invalid'; END IF;
   INSERT INTO public.saliksik_investigations(
     collection_id,sequence,tier,title,summary,lesson_text,source_excerpt,scripture_refs)
   VALUES(c,idx,v_tier,item->>'title',item->>'summary',item->>'lesson_text',
     item->>'source_excerpt',item->'scripture_refs') RETURNING id INTO v_inv;
   INSERT INTO public.saliksik_question_keys(investigation_id,questions) VALUES(v_inv,v_bank);
 END LOOP;
 UPDATE public.saliksik_sources SET status='draft',processed_at=now(),
   lease_token=NULL,lease_expires_at=NULL,last_error=NULL WHERE id=p_source_id;
 RETURN jsonb_build_object('ok',true,'collection_id',c,'investigations',idx,'status','draft');
END $fn$;

-- Admin expressly validates text fidelity before member distribution.
CREATE OR REPLACE FUNCTION public.saliksik_admin_preview_v1(p_collection_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF NOT public.is_system_admin() THEN RAISE EXCEPTION 'admin_required' USING ERRCODE='42501'; END IF;
 RETURN coalesce((
  SELECT jsonb_build_object('id',c.id,'title',c.title,'status',c.status,'source_id',c.source_id,
   'investigations',coalesce((
    SELECT jsonb_agg(jsonb_build_object('id',i.id,'title',i.title,'tier',i.tier,
     'summary',i.summary,'lesson_text',i.lesson_text,'source_excerpt',i.source_excerpt,
     'scripture_refs',i.scripture_refs,'questions',k.questions) ORDER BY i.sequence)
    FROM public.saliksik_investigations i
    JOIN public.saliksik_question_keys k ON k.investigation_id=i.id
    WHERE i.collection_id=c.id),'[]'::jsonb))
  FROM public.saliksik_collections c WHERE c.id=p_collection_id
 ),'{}'::jsonb);
END $fn$;

CREATE OR REPLACE FUNCTION public.saliksik_admin_publish_v1(p_collection_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE c public.saliksik_collections%ROWTYPE; v_count int;
BEGIN
 IF NOT public.is_system_admin() THEN RAISE EXCEPTION 'admin_required' USING ERRCODE='42501'; END IF;
 SELECT * INTO c FROM public.saliksik_collections WHERE id=p_collection_id FOR UPDATE;
 IF NOT FOUND OR c.status<>'draft' THEN RAISE EXCEPTION 'collection_not_draft'; END IF;
 SELECT count(*) INTO v_count FROM public.saliksik_investigations i
  JOIN public.saliksik_question_keys k ON k.investigation_id=i.id
  WHERE i.collection_id=c.id AND i.status='draft' AND i.tier IN('discover','investigate');
 IF v_count<>2 OR EXISTS(SELECT 1 FROM public.saliksik_investigations
    WHERE collection_id=c.id AND tier='master') THEN RAISE EXCEPTION 'master_tier_not_approved'; END IF;
 UPDATE public.saliksik_investigations SET status='published',published_at=now()
 WHERE collection_id=c.id;
 UPDATE public.saliksik_collections SET status='published',published_at=now() WHERE id=c.id;
 RETURN jsonb_build_object('ok',true,'published_count',v_count);
END $fn$;

CREATE OR REPLACE FUNCTION public.saliksik_published_immutable_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF OLD.status='published' THEN RAISE EXCEPTION 'published_version_immutable'; END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $fn$;
DROP TRIGGER IF EXISTS saliksik_lock_published_investigations ON public.saliksik_investigations;
CREATE TRIGGER saliksik_lock_published_investigations
 BEFORE UPDATE OR DELETE ON public.saliksik_investigations
 FOR EACH ROW EXECUTE FUNCTION public.saliksik_published_immutable_v1();
DROP TRIGGER IF EXISTS saliksik_lock_published_keys ON public.saliksik_question_keys;
CREATE OR REPLACE FUNCTION public.saliksik_key_immutable_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF EXISTS(SELECT 1 FROM public.saliksik_investigations i WHERE i.id=OLD.investigation_id AND i.status='published')
 THEN RAISE EXCEPTION 'published_keys_immutable'; END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $fn$;
CREATE TRIGGER saliksik_lock_published_keys BEFORE UPDATE OR DELETE ON public.saliksik_question_keys
 FOR EACH ROW EXECUTE FUNCTION public.saliksik_key_immutable_v1();

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
    'points',CASE i.tier WHEN 'discover' THEN 10 ELSE 20 END,
    'scripture_refs',i.scripture_refs,
    'completed',EXISTS(SELECT 1 FROM public.saliksik_mastery m
      WHERE m.user_id=v_user AND m.investigation_id=i.id AND m.version=i.version))
    ORDER BY c.published_at,i.sequence)
  FROM public.saliksik_investigations i JOIN public.saliksik_collections c ON c.id=i.collection_id
  WHERE c.status='published' AND i.status='published' AND i.tier<>'master'
 ),'[]'::jsonb);
END $fn$;

-- On-demand lesson body: never block Cluster Home on long text.
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
 AND c.status='published' AND i.tier<>'master'
 ),'{}'::jsonb);
END $fn$;

CREATE OR REPLACE FUNCTION public.saliksik_begin_v1(p_scope_id uuid,p_investigation_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_user uuid:=auth.uid(); i public.saliksik_investigations%ROWTYPE;
 v_bank jsonb; v_count int; v_order integer[]; a public.saliksik_attempts%ROWTYPE;
 v_questions jsonb:='[]'::jsonb; v_n int; v_q jsonb;
BEGIN
 IF v_user IS NULL OR NOT public.buklod_user_is_active_scope_member(p_scope_id,v_user)
 OR NOT EXISTS(SELECT 1 FROM public.buklod_scopes
 WHERE id=p_scope_id AND scope_type='CLUSTER' AND status='ACTIVE')
 THEN RAISE EXCEPTION 'active_cluster_membership_required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.saliksik_rollout WHERE id AND member_enabled)
 THEN RAISE EXCEPTION 'saliksik_not_released'; END IF;
 SELECT * INTO i FROM public.saliksik_investigations WHERE id=p_investigation_id AND status='published';
 IF NOT FOUND OR i.tier='master' OR NOT EXISTS(SELECT 1 FROM public.saliksik_collections
   WHERE id=i.collection_id AND status='published') THEN RAISE EXCEPTION 'investigation_not_available'; END IF;
 IF EXISTS(SELECT 1 FROM public.saliksik_mastery m
 WHERE m.user_id=v_user AND m.investigation_id=i.id AND m.version=i.version)
 THEN RETURN jsonb_build_object('completed',true,'points',0); END IF;
 -- Serialize multi-device starts. Never create two open attempts for same scope/content.
 PERFORM pg_advisory_xact_lock(hashtextextended(v_user::text||i.id::text||p_scope_id::text,0));
 UPDATE public.saliksik_attempts SET submitted_at=now(),score=0,passed=false,result_code='expired'
 WHERE user_id=v_user AND scope_id=p_scope_id AND investigation_id=i.id
 AND submitted_at IS NULL AND expires_at<=now();
 SELECT * INTO a FROM public.saliksik_attempts WHERE user_id=v_user AND scope_id=p_scope_id
 AND investigation_id=i.id AND submitted_at IS NULL FOR UPDATE;
 SELECT questions INTO v_bank FROM public.saliksik_question_keys WHERE investigation_id=i.id;
 v_count:=jsonb_array_length(v_bank);
 IF v_count NOT IN(5,10) THEN RAISE EXCEPTION 'question_bank_missing'; END IF;
 IF a.id IS NULL THEN
   SELECT array_agg(n-1 ORDER BY random()) INTO v_order FROM generate_series(1,v_count) n;
   INSERT INTO public.saliksik_attempts(user_id,scope_id,investigation_id,question_order)
   VALUES(v_user,p_scope_id,i.id,v_order) RETURNING * INTO a;
 END IF;
 FOR v_n IN 1..array_length(a.question_order,1) LOOP
   v_q:=v_bank->a.question_order[v_n];
   v_questions:=v_questions||jsonb_build_array(jsonb_build_object(
     'id',v_q->>'id','prompt',v_q->>'prompt','options',v_q->'options',
     'competency',v_q->>'competency'));
 END LOOP;
 RETURN jsonb_build_object('completed',false,'attempt_id',a.id,'expires_at',a.expires_at,
   'investigation_id',i.id,'tier',i.tier,'questions',v_questions);
END $fn$;

CREATE OR REPLACE FUNCTION public.saliksik_submit_v1(p_attempt_id uuid,p_answers jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE a public.saliksik_attempts%ROWTYPE; i public.saliksik_investigations%ROWTYPE;
 c public.saliksik_collections%ROWTYPE; v_bank jsonb; v_n int; v_index int; v_q jsonb;
 v_answer jsonb; v_correct boolean; v_skill text; v_points int; v_weight int;
 v_scores jsonb:='{}'::jsonb; v_hit jsonb:='{}'::jsonb; v_total jsonb:='{}'::jsonb;
 v_score numeric:=0; v_pass boolean:=false; v_core boolean:=true; v_result text;
 v_new boolean; v_ledger uuid; v_series uuid; v_required int; v_earned int;
BEGIN
 SELECT * INTO a FROM public.saliksik_attempts WHERE id=p_attempt_id FOR UPDATE;
 IF NOT FOUND OR auth.uid() IS NULL OR a.user_id<>auth.uid() THEN
 RAISE EXCEPTION 'attempt_not_owned' USING ERRCODE='42501'; END IF;
 IF a.submitted_at IS NOT NULL THEN RETURN jsonb_build_object('ok',true,'passed',a.passed,
   'score',a.score,'competencies',a.competency_scores,'reason',a.result_code,'replayed',true);
 END IF;
 IF a.expires_at<=now() OR NOT public.buklod_user_is_active_scope_member(a.scope_id,a.user_id)
 OR NOT EXISTS(SELECT 1 FROM public.saliksik_rollout WHERE id AND member_enabled)
 THEN RAISE EXCEPTION 'attempt_expired_or_member_inactive'; END IF;
 SELECT * INTO i FROM public.saliksik_investigations WHERE id=a.investigation_id AND status='published';
 SELECT * INTO c FROM public.saliksik_collections WHERE id=i.collection_id AND status='published';
 IF c.id IS NULL OR i.tier='master' THEN RAISE EXCEPTION 'investigation_unavailable'; END IF;
 SELECT questions INTO v_bank FROM public.saliksik_question_keys WHERE investigation_id=i.id;
 v_n:=coalesce(array_length(a.question_order,1),0);
 IF jsonb_typeof(p_answers)<>'array' OR jsonb_array_length(p_answers)<>v_n
 OR v_n<>CASE i.tier WHEN 'discover' THEN 5 ELSE 10 END THEN
 RAISE EXCEPTION 'invalid_answers_count'; END IF;
 FOR v_index IN 1..v_n LOOP
   v_answer:=p_answers->(v_index-1);
   IF jsonb_typeof(v_answer)<>'number' OR v_answer::text !~ '^[0-3]$'
   THEN RAISE EXCEPTION 'invalid_answer_value'; END IF;
   v_q:=v_bank->a.question_order[v_index]; v_skill:=v_q->>'competency';
   IF v_skill NOT IN('understanding','evidence','context','reasoning','transfer')
     THEN RAISE EXCEPTION 'bad_approved_bank'; END IF;
   v_total:=jsonb_set(v_total,ARRAY[v_skill],to_jsonb(coalesce((v_total->>v_skill)::int,0)+1));
   v_correct:=(v_answer::text)::int=(v_q->>'correctIndex')::int;
   IF v_correct THEN
    v_hit:=jsonb_set(v_hit,ARRAY[v_skill],to_jsonb(coalesce((v_hit->>v_skill)::int,0)+1));
   END IF;
 END LOOP;
 FOR v_skill,v_weight IN SELECT * FROM (VALUES ('understanding',20),('evidence',25),
   ('context',20),('reasoning',25),('transfer',10)) v(skill,weight) LOOP
   IF coalesce((v_total->>v_skill)::int,0)<>v_n/5 THEN RAISE EXCEPTION 'bank_coverage_invalid'; END IF;
   v_scores:=jsonb_set(v_scores,ARRAY[v_skill],to_jsonb(
     round(100*coalesce((v_hit->>v_skill)::numeric,0)/(v_total->>v_skill)::numeric)::int));
   v_score:=v_score+v_weight*coalesce((v_hit->>v_skill)::numeric,0)/(v_total->>v_skill)::numeric;
 END LOOP;
 IF i.tier='investigate' THEN
   v_core:=((v_scores->>'evidence')::int>=70
     AND (v_scores->>'context')::int>=70
     AND (v_scores->>'reasoning')::int>=70);
 END IF;
 v_pass:=(round(v_score)::int>=80 AND v_core);
 v_result:=CASE WHEN v_pass THEN 'mastery_verified'
   WHEN round(v_score)::int<80 THEN 'overall_below_80' ELSE 'core_weak' END;
 UPDATE public.saliksik_attempts SET submitted_at=now(),answer_indices=p_answers,
   score=round(v_score)::int,competency_scores=v_scores,passed=v_pass,result_code=v_result
 WHERE id=a.id;
 IF v_pass THEN
   INSERT INTO public.saliksik_mastery(user_id,investigation_id,version)
   VALUES(a.user_id,i.id,i.version)
   ON CONFLICT DO NOTHING RETURNING true INTO v_new;
   IF coalesce(v_new,false) AND NOT public.is_system_admin() THEN
     v_points:=CASE i.tier WHEN 'discover' THEN 10 ELSE 20 END;
     INSERT INTO public.buklod_points_ledger(
      user_id,direction,points,activity_type,source_key,source_id,description)
     VALUES(a.user_id,'credit',v_points,'saliksik_'||i.tier,
      'saliksik:'||i.id||':v'||i.version,i.id,'SALIKSIK verified comprehension')
     ON CONFLICT(user_id,source_key) DO NOTHING RETURNING id INTO v_ledger;
     UPDATE public.saliksik_mastery SET points_ledger_id=v_ledger
     WHERE user_id=a.user_id AND investigation_id=i.id AND version=i.version;
   END IF;
   SELECT count(*) INTO v_required FROM public.saliksik_investigations r
    WHERE r.collection_id=c.id AND r.status='published';
   SELECT count(*) INTO v_earned FROM public.saliksik_mastery m
    JOIN public.saliksik_investigations r ON r.id=m.investigation_id
    WHERE m.user_id=a.user_id AND r.collection_id=c.id AND m.version=r.version
    AND r.status='published';
   IF v_required>=8 AND v_earned=v_required THEN
     v_new:=false;
     INSERT INTO public.saliksik_series_mastery(user_id,collection_id,version)
     VALUES(a.user_id,c.id,c.version)
     ON CONFLICT DO NOTHING RETURNING true INTO v_new;
     IF coalesce(v_new,false) AND NOT public.is_system_admin() THEN
       INSERT INTO public.buklod_points_ledger(
         user_id,direction,points,activity_type,source_key,source_id,description)
       VALUES(a.user_id,'credit',50,'saliksik_series',
         'saliksik:series:'||c.id||':v'||c.version,c.id,'SALIKSIK collection mastery')
       ON CONFLICT(user_id,source_key) DO NOTHING RETURNING id INTO v_series;
       UPDATE public.saliksik_series_mastery SET points_ledger_id=v_series
       WHERE user_id=a.user_id AND collection_id=c.id AND version=c.version;
     END IF;
   END IF;
 END IF;
 RETURN jsonb_build_object('ok',true,'passed',v_pass,'score',round(v_score)::int,
   'competencies',v_scores,'reason',v_result,'points',
   CASE WHEN v_ledger IS NOT NULL THEN v_points ELSE 0 END,
   'series_points',CASE WHEN v_series IS NOT NULL THEN 50 ELSE 0 END,
   'replayed',false);
END $fn$;

-- Rollout switch must be set only after controlled RC verification; no user-facing toggle is created here.
CREATE OR REPLACE FUNCTION public.saliksik_admin_rollout_v1(p_enabled boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF NOT public.is_system_admin() THEN RAISE EXCEPTION 'admin_required' USING ERRCODE='42501'; END IF;
 IF p_enabled AND NOT EXISTS(SELECT 1 FROM public.saliksik_collections WHERE status='published')
 THEN RAISE EXCEPTION 'no_verified_published_collection'; END IF;
 UPDATE public.saliksik_rollout SET member_enabled=p_enabled,updated_at=now() WHERE id=true;
 RETURN p_enabled;
END $fn$;

DO $$
DECLARE f record;
BEGIN
 FOR f IN SELECT p.oid,p.proname,pg_get_function_identity_arguments(p.oid) args
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname LIKE 'saliksik_%_v1' LOOP
   EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC,anon,authenticated',
     f.proname,f.args);
   EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated',f.proname,f.args);
 END LOOP;
END $$;
