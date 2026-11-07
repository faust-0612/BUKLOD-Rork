-- BUKLOD self-serve advertising: reconnect advertiser submissions to the
-- existing system-admin sponsor console, with separate proof/payment review.
-- Never approve or activate a campaign merely because a user submitted it.
--
-- Keep the submitted price snapshot unchanged when payment/status is reviewed.
CREATE OR REPLACE FUNCTION public.buklod_set_paid_ad_price()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $fn$
DECLARE v_price numeric(12,2);
BEGIN
  IF TG_OP = 'INSERT'
     OR NEW.coverage_level IS DISTINCT FROM OLD.coverage_level
     OR NEW.creative_type IS DISTINCT FROM OLD.creative_type THEN
    IF NEW.advertiser_user_id IS NOT NULL THEN
      SELECT monthly_price INTO v_price
      FROM public.buklod_ad_self_service_rates
      WHERE coverage_level=NEW.coverage_level
        AND creative_type=NEW.creative_type
        AND is_active=true;
      IF v_price IS NOT NULL THEN NEW.monthly_price := v_price; END IF;
    ELSIF NEW.monthly_price IS NULL THEN
      SELECT monthly_price INTO v_price FROM public.buklod_ad_rate_cards
      WHERE coverage_level=NEW.coverage_level;
      NEW.monthly_price := v_price;
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END
$fn$;

-- Private payment proofs may be read only by an active System Admin.
-- Advertisers can INSERT their own objects; proofs are never public.
DROP POLICY IF EXISTS paid_ad_payment_admin_read_v1 ON storage.objects;
CREATE POLICY paid_ad_payment_admin_read_v1 ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id='paid-ad-payment' AND public.is_system_admin());

CREATE OR REPLACE FUNCTION public.buklod_admin_review_paid_ad_v1(
  p_campaign_id uuid,
  p_action text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $fn$
DECLARE
  v_actor uuid := auth.uid();
  v_ad public.buklod_paid_ad_campaigns%ROWTYPE;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF v_actor IS NULL OR NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'Advertising admin access denied' USING ERRCODE='42501';
  END IF;
  IF p_campaign_id IS NULL OR p_action IS NULL OR p_action NOT IN ('verify_payment','approve','reject','pause','resume') THEN
    RAISE EXCEPTION 'Invalid advertising action';
  END IF;

  SELECT * INTO v_ad FROM public.buklod_paid_ad_campaigns
  WHERE id=p_campaign_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Advertising campaign not found'; END IF;

  IF p_action='verify_payment' THEN
    IF v_ad.status <> 'pending' OR v_ad.payment_status <> 'pending' THEN
      RAISE EXCEPTION 'Payment already reviewed or campaign not pending';
    END IF;
    IF coalesce(v_ad.monthly_price,0)<=0 OR coalesce(btrim(v_ad.payment_reference),'')='' THEN
      RAISE EXCEPTION 'Payment reference or amount missing; verify with payment provider before confirming';
    END IF;
    UPDATE public.buklod_paid_ad_campaigns
    SET payment_status='paid', amount_paid=v_ad.monthly_price
    WHERE id=p_campaign_id;

  ELSIF p_action='approve' THEN
    IF v_ad.status <> 'pending' THEN
      RAISE EXCEPTION 'Only pending campaigns can be approved';
    END IF;
    IF NOT v_ad.policy_confirmed OR v_ad.payment_status NOT IN ('paid','waived')
       OR (v_ad.payment_status='paid' AND
           (coalesce(v_ad.monthly_price,0)<=0 OR v_ad.amount_paid<v_ad.monthly_price)) THEN
      RAISE EXCEPTION 'Verify full payment and advertising policy before approval';
    END IF;
    IF (v_ad.creative_type='photo' AND coalesce(v_ad.image_url,'')='')
       OR (v_ad.creative_type='video' AND
           (coalesce(v_ad.video_url,'')='' OR
            coalesce(v_ad.media_duration_seconds,0)<=0 OR v_ad.media_duration_seconds>30)) THEN
      RAISE EXCEPTION 'A valid approved creative is required';
    END IF;
    UPDATE public.buklod_paid_ad_campaigns
    SET status='approved', approved_by=v_actor, approved_at=v_now,
        starts_at=v_now, ends_at=v_now + interval '30 days'
    WHERE id=p_campaign_id;

  ELSIF p_action='reject' THEN
    IF v_ad.status <> 'pending' THEN RAISE EXCEPTION 'Only pending campaigns can be rejected'; END IF;
    UPDATE public.buklod_paid_ad_campaigns SET status='rejected' WHERE id=p_campaign_id;

  ELSIF p_action='pause' THEN
    IF v_ad.status <> 'approved' THEN RAISE EXCEPTION 'Only approved campaigns can be paused'; END IF;
    UPDATE public.buklod_paid_ad_campaigns SET status='paused' WHERE id=p_campaign_id;

  ELSIF p_action='resume' THEN
    IF v_ad.status <> 'paused'
       OR v_ad.payment_status NOT IN ('paid','waived')
       OR v_ad.ends_at <= v_now THEN
      RAISE EXCEPTION 'Only paid, unexpired campaigns can be resumed';
    END IF;
    UPDATE public.buklod_paid_ad_campaigns SET status='approved' WHERE id=p_campaign_id;
  END IF;

  RETURN jsonb_build_object('ok',true,'id',p_campaign_id,'action',p_action);
END;
$fn$;
REVOKE ALL ON FUNCTION public.buklod_admin_review_paid_ad_v1(uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.buklod_admin_review_paid_ad_v1(uuid,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.buklod_admin_review_paid_ad_v1(uuid,text) TO authenticated;
