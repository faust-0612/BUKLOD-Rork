-- BUKLOD referral signup: username/code suggestions + attach grants + notify + R38 start.
-- Additive / idempotent. Fixes create-account referral when members type a valid account name.

CREATE OR REPLACE FUNCTION public.suggest_buklod_referral_targets_v1(
  p_query text,
  p_limit integer DEFAULT 8
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_q text := lower(trim(coalesce(p_query, '')));
  v_limit integer := least(greatest(coalesce(p_limit, 8), 1), 12);
  v_rows jsonb := '[]'::jsonb;
BEGIN
  IF char_length(v_q) < 2 THEN
    RETURN jsonb_build_object('ok', true, 'query', v_q, 'items', '[]'::jsonb);
  END IF;

  -- Exact invite-code match first (8-char hex style codes).
  IF v_q ~ '^[a-z0-9._-]{2,48}$' THEN
    SELECT coalesce(jsonb_agg(item ORDER BY rank_score, label), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT
        jsonb_build_object(
          'username', coalesce(nullif(trim(p.username), ''), null),
          'label', coalesce(
            nullif(trim(p.username), ''),
            nullif(trim(p.full_name), ''),
            'BUKLOD member'
          ),
          'referral_code', public.buklod_ensure_referral_code_v1(p.id),
          'match_kind', CASE
            WHEN upper(c.referral_code) = upper(v_q) THEN 'code'
            WHEN lower(p.username) = v_q THEN 'username_exact'
            ELSE 'username_prefix'
          END
        ) AS item,
        CASE
          WHEN upper(c.referral_code) = upper(v_q) THEN 0
          WHEN lower(p.username) = v_q THEN 1
          WHEN lower(p.username) LIKE v_q || '%' THEN 2
          ELSE 3
        END AS rank_score,
        coalesce(nullif(trim(p.username), ''), p.full_name, '') AS label
      FROM public.profiles p
      LEFT JOIN public.buklod_user_referral_codes c ON c.user_id = p.id
      WHERE coalesce(p.is_active, true) = true
        AND p.user_deactivated_at IS NULL
        AND (
          upper(c.referral_code) = upper(v_q)
          OR lower(coalesce(p.username, '')) = v_q
          OR lower(coalesce(p.username, '')) LIKE v_q || '%'
          OR lower(coalesce(p.login_identifier, '')) = v_q
          OR lower(coalesce(p.full_name, '')) LIKE '%' || v_q || '%'
        )
      ORDER BY rank_score, label
      LIMIT v_limit
    ) matched;
  ELSE
    SELECT coalesce(jsonb_agg(item ORDER BY rank_score, label), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT
        jsonb_build_object(
          'username', coalesce(nullif(trim(p.username), ''), null),
          'label', coalesce(
            nullif(trim(p.username), ''),
            nullif(trim(p.full_name), ''),
            'BUKLOD member'
          ),
          'referral_code', public.buklod_ensure_referral_code_v1(p.id),
          'match_kind', CASE
            WHEN lower(p.username) = v_q THEN 'username_exact'
            WHEN lower(p.username) LIKE v_q || '%' THEN 'username_prefix'
            ELSE 'name'
          END
        ) AS item,
        CASE
          WHEN lower(p.username) = v_q THEN 1
          WHEN lower(p.username) LIKE v_q || '%' THEN 2
          ELSE 3
        END AS rank_score,
        coalesce(nullif(trim(p.username), ''), p.full_name, '') AS label
      FROM public.profiles p
      WHERE coalesce(p.is_active, true) = true
        AND p.user_deactivated_at IS NULL
        AND (
          lower(coalesce(p.username, '')) = v_q
          OR lower(coalesce(p.username, '')) LIKE v_q || '%'
          OR lower(coalesce(p.full_name, '')) LIKE '%' || v_q || '%'
        )
      ORDER BY rank_score, label
      LIMIT v_limit
    ) matched;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'query', v_q,
    'items', coalesce(v_rows, '[]'::jsonb)
  );
END;
$function$;

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
BEGIN
  IF v_raw = '' THEN
    RETURN jsonb_build_object('found', false, 'message', 'Enter a BUKLOD account name or invite code.');
  END IF;

  -- 1) Exact invite code
  IF v_code <> '' THEN
    SELECT c.user_id, c.referral_code
    INTO v_referrer_id, v_referral_code
    FROM public.buklod_user_referral_codes c
    WHERE c.referral_code = v_code
    LIMIT 1;
  END IF;

  -- 2) Exact username / login identifier
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
    'referral_code', v_referral_code
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.buklod_record_referral_v1(p_referrer_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_referrer_id uuid;
  v_raw text := trim(coalesce(p_referrer_code, ''));
  v_code text := upper(regexp_replace(v_raw, '[^A-Za-z0-9]', '', 'g'));
  v_user_key text := lower(v_raw);
  v_resolved jsonb;
  v_referred_label text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_raw = '' THEN
    RAISE EXCEPTION 'Referral code required';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.buklod_referrals
    WHERE referred_id = v_user
  ) THEN
    RAISE EXCEPTION 'Referral already recorded';
  END IF;

  v_resolved := public.resolve_buklod_referral_target_v1(v_raw);
  IF coalesce((v_resolved->>'found')::boolean, false) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Invalid referral code';
  END IF;

  v_referrer_id := (v_resolved->>'user_id')::uuid;
  v_code := coalesce(nullif(v_resolved->>'referral_code', ''), v_code);

  IF v_referrer_id = v_user THEN
    RAISE EXCEPTION 'Cannot use your own referral code';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.buklod_referrals
    WHERE referrer_id = v_user
      AND referred_id = v_referrer_id
  ) THEN
    RAISE EXCEPTION 'Referral chain not allowed';
  END IF;

  INSERT INTO public.buklod_referrals (referrer_id, referred_id, status)
  VALUES (v_referrer_id, v_user, 'pending');

  SELECT coalesce(
    nullif(trim(p.username), ''),
    nullif(trim(p.full_name), ''),
    'A new member'
  )
  INTO v_referred_label
  FROM public.profiles p
  WHERE p.id = v_user;

  PERFORM public.queue_notification(
    v_referrer_id,
    'Referral joined',
    coalesce(v_referred_label, 'A new member') || ' joined BUKLOD using your invite. Sharing rewards follow the active BUKLOD referral settings.',
    'referral_joined',
    jsonb_build_object(
      'route', '/bayanihan',
      'referred_user_id', v_user,
      'referral_code', v_code,
      'status', 'pending'
    )
  );

  BEGIN
    PERFORM private.buklod_r38_refresh_referral_state_v1(v_user);
  EXCEPTION
    WHEN undefined_function THEN
      NULL;
    WHEN OTHERS THEN
      NULL;
  END;
END;
$function$;

REVOKE ALL ON FUNCTION public.suggest_buklod_referral_targets_v1(text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_buklod_referral_target_v1(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.buklod_record_referral_v1(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.suggest_buklod_referral_targets_v1(text, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_buklod_referral_target_v1(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_record_referral_v1(text) TO authenticated;

COMMENT ON FUNCTION public.suggest_buklod_referral_targets_v1(text, integer) IS
  'Public signup helper: suggest active BUKLOD accounts / invite codes for the referral bar.';
COMMENT ON FUNCTION public.resolve_buklod_referral_target_v1(text) IS
  'Resolve invite code or account username to a referrer before/during signup.';
COMMENT ON FUNCTION public.buklod_record_referral_v1(text) IS
  'Attach first-line referral by invite code or account username; notifies referrer and starts R38 referral state.';
