-- Live migration 20261111151816 / retire_igpat_preserve_history_v1
-- IGPAT retirement: reject new reel rows, leave existing posts and all non-reel creation untouched.
CREATE OR REPLACE FUNCTION private.buklod_reject_retired_igpat_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $igpat_retired$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.is_reel IS TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001',
        MESSAGE = 'BUKLOD IGPAT has been retired. New IGPAT videos cannot be published.';
    END IF;
  ELSIF OLD.is_reel IS DISTINCT FROM TRUE AND NEW.is_reel IS TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001',
      MESSAGE = 'BUKLOD IGPAT has been retired. Existing posts cannot be converted to IGPAT.';
  END IF;
  RETURN NEW;
END;
$igpat_retired$;

REVOKE ALL ON FUNCTION private.buklod_reject_retired_igpat_v1() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_buklod_retired_igpat_write ON public.community_posts;
CREATE TRIGGER trg_buklod_retired_igpat_write
BEFORE INSERT OR UPDATE OF is_reel ON public.community_posts
FOR EACH ROW
EXECUTE FUNCTION private.buklod_reject_retired_igpat_v1();

-- Keep signatures for legacy binaries but stop their execution.
-- The table trigger prevents authorized server-side callers from bypassing retirement.
REVOKE EXECUTE ON FUNCTION
  public.create_buklod_reel_v1(text, uuid, text, text, text, bigint, numeric),
  public.create_buklod_reel_v2(text, uuid, text, text, text, bigint, numeric, jsonb),
  public.create_buklod_reel_v3(text, uuid, text, text, text, bigint, numeric, jsonb, uuid, text),
  public.get_buklod_igpat_feed_v2(text, integer),
  public.get_buklod_igpat_feed_v3(text, integer),
  public.get_buklod_igpat_feed_v4(text, integer, timestamp with time zone, uuid),
  public.get_buklod_reels_v1(integer),
  public.get_my_active_igpat_groups_v1()
FROM PUBLIC, anon, authenticated;
