-- R4 permission invariants, isolated PostgreSQL 17 only. No real member data.
BEGIN;
DO $test$
DECLARE t text;
BEGIN
 FOR t IN SELECT unnest(ARRAY[
 'saliksik_auto_requests','saliksik_auto_review_jobs',
 'saliksik_research_academic_evidence'])
 LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname=t AND c.relrowsecurity)
  THEN RAISE EXCEPTION 'SALIKSIK R4 missing RLS: %',t; END IF;
  IF has_table_privilege('anon','public.'||t,'SELECT')
   OR has_table_privilege('authenticated','public.'||t,'SELECT')
   OR has_table_privilege('authenticated','public.'||t,'INSERT')
   OR has_table_privilege('authenticated','public.'||t,'UPDATE')
  THEN RAISE EXCEPTION 'R4 sensitive table directly accessible: %',t; END IF;
 END LOOP;
 IF has_function_privilege('authenticated',
  'public.saliksik_auto_lease_r4(uuid,uuid)','EXECUTE')
 OR has_function_privilege('authenticated',
  'public.saliksik_auto_store_r4(uuid,uuid,jsonb)','EXECUTE')
 OR has_function_privilege('authenticated',
  'public.saliksik_auto_master_lease_r4(uuid,uuid)','EXECUTE')
 OR has_function_privilege('authenticated',
  'public.saliksik_auto_master_settle_r4(uuid,uuid,jsonb,jsonb,boolean,text,jsonb,jsonb)','EXECUTE')
 OR has_function_privilege('anon',
  'public.saliksik_research_request_r4(uuid,text,text,text)','EXECUTE')
 THEN RAISE EXCEPTION 'R4 privileged generator or settlement was exposed'; END IF;
 IF NOT has_function_privilege('service_role',
  'public.saliksik_auto_store_r4(uuid,uuid,jsonb)','EXECUTE')
 OR NOT has_function_privilege('service_role',
  'public.saliksik_auto_master_settle_r4(uuid,uuid,jsonb,jsonb,boolean,text,jsonb,jsonb)','EXECUTE')
 OR NOT has_function_privilege('authenticated',
  'public.saliksik_research_request_r4(uuid,text,text,text)','EXECUTE')
 THEN RAISE EXCEPTION 'R4 expected service or member function grant missing'; END IF;
 IF has_function_privilege('anon',
  'public.saliksik_academic_evidence_receipt_r4(uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'Anonymous academic evidence leak'; END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.buckets
    WHERE id='saliksik-source-originals' AND public=false)
 THEN RAISE EXCEPTION 'Original manuscript storage has been exposed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.buklod_point_rules
  WHERE activity_type='saliksik_master' AND base_points=35 AND is_active)
 THEN RAISE EXCEPTION 'Canonical Master rule changed'; END IF;
END $test$;
ROLLBACK;
SELECT 'SALIKSIK R4 AUTH/RLS/SERVICE-ROLE GATES PASS' AS verdict;
