-- BUKLOD MAIN, non-Season-2, additive media-delivery metadata only.
-- Existing approved campaigns continue playing video_url unchanged. Only
-- verified smaller MP4 files may be referenced via optional fields.
-- No triggers, finance/ads accounting changes, RLS changes, or data rewrites.
ALTER TABLE public.buklod_paid_ad_campaigns
  ADD COLUMN IF NOT EXISTS video_url_mobile text,
  ADD COLUMN IF NOT EXISTS video_url_low text;

COMMENT ON COLUMN public.buklod_paid_ad_campaigns.video_url_mobile IS
  'Optional approved fast-start mobile MP4; encode offline, verify byte savings and HTTP playback before linking.';
COMMENT ON COLUMN public.buklod_paid_ad_campaigns.video_url_low IS
  'Optional approved fast-start low-bandwidth MP4; original video_url remains fallback.';
