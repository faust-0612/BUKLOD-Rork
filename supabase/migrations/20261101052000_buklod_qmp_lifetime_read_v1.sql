-- BUKLOD QMP lifetime visibility R1
-- ADDITIVE READ ONLY: preserves all settlement, payout, revenue and monthly computations.
-- Monthly period rows and their qualified_QMP totals are never reset by this function.
CREATE OR REPLACE FUNCTION public.get_my_buklod_community_qmp_history_v1()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_result jsonb;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT jsonb_build_object(
    'lifetime_qmp', COALESCE(SUM(a.qualified_qmp), 0),
    'periods', COALESCE(
      jsonb_agg(jsonb_build_object(
        'period_key', p.period_key,
        'qualified_qmp', a.qualified_qmp,
        'held_qmp', a.held_qmp,
        'status', p.status
      ) ORDER BY p.starts_at DESC),
      '[]'::jsonb
    )
  )
  INTO v_result
  FROM private.buklod_community_qmp_accounts a
  JOIN private.buklod_community_settlement_periods p
    ON p.id = a.settlement_period_id
  WHERE a.user_id = v_actor;

  RETURN v_result;
END;
$function$;

-- Default PostgreSQL function EXECUTE for PUBLIC is not acceptable.
REVOKE ALL ON FUNCTION public.get_my_buklod_community_qmp_history_v1()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_buklod_community_qmp_history_v1()
  TO authenticated;
