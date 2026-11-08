-- Backward-compatible registration: accept legacy and canonical codes, return
-- the canonical alias for secure Profit-First attribution. No referral rows inserted.
CREATE OR REPLACE FUNCTION public.resolve_buklod_referral_target_v1(p_query text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_raw text := trim(coalesce(p_query, ''));
  v_code text := upper(regexp_replace(v_raw, '[^A-Za-z0-9]', '', 'g'));
  v_user text := lower(v_raw);
  v_referrer_id uuid;
  v_username text;
  v_label text;
  v_referral_code text;
  v_canonical_code text;
BEGIN
  IF v_raw = '' THEN
    RETURN jsonb_build_object('found', false, 'message', 'Enter a BUKLOD account name or invite code.');
  END IF;

  IF v_code <> '' THEN
    SELECT c.user_id, c.referral_code
    INTO v_referrer_id, v_referral_code
    FROM public.buklod_user_referral_codes c
    WHERE c.referral_code = v_code
    LIMIT 1;
  END IF;

  -- Accept a new 10-character canonical financial code as well as
  -- historical eight-character aliases. Do not expose private account IDs.
  IF v_referrer_id IS NULL AND v_code <> '' THEN
    SELECT person.current_user_id
    INTO v_referrer_id
    FROM public.buklod_referral_codes_v2 c
    JOIN private.buklod_pf_persons person ON person.person_id=c.person_id
    JOIN public.profiles p ON p.id=person.current_user_id
    WHERE c.referral_code=v_code AND c.is_active=true
      AND p.is_active=true AND p.user_deactivated_at IS NULL
    LIMIT 1;
  END IF;

  IF v_referrer_id IS NULL THEN
    SELECT p.id
    INTO v_referrer_id
    FROM public.profiles p
    WHERE coalesce(p.is_active, true) = true
      AND p.user_deactivated_at IS NULL
      AND (
        lower(coalesce(p.username, '')) = v_user
        OR lower(coalesce(p.login_identifier, '')) = v_user
      )
    ORDER BY CASE WHEN lower(coalesce(p.username, '')) = v_user THEN 0 ELSE 1 END
    LIMIT 1;
  END IF;

  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object(
      'found', false,
      'message', 'No matching BUKLOD account was found. Try the account name or invite code.'
    );
  END IF;

  v_referral_code := public.buklod_ensure_referral_code_v1(v_referrer_id);
  SELECT c.referral_code INTO v_canonical_code
  FROM private.buklod_pf_persons person
  JOIN public.buklod_referral_codes_v2 c ON c.person_id=person.person_id AND c.is_active=true
  WHERE person.current_user_id=v_referrer_id
  ORDER BY c.created_at LIMIT 1;

  SELECT
    nullif(trim(p.username), ''),
    coalesce(
      nullif(trim(p.username), ''),
      nullif(trim(p.full_name), ''),
      'BUKLOD member'
    )
  INTO v_username, v_label
  FROM public.profiles p
  WHERE p.id = v_referrer_id;

  RETURN jsonb_build_object(
    'found', true,
    'user_id', v_referrer_id,
    'username', v_username,
    'label', v_label,
    'referral_code', v_referral_code,
    'canonical_referral_code', v_canonical_code
  );
END;
$function$;
