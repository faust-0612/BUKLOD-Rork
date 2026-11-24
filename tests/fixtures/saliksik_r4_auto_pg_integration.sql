-- Isolated 17/PostgREST-role simulation. Run AFTER R1/R2/R3 migrations+fixtures.
\set ON_ERROR_STOP on

-- Ordinary member starts research without any admin source upload.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',false);
SELECT set_config('request.jwt.claim.role','authenticated',false);
DO $test$
DECLARE r jsonb; denied boolean:=false; v_id uuid;
BEGIN
 r:=public.saliksik_research_request_r4(
 '11111111-1111-1111-1111-111111111111',
 'What does the Word in John 1 reveal about evidence and context?',
 'Juan 1:1-14','exegetical');
 IF r->>'status'<>'queued' OR r->>'request_id' IS NULL OR r->>'scripture_anchor'<>'John 1:1-14'
 THEN RAISE EXCEPTION 'Research request did not queue: %',r; END IF;
 v_id:=(r->>'request_id')::uuid;
 PERFORM set_config('saliksik.r4.request',v_id::text,false);
 r:=public.saliksik_research_request_r4(
 '11111111-1111-1111-1111-111111111111',
 'What does the Word in John 1 reveal about evidence and context?',
 'Juan 1:1-14','exegetical');
 IF (r->>'request_id')::uuid<>v_id THEN
 RAISE EXCEPTION 'Duplicate topic created a second paid research job'; END IF;
 IF (SELECT count(*) FROM public.buklod_points_ledger WHERE user_id=auth.uid())<>10
 THEN RAISE EXCEPTION 'Opening/asking research created illegal points'; END IF;
 BEGIN PERFORM public.saliksik_auto_lease_r4(v_id,auth.uid());
 EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Member reached privileged generator lease'; END IF;
 denied:=false;
 BEGIN PERFORM public.saliksik_manuscript_access_v1(
  'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid);
 EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Uncompleted manuscript access bypassed'; END IF;
END $test$;

-- A different member cannot inspect research queue or take over its job.
SELECT set_config('request.jwt.claim.sub','cccccccc-cccc-cccc-cccc-cccccccccccc',false);
DO $test$
DECLARE denied boolean:=false;
BEGIN
 BEGIN
 PERFORM public.saliksik_research_status_r4(current_setting('saliksik.r4.request')::uuid);
 EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Research request leaked across users'; END IF;
END $test$;
RESET ROLE;

-- Service Edge securely claims four resumable batches. Schema, verbatim
-- evidence overlaps and independent critic declaration must pass each time.
SET ROLE service_role;
SELECT set_config('request.jwt.claim.role','service_role',false);
DO $test$
DECLARE v_source text;v_excerpt text;v_lease jsonb;v_payload jsonb;
 v_discover jsonb;v_investigate jsonb;v_receipt jsonb;v_count int;
 v_request uuid:=current_setting('saliksik.r4.request')::uuid;
 v_comp text;v_i int;v_collection uuid;
BEGIN
 FOR v_i IN 1..4 LOOP
  v_lease:=public.saliksik_auto_lease_r4(
    v_request,'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid);
  IF v_lease->>'busy'='true' OR (v_lease->>'next_sequence')::int<>(v_i*2-1)
  THEN RAISE EXCEPTION 'Incorrect resumable generation cursor %',v_lease; END IF;
  v_source:=v_lease->>'source_text';
  v_excerpt:=substring(v_source from 1 for 74);
  SELECT jsonb_agg(jsonb_build_object('id',comp||'-1',
   'prompt','Which verified contextual interpretation best fits section '||v_i||' for '||comp||'?',
   'options',jsonb_build_array('The source describes the Word in its context',
     'The source cannot be examined','No Bible reference can matter','Ignore the source'),
   'correctIndex',0,'competency',comp,'evidence',v_excerpt))
   INTO v_discover
  FROM unnest(ARRAY['understanding','evidence','context','reasoning','transfer']) comp;
  SELECT jsonb_agg(jsonb_build_object('id',comp||'-'||n,
   'prompt','Which sound claim applies to section '||v_i||' competency '||comp||' and case '||n||'?',
   'options',jsonb_build_array('The source describes the Word in its context',
     'The source cannot be examined','No Bible reference can matter','Ignore the source'),
   'correctIndex',0,'competency',comp,'evidence',v_excerpt))
   INTO v_investigate
  FROM unnest(ARRAY['understanding','evidence','context','reasoning','transfer']) comp
  CROSS JOIN generate_series(1,2) n;
  v_payload:=jsonb_build_object(
   'verification',jsonb_build_object('critic_model','isolated_test_critic','critic_approved',true),
   'investigations',jsonb_build_array(
    jsonb_build_object('tier','discover','title','Automatically verified discovery section '||v_i,
     'summary','Read the bounded canonical Bible text with accurate evidence.',
     'lesson_text',repeat('The biblical source is read carefully with contextual analysis and a fair consideration of alternative interpretations. ',4),
     'source_excerpt',v_source,'scripture_refs',jsonb_build_array('John 1:1-14'),
     'questions',v_discover),
    jsonb_build_object('tier','investigate','title','Automatically verified investigation section '||v_i,
     'summary','Compare multiple evidence-backed interpretations of the passage.',
     'lesson_text',repeat('Research examines context, possible readings, and careful reasoning without unsupported doctrinal conclusions. ',4),
     'source_excerpt',v_source,'scripture_refs',jsonb_build_array('John 1:1-14'),
     'questions',v_investigate)));
  v_receipt:=public.saliksik_auto_store_r4(v_request,(v_lease->>'token')::uuid,v_payload);
  IF (v_receipt->>'progress')::int<>2*v_i THEN
   RAISE EXCEPTION 'Resumable generation failed at part %, receipt %',v_i,v_receipt; END IF;
  IF v_i=4 THEN
   IF v_receipt->>'status'<>'ready' THEN
    RAISE EXCEPTION 'Research not automatically published'; END IF;
   v_collection:=(v_receipt->>'collection_id')::uuid;
   PERFORM set_config('saliksik.r4.collection',v_collection::text,false);
  END IF;
 END LOOP;
END $test$;
RESET ROLE;

-- Member authenticates, sees all 9 (4 Discover, 4 Investigate, 1 Master),
-- passes objective grading and submits three independently written essays.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',false);
SELECT set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',false);
DO $test$
DECLARE v_collection uuid:=current_setting('saliksik.r4.collection')::uuid;
 v_scope uuid:='11111111-1111-1111-1111-111111111111';
 v_catalog jsonb;v_item jsonb;v_begin jsonb;v_result jsonb;v_answers jsonb;
 v_master uuid;v_count int:=0;v_submit jsonb;v_denied boolean:=false;
BEGIN
 v_catalog:=public.saliksik_catalog_v1(v_scope);
 FOR v_item IN SELECT value FROM jsonb_array_elements(v_catalog) LOOP
  IF (v_item->>'collection_id')::uuid IS DISTINCT FROM v_collection THEN CONTINUE; END IF;
  v_count:=v_count+1;
  IF v_item->>'source_mode'<>'CANONICAL_BIBLE_CORPUS'
  THEN RAISE EXCEPTION 'Missing auto research mode in catalog'; END IF;
  IF v_item->>'tier'='master' THEN
   v_master:=(v_item->>'id')::uuid;
   CONTINUE;
  END IF;
  v_begin:=public.saliksik_begin_v1(v_scope,(v_item->>'id')::uuid);
  SELECT jsonb_agg(0) INTO v_answers
    FROM generate_series(1,jsonb_array_length(v_begin->'questions'));
  v_result:=public.saliksik_submit_v1((v_begin->>'attempt_id')::uuid,v_answers);
  IF v_result->>'passed'<>'true' OR v_result->>'claim_state'<>'pending'
  THEN RAISE EXCEPTION 'Objective verified credit failed %',v_result; END IF;
 END LOOP;
 IF v_count<>9 OR v_master IS NULL THEN RAISE EXCEPTION 'Incorrect auto research catalog %',v_count; END IF;
 BEGIN PERFORM public.saliksik_manuscript_access_v1(v_collection);
 EXCEPTION WHEN insufficient_privilege THEN v_denied:=true; END;
 IF NOT v_denied THEN RAISE EXCEPTION 'Manuscript unlocked before written Master'; END IF;
 v_submit:=public.saliksik_master_submit_v1(v_scope,v_master,jsonb_build_array(
  repeat('A careful reading of John 1:1 requires interpretation supported by the wider canonical context and the immediate evidence. ',4),
  repeat('We compare an alternative reading at John 1:2, identify source-specific limits and avoid attacking different religious traditions. ',4),
  repeat('A hypothetical researcher should examine John 1:3 in context and acknowledge uncertainty before applying the conclusion in public. ',4)
 ));
 IF v_submit->>'pending'<>'true' OR v_submit->>'submission_id' IS NULL
 THEN RAISE EXCEPTION 'Independent Master submission missing'; END IF;
 PERFORM set_config('saliksik.r4.submission',v_submit->>'submission_id',false);
END $test$;
RESET ROLE;

-- An unsupported citation fails despite high scores, followed by legitimate
-- independent source validation and versioned resubmission.
SET ROLE service_role;
SELECT set_config('request.jwt.claim.role','service_role',false);
DO $test$
DECLARE v_lease jsonb;v_result jsonb;
 v_sub uuid:=current_setting('saliksik.r4.submission')::uuid;
 v_scores jsonb:='{"understanding":90,"evidence":95,"context":90,"reasoning":90,"transfer":85}'::jsonb;
 v_evidence jsonb:='[{"section":1,"verified":false},{"section":2,"verified":false},{"section":3,"verified":false}]'::jsonb;
BEGIN
 v_lease:=public.saliksik_auto_master_lease_r4(
  v_sub,'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid);
 IF v_lease->>'token' IS NULL THEN RAISE EXCEPTION 'Auto written lease not acquired'; END IF;
 v_result:=public.saliksik_auto_master_settle_r4(
  v_sub,(v_lease->>'token')::uuid,v_scores,v_scores,false,
  'The arguments appear substantial but not all three precise citations were independently checked against the canonical text and its surrounding context.',
  v_evidence,'{"assessor":"isolated_1","verifier":"isolated_2"}'::jsonb);
 IF v_result->>'approved'<>'false' OR (v_result->>'points')::int<>0
 THEN RAISE EXCEPTION 'Unverified citations issued Master credit: %',v_result; END IF;
END $test$;
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',false);
SELECT set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',false);
DO $test$
DECLARE v_submit jsonb;v_collection uuid:=current_setting('saliksik.r4.collection')::uuid;
 v_master uuid;
BEGIN
 SELECT (item->>'id')::uuid INTO v_master
 FROM jsonb_array_elements(public.saliksik_catalog_v1(
  '11111111-1111-1111-1111-111111111111'::uuid)) item
 WHERE (item->>'collection_id')::uuid=v_collection AND item->>'tier'='master';
 v_submit:=public.saliksik_master_submit_v1(
  '11111111-1111-1111-1111-111111111111',v_master,jsonb_build_array(
  repeat('The revised exegetical analysis cites John 1:1 and considers the narrative context with accurate source references. ',5),
  repeat('An alternative explanation of John 1:2 is represented fairly while each inference is tested against canonical evidence. ',5),
  repeat('In practical teaching the student may use John 1:3 to explain the same principle carefully, including limitations. ',5)
 ));
 IF v_submit->>'pending'<>'true' THEN RAISE EXCEPTION 'Revision not accepted'; END IF;
 PERFORM set_config('saliksik.r4.submission',v_submit->>'submission_id',false);
END $test$;
RESET ROLE;

SET ROLE service_role;
SELECT set_config('request.jwt.claim.role','service_role',false);
DO $test$
DECLARE v_lease jsonb;v_result jsonb;
 v_sub uuid:=current_setting('saliksik.r4.submission')::uuid;
 v_a jsonb:='{"understanding":90,"evidence":94,"context":90,"reasoning":90,"transfer":84}'::jsonb;
 v_b jsonb:='{"understanding":92,"evidence":90,"context":93,"reasoning":88,"transfer":88}'::jsonb;
 v_evidence jsonb:='[{"section":1,"verified":true,"refs":["John 1:1"]},{"section":2,"verified":true,"refs":["John 1:2"]},{"section":3,"verified":true,"refs":["John 1:3"]}]'::jsonb;
BEGIN
 v_lease:=public.saliksik_auto_master_lease_r4(v_sub,
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid);
 v_result:=public.saliksik_auto_master_settle_r4(
  v_sub,(v_lease->>'token')::uuid,v_a,v_b,true,
  'Independent reviewers confirmed each canonical citation in context. Three distinct written arguments demonstrate source support, fair comparison and transfer to an unfamiliar case.',
  v_evidence,'{"assessor":"isolated_independent_1","verifier":"isolated_independent_2"}'::jsonb);
 IF v_result->>'approved'<>'true' OR (v_result->>'points')::int<>35
 OR (v_result->>'series_points')::int<>50
 THEN RAISE EXCEPTION 'Automatic Master + series failed %',v_result; END IF;
 IF (public.saliksik_auto_master_lease_r4(v_sub,
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid)->>'completed')<>'true'
 THEN RAISE EXCEPTION 'Automatic Master replay was not idempotent'; END IF;
END $test$;
RESET ROLE;

-- Completed user immediately owns the complete *licensed study manuscript*,
-- even while the BUKLOD Points claim state remains pending.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',false);
SELECT set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',false);
DO $test$
DECLARE v_collection uuid:=current_setting('saliksik.r4.collection')::uuid;
 v_download jsonb;v_academic jsonb;
BEGIN
 v_download:=public.saliksik_manuscript_access_v1(v_collection);
 IF jsonb_array_length(v_download->'chapters')<>9
 OR v_download->>'source_mode'<>'CANONICAL_BIBLE_CORPUS'
 OR v_download->>'original_available'<>'false'
 OR v_download->>'original_storage_path' IS NOT NULL
 THEN RAISE EXCEPTION 'Full automatic study manuscript not accessible %',v_download; END IF;
 v_academic:=public.saliksik_academic_evidence_receipt_r4(v_collection);
 IF v_academic->>'academic_evidence_verified'<>'true'
 OR v_academic->>'university_credits' IS DISTINCT FROM 'awaiting_authorized_registrar_policy'
 THEN RAISE EXCEPTION 'Academic completion evidence fabricated or missing %',v_academic; END IF;
END $test$;
RESET ROLE;

DO $test$
DECLARE v_credits int;v_events int;
BEGIN
 SELECT count(*) INTO v_credits FROM public.buklod_points_ledger
 WHERE user_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
 SELECT count(*) INTO v_events FROM public.buklod_reward_events
 WHERE user_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
 IF v_credits<>20 OR v_events<>20
 THEN RAISE EXCEPTION 'Expected original and automated collections 10+10 unique pending events, got % %',v_credits,v_events; END IF;
 IF EXISTS(SELECT 1 FROM public.buklod_points_ledger
  WHERE user_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' AND claim_state<>'pending')
 THEN RAISE EXCEPTION 'Manual claim was bypassed'; END IF;
 IF (SELECT count(*) FROM public.saliksik_research_academic_evidence
  WHERE user_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')<>1
 THEN RAISE EXCEPTION 'Verified academic evidence missing or duplicated'; END IF;
 IF (SELECT count(*) FROM public.saliksik_auto_review_jobs
  WHERE status='settled')<>2
 THEN RAISE EXCEPTION 'Independent review audit trail missing'; END IF;
END $test$;
SELECT 'SALIKSIK R4 E2E PASS: zero Admin preparation, automatic research, two independent Master graders, 9-part full manuscript, 205 fresh pending BP, academic evidence' AS verdict;
