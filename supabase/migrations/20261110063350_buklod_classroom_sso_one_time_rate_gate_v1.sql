-- Applied to canonical Supabase on 2026-11-10 as migration 20261110063350.
-- Atomic per-user throttle for Classroom one-time auth link creation.
CREATE TABLE IF NOT EXISTS private.buklod_classroom_sso_rate_limit_v1 (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_issued_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.buklod_classroom_sso_rate_limit_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.buklod_classroom_sso_rate_limit_v1 FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.buklod_classroom_sso_claim_v1(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_count integer:=0;
BEGIN
  IF p_user_id IS NULL THEN RETURN false; END IF;
  INSERT INTO private.buklod_classroom_sso_rate_limit_v1(user_id,last_issued_at)
  VALUES (p_user_id,now())
  ON CONFLICT (user_id) DO UPDATE
    SET last_issued_at=EXCLUDED.last_issued_at
    WHERE private.buklod_classroom_sso_rate_limit_v1.last_issued_at < now() - interval '5 seconds';
  GET DIAGNOSTICS v_count=ROW_COUNT;
  RETURN v_count=1;
END;
$fn$;
REVOKE ALL ON FUNCTION public.buklod_classroom_sso_claim_v1(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_classroom_sso_claim_v1(uuid) TO service_role;
COMMENT ON FUNCTION public.buklod_classroom_sso_claim_v1(uuid) IS
  'Private service-only atomic rate gate for one-time Classroom auth link issuance; never grants a Classroom role.';
