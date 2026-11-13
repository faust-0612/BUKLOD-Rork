-- Ephemeral database only. Role-authenticated RPC test: no production service credentials.
\set ON_ERROR_STOP on
INSERT INTO storage.objects(bucket_id,name) VALUES
('saliksik-source-originals','originals/dddddddd-dddd-dddd-dddd-dddddddddddd.txt');
INSERT INTO public.saliksik_sources(id,uploaded_by,title,file_name,mime_type,storage_path,size_bytes,content_sha256,status)
VALUES(
'dddddddd-dddd-dddd-dddd-dddddddddddd','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
'Verified Manuscript Collection','verified-manuscript.txt','text/plain',
'originals/dddddddd-dddd-dddd-dddd-dddddddddddd.txt',10000,repeat('a',64),'queued'
);
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',false);
DO $test$
DECLARE v_lease jsonb; v_collection uuid;
 v_bank_discover jsonb; v_bank_investigate jsonb; v_payload jsonb;
 v_excerpt text:=repeat('The source explicitly states that the Word is eternal and calls for contextual evidence. ',12);
 v_lesson text:=repeat('Careful understanding evaluates the text, its context, the evidence and possible counterarguments. ',5);
 v_source uuid:='dddddddd-dddd-dddd-dddd-dddddddddddd';
 v_i int; v_comp text; v_n int; v_bank jsonb; v_review jsonb;
BEGIN
 FOR v_i IN 1..4 LOOP
  v_lease:=public.saliksik_admin_lease_v1(v_source);
  IF (v_lease->>'next_sequence')::int<>2*v_i-1 THEN
   RAISE EXCEPTION 'Unexpected generation cursor %',v_lease; END IF;
  -- five items, one per competency; ten items, two per competency
  SELECT jsonb_agg(jsonb_build_object('id',comp||'-1',
       'prompt','Which interpretation accurately reflects the provided verified source for '||comp||'?',
       'options',jsonb_build_array('The source is contextual','Ignore all citations','Every claim lacks evidence','Context is unimportant'),
       'correctIndex',0,'competency',comp,
       'evidence','The source explicitly states that the Word is eternal and calls for contextual evidence.'))
   INTO v_bank_discover
   FROM unnest(ARRAY['understanding','evidence','context','reasoning','transfer']) comp;
  SELECT jsonb_agg(jsonb_build_object('id',comp||'-'||n,
       'prompt','Which supported response best fits the source for '||comp||' scenario '||n||'?',
       'options',jsonb_build_array('The source is contextual','Ignore all citations','Every claim lacks evidence','Context is unimportant'),
       'correctIndex',0,'competency',comp,
       'evidence','The source explicitly states that the Word is eternal and calls for contextual evidence.'))
   INTO v_bank_investigate
   FROM unnest(ARRAY['understanding','evidence','context','reasoning','transfer']) comp
   CROSS JOIN generate_series(1,2) n;
  v_payload:=jsonb_build_object('investigations',jsonb_build_array(
    jsonb_build_object('tier','discover','title','Discover source section '||(2*v_i-1),
      'summary','Understand one meaningful source section with textual evidence.',
      'lesson_text',v_lesson,'source_excerpt',v_excerpt,
      'scripture_refs',jsonb_build_array('John 1:1'),'questions',v_bank_discover),
    jsonb_build_object('tier','investigate','title','Investigate source section '||(2*v_i),
      'summary','Analyze another source section with reasoning and contextual evidence.',
      'lesson_text',v_lesson,'source_excerpt',v_excerpt,
      'scripture_refs',jsonb_build_array('John 1:1'),'questions',v_bank_investigate)
  ));
  v_review:=public.saliksik_admin_store_draft_v1(
     v_source,(v_lease->>'token')::uuid,v_payload);
  IF (v_review->>'total_investigations')::int<>2*v_i THEN
   RAISE EXCEPTION 'Draft batch failed %',v_review; END IF;
  v_collection:=(v_review->>'collection_id')::uuid;
 END LOOP;
 IF (public.saliksik_admin_publish_v1(v_collection)->>'published_count')::int<>9 THEN
  RAISE EXCEPTION 'Eight objective and one written Master not published'; END IF;
 IF public.saliksik_admin_rollout_v1(true) IS DISTINCT FROM true THEN
  RAISE EXCEPTION 'Rollout activation failed in ephemeral QA'; END IF;
END $test$;

-- Member cannot inspect answer key or source; only RPCs are available.
SELECT set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',false);
DO $test$
DECLARE v_catalog jsonb; v_item jsonb; v_begin jsonb; v_answers jsonb;
 v_result jsonb; v_index int:=0; v_scope uuid:='11111111-1111-1111-1111-111111111111';
 v_total int:=0; v_series int:=0; v_replay jsonb; v_master uuid; v_master_submit jsonb;
