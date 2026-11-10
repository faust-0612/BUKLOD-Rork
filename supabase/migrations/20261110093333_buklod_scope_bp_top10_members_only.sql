-- Members-only lifetime BUKLOD Points Top 10 per exact Cluster or Organization.
-- Separate from the global leaderboard, Circle Rank, QMP and cash earnings.
CREATE OR REPLACE FUNCTION public.get_buklod_scope_bp_top10_v1(p_scope_id uuid)
RETURNS TABLE (rank_position bigint, user_id uuid, full_name text, total_points bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_viewer uuid := (SELECT auth.uid());
BEGIN
  IF v_viewer IS NULL OR p_scope_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.buklod_scopes s
    JOIN public.buklod_scope_memberships viewer ON viewer.scope_id = s.id
    WHERE s.id = p_scope_id
      AND s.scope_type IN ('CLUSTER', 'ORGANIZATION')
      AND s.status = 'ACTIVE'
      AND viewer.user_id = v_viewer
      AND viewer.membership_status = 'ACTIVE'
      AND viewer.left_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Active scope membership required' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  WITH eligible AS (
    SELECT p.id AS member_id,
      COALESCE(NULLIF(btrim(p.full_name),''),NULLIF(btrim(p.username),''),'BUKLOD Member')::text AS member_name,
      greatest(0,coalesce(b.lifetime_points,0))::bigint AS bp
    FROM public.buklod_scope_memberships m
    JOIN public.profiles p ON p.id = m.user_id
    LEFT JOIN public.buklod_user_points_balances b ON b.user_id = m.user_id
    WHERE m.scope_id = p_scope_id
      AND m.membership_status = 'ACTIVE'
      AND m.left_at IS NULL
      AND p.is_active = true
  ), ranked AS (
    SELECT row_number() OVER (ORDER BY e.bp DESC, lower(e.member_name), e.member_id) AS position,
      e.member_id, e.member_name, e.bp
    FROM eligible e
  )
  SELECT r.position, r.member_id, r.member_name, r.bp
  FROM ranked r ORDER BY r.position LIMIT 10;
END;
$function$;
REVOKE ALL ON FUNCTION public.get_buklod_scope_bp_top10_v1(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_buklod_scope_bp_top10_v1(uuid) TO authenticated;
