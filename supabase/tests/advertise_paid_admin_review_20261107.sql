-- Non-destructive contract test for paid advertising submission-to-admin review.
-- The test never creates or marks a real payment as received.
BEGIN;
DO $check$
DECLARE
  v_rpc text;
  v_price text;
  v_policy text;
BEGIN
  SELECT pg_get_functiondef('public.buklod_admin_review_paid_ad_v1(uuid,text)'::regprocedure)
    INTO v_rpc;
  IF v_rpc IS NULL THEN RAISE EXCEPTION 'Missing paid ad admin review RPC'; END IF;

  IF position('public.is_system_admin()' in v_rpc)=0
     OR position('FOR UPDATE' in v_rpc)=0
     OR position('verify_payment' in v_rpc)=0
     OR position('approve' in v_rpc)=0
     OR position('reject' in v_rpc)=0
     OR position('payment_status NOT IN' in v_rpc)=0
     OR v_rpc !~ 'amount_paid[[:space:]]*<'
     OR position('30 days' in v_rpc)=0
     OR position('approved_by' in v_rpc)=0 THEN
    RAISE EXCEPTION 'Paid ad admin review authorization, locking, payment or schedule guard missing';
  END IF;

  IF NOT has_function_privilege('authenticated','public.buklod_admin_review_paid_ad_v1(uuid,text)','EXECUTE')
    OR has_function_privilege('anon','public.buklod_admin_review_paid_ad_v1(uuid,text)','EXECUTE') THEN
    RAISE EXCEPTION 'Review RPC grants allow anonymous use or block signed-in admins';
  END IF;

  SELECT qual INTO v_policy FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname='paid_ad_payment_admin_read_v1' AND cmd='SELECT';
  IF v_policy IS NULL
     OR position('paid-ad-payment' in v_policy)=0
     OR position('is_system_admin()' in v_policy)=0 THEN
    RAISE EXCEPTION 'Private payment proof reader policy is missing admin-only gate';
  END IF;

  SELECT pg_get_functiondef('public.buklod_set_paid_ad_price()'::regprocedure)
    INTO v_price;
  IF position('TG_OP' in v_price)=0
     OR position('UPDATE' in v_price)=0
     OR position('monthly_price' in v_price)=0 THEN
    RAISE EXCEPTION 'Advertising price snapshot not preserved across status review';
  END IF;

  IF (SELECT count(*) FROM public.buklod_paid_ad_campaigns WHERE status='approved'
      AND payment_status NOT IN ('paid','waived'))>0 THEN
    RAISE EXCEPTION 'An unpaid campaign is already approved';
  END IF;

  PERFORM set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000000',true);
  BEGIN
    PERFORM public.buklod_admin_review_paid_ad_v1('00000000-0000-4000-8000-000000000000'::uuid,'approve');
    RAISE EXCEPTION 'Unauthenticated actor unexpectedly allowed to approve';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  RAISE NOTICE 'PASS: paid ad admin RPC, private proof, snapshot, permissions and anonymous denial';
END
$check$;
ROLLBACK;