BEGIN
 v_catalog:=public.saliksik_catalog_v1(v_scope);
 IF jsonb_array_length(v_catalog)<>9 THEN RAISE EXCEPTION 'Incorrect catalog size'; END IF;
 FOR v_item IN SELECT value FROM jsonb_array_elements(v_catalog) LOOP
  IF v_item->>'tier'='master' THEN
    v_master:=(v_item->>'id')::uuid;
    CONTINUE;
  END IF;
  v_index:=v_index+1;
  v_begin:=public.saliksik_begin_v1(v_scope,(v_item->>'id')::uuid);
  IF jsonb_array_length(v_begin->'questions') NOT IN (5,10) THEN
   RAISE EXCEPTION 'Wrong assessment length for %',v_item; END IF;
  SELECT jsonb_agg(0) INTO v_answers FROM generate_series(1,jsonb_array_length(v_begin->'questions'));
  v_result:=public.saliksik_submit_v1((v_begin->>'attempt_id')::uuid,v_answers);
  IF v_result->>'passed'<>'true' THEN RAISE EXCEPTION 'Pass failed %',v_result; END IF;
  IF (v_result->>'points')::int<>(v_item->>'points')::int
    THEN RAISE EXCEPTION 'Unexpected tier reward %',v_result; END IF;
  IF v_result->>'claim_state'<>'pending' THEN
    RAISE EXCEPTION 'Reward must remain claimable/pending, not silently available'; END IF;
  v_total:=v_total+(v_result->>'points')::int;
  v_series:=v_series+(v_result->>'series_points')::int;
  IF (v_result->>'series_points')::int<>0 THEN
    RAISE EXCEPTION 'Series reward before written Master is forbidden'; END IF;
  v_replay:=public.saliksik_submit_v1((v_begin->>'attempt_id')::uuid,v_answers);
  IF v_replay->>'replayed'<>'true' THEN
    RAISE EXCEPTION 'Submission must be replay-idempotent'; END IF;
 END LOOP;
 IF v_index<>8 OR v_master IS NULL OR v_total<>120 OR v_series<>0 THEN
  RAISE EXCEPTION 'Wrong objective totals or missing Master: % % %',v_total,v_series,v_master; END IF;
 v_master_submit:=public.saliksik_master_submit_v1(
   v_scope,v_master,jsonb_build_array(
   repeat('I cite John 1:1 and analyze the surrounding context with independent textual support. ',5),
   repeat('I consider a fair counterargument about context and explain why evidence can address it. ',5),
   repeat('I apply the source-derived principle to a new scenario and acknowledge limitations. ',5)
   ));
 IF v_master_submit->>'pending'<>'true' OR v_master_submit->>'submission_id' IS NULL
 THEN RAISE EXCEPTION 'Master essay did not enter secure review queue: %',v_master_submit; END IF;
 PERFORM set_config('saliksik.test.master_submission',v_master_submit->>'submission_id',false);
END $test$;

-- Only the authorized System Admin may assess a distinct member's citations.
SELECT set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',false);
DO $test$
DECLARE v_review jsonb;
BEGIN
 v_review:=public.saliksik_admin_master_review_v1(
   current_setting('saliksik.test.master_submission')::uuid,
   '{"understanding":90,"evidence":95,"context":90,"reasoning":90,"transfer":85}'::jsonb,
   true,
   'The cited passage and surrounding context were checked against the approved source. '
   ||'The member addresses a plausible objection and applies evidence to a distinct case.');
 IF v_review->>'approved'<>'true'
 OR (v_review->>'points')::int<>35
 OR (v_review->>'series_points')::int<>50
 THEN RAISE EXCEPTION 'Written Master or final series did not award exact pending points: %',v_review; END IF;
END $test$;
RESET ROLE;
DO $test$
DECLARE v_sum int; v_count int; v_events int;
BEGIN
 SELECT coalesce(sum(points),0),count(*) INTO v_sum,v_count
 FROM public.buklod_points_ledger WHERE user_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
 SELECT count(*) INTO v_events FROM public.buklod_reward_events
 WHERE user_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
 IF v_sum<>205 OR v_count<>10 OR v_events<>10
 THEN RAISE EXCEPTION 'Duplicate, missing or unclaimed reward % % %',v_sum,v_count,v_events; END IF;
 IF EXISTS(SELECT 1 FROM public.buklod_points_ledger WHERE claim_state<>'pending')
 THEN RAISE EXCEPTION 'Rewards bypassed claim workflow'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.buklod_point_rules WHERE activity_type='saliksik_master' AND is_active)
 THEN RAISE EXCEPTION 'Source-verified written Master rule should be active'; END IF;
END $test$;
SELECT 'SALIKSIK SQL E2E PASS: 9 verifications, 205 pending canonical BUKLOD Points, 10 reward events, no duplicate' AS verdict;
