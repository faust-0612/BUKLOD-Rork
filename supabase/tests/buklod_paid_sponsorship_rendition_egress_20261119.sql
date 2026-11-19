-- Read-only regression: the live schema may expose optional variants but must
-- preserve the original paid sponsor video_url, existing table RLS and policies.
DO $test$
BEGIN
  IF to_regclass('public.buklod_paid_ad_campaigns') IS NULL THEN
    RAISE EXCEPTION 'Paid campaign table absent';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='buklod_paid_ad_campaigns'
    AND column_name='video_url_mobile' AND is_nullable='YES') THEN
    RAISE EXCEPTION 'Optional mobile rendition column absent';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='buklod_paid_ad_campaigns'
    AND column_name='video_url_low' AND is_nullable='YES') THEN
    RAISE EXCEPTION 'Optional low rendition column absent';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='buklod_paid_ad_campaigns'
    AND column_name='video_url') THEN
    RAISE EXCEPTION 'Original paid video fallback absent';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class
      WHERE oid='public.buklod_paid_ad_campaigns'::regclass) THEN
    RAISE EXCEPTION 'Campaign RLS must remain on';
  END IF;
END
$test$;
