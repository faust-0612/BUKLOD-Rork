-- Isolated PostgreSQL QA only, AFTER R1+R2 migrations and complete nine-part fixture.
BEGIN;
DO $test$
DECLARE c uuid; r jsonb; denied boolean:=false; before_credits int; v_all_pending boolean;
BEGIN
 IF has_function_privilege('anon','public.saliksik_manuscript_access_v1(uuid)','EXECUTE')
 OR has_function_privilege('anon','public.saliksik_admin_set_original_rights_v1(uuid,boolean,text)','EXECUTE')
 THEN RAISE EXCEPTION 'Anonymous manuscript/rights access'; END IF;
 IF NOT has_function_privilege('authenticated','public.saliksik_manuscript_access_v1(uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'Verified member RPC inaccessible'; END IF;
 SELECT id INTO c FROM public.saliksik_collections
 WHERE source_id='dddddddd-dddd-dddd-dddd-dddddddddddd';
 IF c IS NULL THEN RAISE EXCEPTION 'Test collection not published'; END IF;
 SELECT count(*) INTO before_credits FROM public.buklod_points_ledger
 WHERE user_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
 SELECT coalesce(bool_and(l.claim_state='pending'),false) INTO v_all_pending
 FROM public.buklod_points_ledger l
 WHERE l.user_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
 -- Authentic member completed all nine but never clicked Claim.
 PERFORM set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',true);
 EXECUTE 'SET LOCAL ROLE authenticated';
 r:=public.saliksik_manuscript_access_v1(c);
 IF (r->>'original_available')::boolean OR jsonb_array_length(r->'chapters')<>9
 OR r->>'original_storage_path' IS NOT NULL
 OR r->>'title' IS DISTINCT FROM 'Verified Manuscript Collection'
 THEN RAISE EXCEPTION 'Derived manuscript unlock/rights check failed: %',r; END IF;
 IF (r->'chapters'->0->>'lesson_text') IS NULL
 THEN RAISE EXCEPTION 'Complete published chapter body missing'; END IF;
 IF NOT v_all_pending
 THEN RAISE EXCEPTION 'Download required a Points claim'; END IF;
 -- Other signed-in user must never gain access by guessing the collection UUID.
 PERFORM set_config('request.jwt.claim.sub','cccccccc-cccc-cccc-cccc-cccccccccccc',true);
 BEGIN PERFORM public.saliksik_manuscript_access_v1(c);
 EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Unqualified user accessed completed manuscript'; END IF;
 denied:=false;
 BEGIN
  PERFORM public.saliksik_admin_set_original_rights_v1(c,true,'Testing unauthorized redistribution.');
 EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Member changed original distribution rights'; END IF;
 -- Owner explicitly confirms rights once for this original; member download then
 -- becomes automatically available to all eligible users, no per-member approval.
 PERFORM set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',true);
 r:=public.saliksik_admin_set_original_rights_v1(
 'dddddddd-dddd-dddd-dddd-dddddddddddd',true,
 'MZB Ministry Inc. confirms the right to distribute this complete source manuscript.'
 );
 IF r->>'allowed'<>'true' THEN RAISE EXCEPTION 'Rights authorization failed'; END IF;
 PERFORM set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',true);
 r:=public.saliksik_manuscript_access_v1(c);
 IF r->>'original_available'<>'true'
 OR r->>'original_storage_path' IS DISTINCT FROM
    'originals/dddddddd-dddd-dddd-dddd-dddddddddddd.txt'
 THEN RAISE EXCEPTION 'Licensed original not made available to completer: %',r; END IF;
 -- Disabled rollout halts new signing; RLS still denies direct original download.
 EXECUTE 'RESET ROLE';
 UPDATE public.saliksik_rollout SET member_enabled=false WHERE id=true;
 EXECUTE 'SET LOCAL ROLE authenticated';
 denied:=false;
 BEGIN PERFORM public.saliksik_manuscript_access_v1(c);
 EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Disabled rollout leaked manuscript'; END IF;
 EXECUTE 'RESET ROLE';
 IF (SELECT count(*) FROM public.buklod_points_ledger
     WHERE user_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')<>before_credits
 THEN RAISE EXCEPTION 'Download changed canonical Points'; END IF;
END $test$;
ROLLBACK;
SELECT 'SALIKSIK full manuscript entitlement + private originals PASS' AS verdict;
